"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, CameraOff, Check, ChevronUp, ImagePlus, Images, Info, KeyRound, Leaf, Loader2, Plus, RefreshCw, Save, Search, Settings, Sparkles, Sprout, SquareStack, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Page } from "@/components/page";
import { Frame } from "@/components/frame";
import { Field, NativeSelect } from "@/components/fields";
import { BlobImage } from "@/components/blob-image";
import { SimpleMarkdown } from "@/components/simple-markdown";
import { PlantForm, type PlantFormInitial } from "@/components/plant-form";
import { FactsCard } from "@/components/plant-facts-card";
import { assistantHref } from "@/components/ask-claude";
import { askAbout, categoryPill, FactChips, findExisting, ImageStrip, lifecyclePill } from "@/components/candidate";
import { cn } from "cn";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { newId } from "@/lib/id";
import { useSettings } from "@/lib/settings";
import { useLiveCamera, type CameraStatus } from "@/lib/camera";
import { resolveTransport } from "@/lib/llm-client";
import { compressImage } from "@/lib/images";
import { enrichCandidates, inferCategory, type PlantCandidate } from "@/lib/plant-lookup";
import { ensureIdentificationFacts, fetchCandidateFacts, withListedFacts } from "@/lib/plant-facts";
import { diagnosePlant, identifyPlantPhotos, identifyPlantWithVision, MAX_IDENTIFY_PHOTOS, PLANT_ORGANS, type PlantOrgan } from "@/lib/plant-id";
import { plantTitle, type Identification, type Plant, type PlantFacts } from "@/lib/types";

/** De andre delene av skallet som kameraet kan åpne: plantene til venstre, assistenten til høyre, historikken nedenfra. */
export type ShellTarget = "planter" | "assistent" | "historikk";

type Mode = "plante" | "sykdom";
/** Kameraet står på, eller brukeren ser på bildene som er tatt og svarene på dem. */
type View = "camera" | "review";
type IdResult = { candidates: PlantCandidate[]; remaining?: number; source: "plantnet" | "ki" };
/** Fulle plantefakta hentet for et forslag med «Hent info», før det eventuelt lagres. */
type CandidateInfo = { status: "busy" } | { status: "done"; facts: PlantFacts } | { status: "error"; message: string };
/** Et valgt bilde og hva det viser. Organet brukes bare av Pl@ntNet. */
type PickedPhoto = { id: string; blob: Blob; organ: PlantOrgan };

type Props = {
  onNavigate: (target: ShellTarget) => void;
  /** Sann mens brukeren ser på bildene og svarene. Da skal ikke sveip bytte side. */
  onReviewingChange: (reviewing: boolean) => void;
};

/** En ny oppføring i historikken, og det første bildet nedskalert til bildetabellen. */
async function newRecord(photo: Blob, photoCount: number, source: Identification["source"], candidates: PlantCandidate[]): Promise<{ record: Identification; photo: Blob }> {
  return { record: { id: newId(), createdAt: Date.now(), photoCount, source, candidates }, photo: await compressImage(photo, 800, 0.8) };
}

function plainText(markdown: string, max: number): string {
  const text = markdown.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Kameraet, som appen starter i. Søkeren fyller skjermen med modusvelgeren øverst og utløseren nederst, slik man
 * kjenner det fra Snapchat. Et trykk på utløseren tar bildet fra strømmen, spør Pl@ntNet eller KI-leverandøren med en
 * gang og viser svaret i gjennomgangen over kameraet. Med flere bilder på (ikonet øverst til høyre, bare med Pl@ntNet)
 * samler utløseren bilder til «Ferdig», og gjennomgangen lar deg si hva hvert bilde viser før du identifiserer. Får
 * appen ikke bruke kameraet, åpner utløseren telefonens eget kamera i stedet.
 */
export function IdentifyScreen({ onNavigate, onReviewingChange }: Props) {
  const router = useRouter();
  const settings = useSettings();
  const transport = useMemo(() => resolveTransport(settings), [settings]);
  const plants = useLiveQuery(() => db.plants.orderBy("name").toArray(), []) ?? EMPTY;
  const { videoRef, canvasRef, status: cameraStatus, capture } = useLiveCamera(true);

  const [view, setView] = useState<View>("camera");
  const [mode, setMode] = useState<Mode>("plante");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idResult, setIdResult] = useState<IdResult | null>(null);
  /** Oppføringen i historikken som det siste svaret er lagret som, hvis brukeren har lagret det. */
  const [recordId, setRecordId] = useState<string | null>(null);
  /** Plantefakta hentet med «Hent info», per forslag. Følger med når forslaget lagres. */
  const [infoByKey, setInfoByKey] = useState<Record<string, CandidateInfo>>({});
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [plantId, setPlantId] = useState("");
  const [saved, setSaved] = useState(false);
  const [formInitial, setFormInitial] = useState<PlantFormInitial | null>(null);
  /** Et kort hvitt blink når bildet tas. */
  const [flash, setFlash] = useState(false);
  /** Flere bilder av samme plante (bare med Pl@ntNet): utløseren samler bilder til «Ferdig» trykkes. */
  const [multiCapture, setMultiCapture] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const savedRecord = useLiveQuery(() => (recordId ? db.identifications.get(recordId) : undefined), [recordId]);

  const canIdentify = !!settings.plantNetApiKey || !!transport;
  const canDiagnose = !!transport;
  const selectedPlant = plants.find((p) => p.id === plantId);
  /** Forslaget det siste svaret er lagret som, så knappen kan vise «Lagret». */
  const savedKey = candidateKey(savedRecord?.candidates[0]);
  const assistantLabel = transport?.label ?? "Claude";
  // Flere bilder og organvalg gjelder bare Pl@ntNet, og bare når brukeren har slått det på. KI-leverandøren ser på ett
  // bilde, og det gjør sykdomsvurderingen også.
  const canMultiCapture = mode === "plante" && !!settings.plantNetApiKey;
  const multiPhoto = canMultiCapture && multiCapture;
  const photo = photos[0]?.blob ?? null;
  const reviewing = view === "review";

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => onReviewingChange(reviewing), [reviewing, onReviewingChange]);

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  /**
   * Lagrer identifiseringen i historikken som det valgte forslaget, med det første bildet nedskalert. Bare det valgte
   * forslaget tas vare på. Er svaret lagret fra før, byttes forslaget i samme oppføring.
   */
  async function saveChoice(chosen: PlantCandidate) {
    if (!idResult || photos.length === 0) return;
    // Er faktaene alt hentet med «Hent info», følger de med, og oppslaget etterpå trengs ikke.
    const info = infoByKey[candidateKey(chosen) ?? ""];
    const facts = info?.status === "done" ? info.facts : undefined;
    let id = recordId;
    if (id) {
      // Nytt forslag i samme oppføring: faktaene hørte til det forrige.
      await db.identifications.update(id, { candidates: [chosen], facts });
    } else {
      const { record, photo: stored } = await newRecord(photos[0].blob, photos.length, idResult.source, [chosen]);
      await db.transaction("rw", [db.identifications, db.identificationPhotos], async () => {
        await db.identifications.add(facts ? { ...record, facts } : record);
        await db.identificationPhotos.put({ id: record.id, blob: stored });
      });
      id = record.id;
      setRecordId(id);
    }
    // Fulle plantefakta hentes i bakgrunnen, så de ligger klare når oppføringen åpnes.
    if (!facts) ensureIdentificationFacts(id).catch(() => undefined);
  }

  /** «Hent info»: fulle plantefakta for forslaget, vist i kortet uten å lagre noe. */
  function fetchInfo(c: PlantCandidate) {
    const key = candidateKey(c) ?? "";
    setInfoByKey((m) => ({ ...m, [key]: { status: "busy" } }));
    fetchCandidateFacts(c)
      .then((facts) => setInfoByKey((m) => ({ ...m, [key]: { status: "done", facts } })))
      .catch((err: unknown) =>
        setInfoByKey((m) => ({ ...m, [key]: { status: "error", message: err instanceof Error && err.message ? err.message : "Fikk ikke hentet plantefakta nå." } }))
      );
  }

  function startAdd(c: PlantCandidate, photoBlob: Blob | null) {
    setFormInitial({ name: c.name, latinName: c.latinName, variety: c.variety, category: c.category ?? inferCategory(c.latinName), photo: photoBlob ?? undefined });
  }

  /** Tilbake til kameraet: ingen bilder og ingen svar. */
  function reset() {
    cancel();
    setView("camera");
    setPhotos([]);
    setIdResult(null);
    setRecordId(null);
    setInfoByKey({});
    setDiagnosis(null);
    setError(null);
    setSaved(false);
  }

  /**
   * Spør Pl@ntNet eller KI-leverandøren om bildene. Kjøres av seg selv rett etter ett enkelt bilde, og fra knappen i
   * gjennomgangen. `list` er bildene som nettopp er satt, før `photos` har rukket å oppdatere seg.
   */
  async function analyse(list: PickedPhoto[] = photos) {
    cancel();
    if (list.length === 0) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    if (mode === "plante" ? !canIdentify : !canDiagnose) return;
    setBusy(true);
    try {
      if (mode === "plante") {
        if (settings.plantNetApiKey) {
          const result = await identifyPlantPhotos(settings.plantNetApiKey, list, ac.signal);
          let found = result.candidates;
          if (transport && found.length > 0) found = await enrichCandidates(transport, found, ac.signal);
          if (ac.signal.aborted) return;
          found = found.map(withListedFacts);
          setIdResult({ candidates: found, remaining: result.remaining, source: "plantnet" });
          if (found.length === 0) setError(`Pl@ntNet fant ingen plante i ${list.length > 1 ? "bildene" : "bildet"}. Prøv et nærmere bilde av blad, blomst eller frukt.`);
        } else if (transport) {
          let found = await identifyPlantWithVision(transport, list[0].blob, ac.signal);
          if (found.length > 0) found = await enrichCandidates(transport, found, ac.signal);
          if (ac.signal.aborted) return;
          found = found.map(withListedFacts);
          setIdResult({ candidates: found, source: "ki" });
          if (found.length === 0) setError(`${transport.label} kjente ikke igjen noen plante i bildet. Prøv et nærmere bilde.`);
        }
      } else if (transport) {
        setDiagnosis("");
        setSaved(false);
        await diagnosePlant({ transport, file: list[0].blob, settings, plant: selectedPlant, signal: ac.signal, onText: setDiagnosis });
      }
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  }

  /**
   * Bildene er endret: svarene gjelder ikke lenger, og et oppslag som pågår avbrytes. Uten bilder er det kameraet igjen;
   * ellers gjennomgangen, om ikke `nextView` sier noe annet (flere bilder samles i kameraet).
   */
  function changePhotos(next: PickedPhoto[], nextView: View = "review") {
    cancel();
    setPhotos(next);
    setView(next.length > 0 ? nextView : "camera");
    setIdResult(null);
    setRecordId(null);
    setInfoByKey({});
    setDiagnosis(null);
    setError(null);
    setSaved(false);
  }

  /**
   * Nye bilder, fra utløseren eller fra bildene. Med flere bilder på legges de til, opptil fem, og brukeren blir i
   * kameraet til «Ferdig» (fra bildene, eller når det er fullt, går det rett til gjennomgangen). Ellers erstatter det
   * nye bildet det gamle, regnes som «auto», og identifiseringen starter med en gang.
   */
  function addPhotos(blobs: Blob[], fromGallery = false) {
    const picked = blobs.map((blob): PickedPhoto => ({ id: newId(), blob, organ: "auto" }));
    if (picked.length === 0) return;
    reviewRef.current?.scrollTo({ top: 0 });
    if (multiPhoto) {
      const next = [...photos, ...picked].slice(0, MAX_IDENTIFY_PHOTOS);
      changePhotos(next, fromGallery || next.length >= MAX_IDENTIFY_PHOTOS ? "review" : "camera");
      return;
    }
    const next = picked.slice(0, 1);
    changePhotos(next);
    void analyse(next);
  }

  function onFile(input: HTMLInputElement) {
    const files = [...(input.files ?? [])];
    input.value = "";
    addPhotos(files, input === galleryInputRef.current);
  }

  /** Utløseren: et stillbilde fra strømmen. Går ikke kameraet, tar telefonens eget kamera bildet. */
  async function shoot() {
    if (cameraStatus !== "live") {
      captureInputRef.current?.click();
      return;
    }
    // Blinket kommer med en gang, så trykket kjennes, mens bildet kodes.
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const blob = await capture();
    if (blob) addPhotos([blob]);
    else captureInputRef.current?.click();
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    cancel();
    setMode(next);
    setError(null);
  }

  async function savePhotoToPlant() {
    if (!photo || !selectedPlant || !diagnosis) return;
    const [blob, thumb] = await Promise.all([compressImage(photo, 1600, 0.82), compressImage(photo, 320, 0.75)]);
    await db.photos.add({ id: newId(), plantId: selectedPlant.id, blob, thumb, takenAt: Date.now(), note: `Vurdering fra ${transport?.label ?? "KI"}: ${plainText(diagnosis, 300)}` });
    setSaved(true);
  }

  const waitingLabel = multiPhoto ? `Pl@ntNet ser på ${photos.length > 1 ? "bildene" : "bildet"} ...` : `${transport?.label ?? "KI"} ser på bildet ...`;
  const canRun = mode === "plante" ? canIdentify : canDiagnose;
  const setupText =
    mode === "plante"
      ? "For å identifisere planter trenger du en gratis Pl@ntNet-nøkkel, eller en KI-leverandør med en modell som tåler bilder (Gemini Flash)."
      : "For å vurdere sykdom trenger du en KI-leverandør med en modell som tåler bilder, for eksempel Gemini Flash.";

  return (
    <>
      <input ref={galleryInputRef} type="file" accept="image/*" multiple={multiPhoto} className="hidden" onChange={(e) => onFile(e.currentTarget)} />
      <input ref={captureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.currentTarget)} />

      {/* Søkeren: bildet i en avrundet, mørk flate med valgene lagt oppå, og knappene på lys bunn under */}
      <div className="absolute inset-0 flex flex-col bg-background px-3 text-foreground select-none" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)", paddingBottom: "calc(var(--safe-bottom) + 0.5rem)" }}>
        <div className="relative isolate min-h-0 flex-1 overflow-hidden rounded-[28px] bg-black text-white [transform:translateZ(0)]">
          {/* Videoen er skjult; bildet tegnes i canvaset (se useLiveCamera). */}
          <video ref={videoRef} autoPlay playsInline muted className="pointer-events-none absolute top-0 left-0 size-px opacity-0" />
          <canvas ref={canvasRef} aria-label="Søkeren" className={cn("absolute inset-0 size-full", cameraStatus !== "live" && "invisible")} />
          {cameraStatus !== "live" && <CameraNotice status={cameraStatus} />}
          <div className={cn("pointer-events-none absolute inset-0 bg-white transition-opacity duration-200", flash ? "opacity-80" : "opacity-0")} aria-hidden />

          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent pb-10">
            <div className="relative mx-auto flex max-w-lg items-center justify-center px-4 pt-3">
              <div role="tablist" aria-label="Hva vil du vite?" className="flex rounded-full bg-black/40 p-1 backdrop-blur-md">
                <ModeButton active={mode === "plante"} onClick={() => switchMode("plante")}>
                  <Leaf className="size-4" /> Hvilken plante?
                </ModeButton>
                <ModeButton active={mode === "sykdom"} onClick={() => switchMode("sykdom")}>
                  <Stethoscope className="size-4" /> Hva feiler den?
                </ModeButton>
              </div>
              <div className="absolute top-3 right-4 flex flex-col gap-2">
                <Link href="/innstillinger/" aria-label="Innstillinger" className="flex size-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md active:bg-black/60">
                  <Settings className="size-5" />
                </Link>
                {canMultiCapture && (
                  <button
                    type="button"
                    aria-pressed={multiCapture}
                    aria-label="Flere bilder av samme plante"
                    onClick={() => setMultiCapture((v) => !v)}
                    className={cn("flex size-10 items-center justify-center rounded-full backdrop-blur-md transition-colors", multiCapture ? "bg-white text-foreground" : "bg-black/40 active:bg-black/60")}
                  >
                    <SquareStack className="size-5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {(!canRun || photos.length > 0 || multiPhoto) && (
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/55 to-transparent px-6 pt-10 pb-4">
              {!canRun && <SetupNotice text={setupText} tone="overlay" />}
              {photos.length > 0 ? (
                <button type="button" onClick={() => setView("review")} className="flex items-center gap-2 rounded-full bg-black/45 py-1.5 pr-4 pl-1.5 text-sm font-medium backdrop-blur-md active:bg-black/65">
                  <span className="flex">
                    {photos.map((p, i) => (
                      <BlobImage key={p.id} blob={p.blob} alt="" className={cn("size-8 rounded-full border-2 border-white/80 object-cover", i > 0 && "-ml-2")} />
                    ))}
                  </span>
                  {photos.length === 1 ? "1 bilde" : `${photos.length} bilder`}
                </button>
              ) : (
                multiPhoto && <p className="rounded-full bg-black/45 px-4 py-1.5 text-center text-sm backdrop-blur-md">Ta opptil {MAX_IDENTIFY_PHOTOS} bilder av planten, og trykk Ferdig.</p>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-lg shrink-0 flex-col gap-2 px-3 pt-3">
          <div className="grid grid-cols-3 items-center">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              aria-label="Velg fra bilder"
              className="flex size-12 items-center justify-center justify-self-start rounded-full bg-muted text-foreground active:bg-accent"
            >
              <Images className="size-6" />
            </button>
            <button
              type="button"
              onClick={shoot}
              aria-label={mode === "plante" ? "Ta bilde av planten" : "Ta bilde av det som feiler"}
              className="flex size-[76px] items-center justify-center justify-self-center rounded-full border-[3px] border-foreground transition-transform active:scale-90"
            >
              <span className="size-[62px] rounded-full bg-primary" />
            </button>
            {photos.length > 0 && (
              <button type="button" onClick={() => setView("review")} className="justify-self-end rounded-full px-3 py-2 text-base font-semibold text-primary active:opacity-70">
                Ferdig
              </button>
            )}
          </div>
          <nav aria-label="Deler av appen" className="grid grid-cols-3 text-[11px] font-medium text-muted-foreground">
            <NavButton icon={<Sprout className="size-5" />} label="Planter" onClick={() => onNavigate("planter")} />
            <NavButton icon={<ChevronUp className="size-5" />} label="Historikk" onClick={() => onNavigate("historikk")} />
            <NavButton icon={<Sparkles className="size-5" />} label="Assistent" onClick={() => onNavigate("assistent")} />
          </nav>
        </div>
      </div>

      {/* Gjennomgangen: bildene og svarene, over kameraet */}
      {reviewing && (
        <div className="absolute inset-0 bg-background text-foreground">
          <Frame scrollRef={reviewRef}>
            <div className="pb-4">
          <PageHeader
            title="Identifiser"
            subtitle={mode === "sykdom" ? "Hva feiler planten?" : "Hvilken plante er dette?"}
            leading={
              <Button variant="ghost" size="icon-lg" className="-ml-2 rounded-full" aria-label="Tilbake til kameraet" onClick={reset}>
                <X className="size-5" />
              </Button>
            }
          />
          <Page className="flex flex-col gap-4">
            <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="plante" className="flex-1">
                  <Leaf className="size-4" /> Hvilken plante?
                </TabsTrigger>
                <TabsTrigger value="sykdom" className="flex-1">
                  <Stethoscope className="size-4" /> Hva feiler den?
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "sykdom" && (
              <Field label="Hvilken plante gjelder det?" htmlFor="identify-plant" hint="Valgfritt, men gir et mer treffsikkert svar, og lar deg lagre bildet på planten.">
                <NativeSelect id="identify-plant" value={plantId} onChange={(e) => setPlantId(e.target.value)}>
                  <option value="">Ikke valgt</option>
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {plantTitle(p)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <ul className={cn("grid gap-2", photos.length > 1 && "grid-cols-2")}>
              {photos.map((p, i) => (
                <li key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className={cn("relative bg-muted", photos.length > 1 ? "aspect-square" : "aspect-[4/3]")}>
                    <BlobImage blob={p.blob} alt={`Bilde ${i + 1}`} className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => changePhotos(photos.filter((x) => x.id !== p.id))}
                      aria-label={`Fjern bilde ${i + 1}`}
                      className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white active:bg-black/75"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {multiPhoto && (
                    <div className="flex flex-wrap gap-1 p-2" role="group" aria-label={`Hva viser bilde ${i + 1}?`}>
                      {PLANT_ORGANS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={p.organ === o.value}
                          onClick={() => p.organ !== o.value && changePhotos(photos.map((x) => (x.id === p.id ? { ...x, organ: o.value } : x)))}
                          className={cn(
                            "rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            p.organ === o.value ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"
                          )}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {multiPhoto && (
              <p className="-mt-2 px-1 text-xs text-muted-foreground">
                Opptil {MAX_IDENTIFY_PHOTOS} bilder av samme plante. Flere bilder, og riktig valg av hva de viser, gir sikrere treff. Auto lar Pl@ntNet avgjøre det selv.
              </p>
            )}
            {!multiPhoto && photos.length > 1 && <p className="-mt-2 px-1 text-xs text-muted-foreground">Her brukes bare det første bildet.</p>}
            <div className="flex gap-2">
              {multiPhoto ? (
                <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" disabled={photos.length >= MAX_IDENTIFY_PHOTOS} onClick={() => setView("camera")}>
                  <ImagePlus data-icon="inline-start" /> Legg til bilde
                </Button>
              ) : (
                <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" onClick={reset}>
                  <Camera data-icon="inline-start" /> Nytt bilde
                </Button>
              )}
              {canRun && (
                <Button className="h-11 flex-1 rounded-xl" disabled={busy} onClick={() => analyse()}>
                  {busy ? (
                    <Loader2 className="animate-spin" data-icon="inline-start" />
                  ) : (mode === "plante" ? idResult : diagnosis) ? (
                    <RefreshCw data-icon="inline-start" />
                  ) : mode === "plante" ? (
                    <Search data-icon="inline-start" />
                  ) : (
                    <Stethoscope data-icon="inline-start" />
                  )}
                  {mode === "plante" ? (idResult ? "Identifiser på nytt" : "Identifiser") : diagnosis ? "Analyser på nytt" : "Analyser"}
                </Button>
              )}
            </div>

            {!canRun && <SetupNotice text={setupText} />}

            {busy && (mode === "plante" || !diagnosis) && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {waitingLabel}
              </p>
            )}
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            {mode === "plante" && idResult && idResult.candidates.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Forslag</p>
                {idResult.candidates.map((c, i) => (
                  <CandidateCard
                    key={`${candidateKey(c)}|${i}`}
                    candidate={c}
                    plants={plants}
                    zone={settings.climateZone}
                    assistantLabel={assistantLabel}
                    saved={savedKey !== null && candidateKey(c) === savedKey}
                    lookup={infoByKey[candidateKey(c) ?? ""]}
                    onFetchInfo={transport ? () => fetchInfo(c) : undefined}
                    onSave={() =>
                      saveChoice(c)
                        // Lagret: tilbake til kameraet. Oppføringen ligger nå øverst i historikken.
                        .then(reset)
                        .catch(() => setError("Kunne ikke lagre identifiseringen. Prøv igjen."))
                    }
                    onAdd={() => startAdd(c, photo)}
                  />
                ))}
                {!transport && idResult.candidates.some((c) => !c.facts) && <FactsHint />}
                {idResult.remaining !== undefined && <p className="px-1 text-[11px] text-muted-foreground">{idResult.remaining} oppslag igjen hos Pl@ntNet i dag.</p>}
              </div>
            )}

            {mode === "sykdom" && diagnosis && (
              <Card className="gap-3 px-4">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5" /> Vurdering fra {transport?.label}
                  {selectedPlant ? ` · ${plantTitle(selectedPlant)}` : ""}
                </p>
                <SimpleMarkdown text={diagnosis} className="text-[15px] leading-relaxed" />
                {!busy && (
                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    {selectedPlant && (
                      <Button variant="outline" className="h-10 rounded-xl bg-card" disabled={saved} onClick={savePhotoToPlant}>
                        {saved ? <Check data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                        {saved ? `Lagret på ${plantTitle(selectedPlant)}` : `Lagre bildet og vurderingen på ${plantTitle(selectedPlant)}`}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-10 rounded-xl bg-card"
                      nativeButton={false}
                      render={<Link href={assistantHref(selectedPlant, `Jeg har fått denne vurderingen av et bilde${selectedPlant ? ` av ${selectedPlant.name.toLowerCase()}` : ""}: ${plainText(diagnosis, 400)} Hva bør jeg gjøre videre?`)} />}
                    >
                      <Sparkles data-icon="inline-start" /> Spør videre i assistenten
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">KI kan ta feil. Er du usikker, sjekk med et hagesenter.</p>
              </Card>
            )}
          </Page>
            </div>
          </Frame>
        </div>
      )}

      <PlantForm
        open={formInitial !== null}
        onOpenChange={(o) => {
          if (!o) setFormInitial(null);
        }}
        initial={formInitial ?? undefined}
        onSaved={(p) => {
          // Er identifiseringen lagret i historikken, får oppføringen en lenke til planten.
          if (recordId) db.identifications.update(recordId, { plantId: p.id }).catch(() => undefined);
          router.push(`/plante/?id=${p.id}`);
        }}
      />
    </>
  );
}

/** Mens kameraet starter, og når appen ikke får bruke det. Utløseren tar da bildet med telefonens eget kamera. */
function CameraNotice({ status }: { status: CameraStatus }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-10 text-center">
      {status === "starting" ? (
        <Loader2 className="size-8 animate-spin text-white/70" />
      ) : (
        <>
          <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
            <CameraOff className="size-7 text-white/80" />
          </span>
          <p className="font-medium">{status === "denied" ? "Appen fikk ikke bruke kameraet" : "Fant ikke noe kamera"}</p>
          <p className="text-sm text-white/70">
            {status === "denied" ? "Gi Hagen tilgang til kameraet i innstillingene på telefonen, eller trykk på utløseren for å ta bildet med telefonens kamera." : "Trykk på utløseren for å ta bildet med telefonens kamera, eller velg fra bildene dine."}
          </p>
        </>
      )}
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-white text-foreground" : "text-white/85")}
    >
      {children}
    </button>
  );
}

function NavButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5 py-1 active:opacity-70">
      {icon}
      {label}
    </button>
  );
}

/** Navn og latinsk navn, så samme forslag kjennes igjen på tvers av lister. */
function candidateKey(c: PlantCandidate | undefined): string | null {
  return c ? `${c.name.toLowerCase()}|${c.latinName.toLowerCase()}` : null;
}

function FactsHint() {
  return <p className="px-1 text-[11px] text-muted-foreground">Med en KI-leverandør (Innstillinger) vises også giftighet, herdighet og livsløp for forslagene.</p>;
}

/**
 * Ett forslag, med livsløpet øverst til høyre (om planten kommer igjen er det første en hageeier lurer på) og kategorien
 * blant kortfaktaene. Knappene står i den rekkefølgen de brukes: lagre i historikken (man identifiserer oftest andre
 * steder enn hjemme), legge til i hagen, og til sist spørre assistenten. Lagrede oppføringer har sin egen side
 * (`IdentificationScreen`).
 */
function CandidateCard({
  candidate: c,
  plants,
  zone,
  assistantLabel,
  saved = false,
  lookup,
  onFetchInfo,
  onSave,
  onAdd,
}: {
  candidate: PlantCandidate;
  plants: Plant[];
  zone?: string;
  assistantLabel: string;
  saved?: boolean;
  /** Fulle plantefakta hentet med «Hent info», hvis brukeren har bedt om dem. */
  lookup?: CandidateInfo;
  /** «Hent info» vises bare når det finnes en KI-leverandør, og bare til faktaene er hentet. */
  onFetchInfo?: () => void;
  onSave: () => void;
  onAdd: () => void;
}) {
  const candidateCategory = c.category ?? inferCategory(c.latinName);
  const existing = findExisting(plants, c);
  const images = c.images ?? [];
  return (
    <Card className="gap-2 px-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-base font-medium">{c.name}</p>
        {lifecyclePill(c.facts)}
      </div>
      {(c.latinName || c.variety) && (
        <p className="-mt-1 text-sm text-muted-foreground">
          <span className="italic">{c.latinName}</span>
          {c.variety ? ` '${c.variety}'` : ""}
        </p>
      )}
      {images.length > 0 && <ImageStrip images={images} name={c.name} />}
      <FactChips facts={c.facts} zone={zone} leading={categoryPill(c)} showLifecycle={false} />
      {c.note && <p className="text-sm text-muted-foreground">{c.note}</p>}
      {existing && (
        <Link href={`/plante/?id=${existing.id}`} className="text-sm font-medium text-primary">
          Du har allerede {existing.name} i hagen. Åpne planten.
        </Link>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button className="h-10 flex-1 rounded-xl" disabled={saved} onClick={onSave}>
            {saved ? <Check data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {saved ? "Lagret" : "Lagre"}
          </Button>
          <Button variant="outline" className="h-10 flex-1 rounded-xl bg-card" onClick={onAdd}>
            <Plus data-icon="inline-start" /> Legg til i hagen
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {onFetchInfo && lookup?.status !== "done" && (
            <Button variant="ghost" size="sm" className="h-9 rounded-xl px-2 text-muted-foreground" disabled={lookup?.status === "busy"} onClick={onFetchInfo}>
              {lookup?.status === "busy" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Info data-icon="inline-start" />}
              {lookup?.status === "busy" ? "Henter info ..." : "Hent info"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-xl px-2 text-muted-foreground"
            nativeButton={false}
            render={<Link href={assistantHref(undefined, askAbout(c))} />}
          >
            <Sparkles data-icon="inline-start" /> Spør {assistantLabel}
          </Button>
        </div>
        {lookup?.status === "error" && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">Plantefakta: {lookup.message}</p>}
      </div>
      {lookup?.status === "done" && (
        <FactsCard plain className="border-t border-border pt-3" subject={{ name: c.name, latinName: c.latinName, category: candidateCategory, facts: lookup.facts }} />
      )}
    </Card>
  );
}

/** Peker til innstillingene når det mangler nøkkel. `overlay` er varianten over kameraet, på mørk bunn. */
function SetupNotice({ text, tone = "card" }: { text: string; tone?: "card" | "overlay" }) {
  const overlay = tone === "overlay";
  return (
    <Link
      href="/innstillinger/"
      className={cn("flex items-center gap-3 rounded-2xl px-4 py-3", overlay ? "bg-black/50 text-white backdrop-blur-md" : "border border-border bg-card")}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", overlay ? "bg-white/15" : "bg-accent text-accent-foreground")}>
        <KeyRound className="size-5" />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">Sett opp i innstillinger</span>
        <span className={cn("block text-xs", overlay ? "text-white/75" : "text-muted-foreground")}>{text}</span>
      </span>
    </Link>
  );
}
