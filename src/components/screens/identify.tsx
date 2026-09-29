"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, ChevronRight, History, ImagePlus, KeyRound, Leaf, Loader2, Plus, RefreshCw, Save, Search, Sparkles, Stethoscope, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { Page } from "@/components/page";
import { Field, NativeSelect } from "@/components/fields";
import { BlobImage } from "@/components/blob-image";
import { SimpleMarkdown } from "@/components/simple-markdown";
import { PlantForm, type PlantFormInitial } from "@/components/plant-form";
import { FactsCard } from "@/components/plant-facts-card";
import { assistantHref } from "@/components/ask-claude";
import { cn } from "cn";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { newId } from "@/lib/id";
import { useSettings } from "@/lib/settings";
import { resolveTransport } from "@/lib/llm-client";
import { compressImage } from "@/lib/images";
import { formatDate, formatRelative } from "@/lib/dates";
import { enrichCandidates, inferCategory, type CandidateImage, type PlantCandidate } from "@/lib/plant-lookup";
import { ensureIdentificationFacts, hardyIn, withListedFacts } from "@/lib/plant-facts";
import { diagnosePlant, identifyPlantPhotos, identifyPlantWithVision, MAX_IDENTIFY_PHOTOS, PLANT_ORGANS, type PlantOrgan } from "@/lib/plant-id";
import { TAB_RESELECT_EVENT } from "@/components/tab-bar";
import { categoryInfo, LIFECYCLE_LABELS, plantTitle, TOXICITY_LABELS, type CandidateFacts, type Identification, type Plant, type ToxicityLevel } from "@/lib/types";

type Mode = "plante" | "sykdom";
type IdResult = { candidates: PlantCandidate[]; remaining?: number; source: "plantnet" | "ki" };
/** En oppføring i historikken med bildet sitt hentet fra bildetabellen. */
type HistoryItem = Identification & { photo?: Blob };
/** Et valgt bilde og hva det viser. Organet brukes bare av Pl@ntNet. */
type PickedPhoto = { id: string; blob: Blob; organ: PlantOrgan };

/** En ny oppføring i historikken, og det første bildet nedskalert til bildetabellen. */
async function newRecord(photo: Blob, photoCount: number, source: Identification["source"], candidates: PlantCandidate[]): Promise<{ record: Identification; photo: Blob }> {
  return { record: { id: newId(), createdAt: Date.now(), photoCount, source, candidates }, photo: await compressImage(photo, 800, 0.8) };
}

function plainText(markdown: string, max: number): string {
  const text = markdown.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function IdentifyScreen() {
  const router = useRouter();
  const settings = useSettings();
  const transport = useMemo(() => resolveTransport(settings), [settings]);
  const plants = useLiveQuery(() => db.plants.orderBy("name").toArray(), []) ?? EMPTY;
  const history =
    useLiveQuery(async (): Promise<HistoryItem[]> => {
      const items = await db.identifications.orderBy("createdAt").reverse().toArray();
      const photos = await db.identificationPhotos.bulkGet(items.map((i) => i.id));
      return items.map((item, i) => ({ ...item, photo: photos[i]?.blob }));
    }, []) ?? EMPTY;

  const [mode, setMode] = useState<Mode>("plante");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idResult, setIdResult] = useState<IdResult | null>(null);
  /** Oppføringen i historikken som det siste svaret er lagret som, hvis brukeren har lagret det. */
  const [recordId, setRecordId] = useState<string | null>(null);
  /** En tidligere identifisering som er åpnet fra historikken. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [plantId, setPlantId] = useState("");
  const [saved, setSaved] = useState(false);
  const [formInitial, setFormInitial] = useState<PlantFormInitial | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canIdentify = !!settings.plantNetApiKey || !!transport;
  const canDiagnose = !!transport;
  const selectedPlant = plants.find((p) => p.id === plantId);
  const viewing = viewingId ? history.find((h) => h.id === viewingId) ?? null : null;
  /** Forslaget det siste svaret er lagret som, så knappen kan vise «Lagret». */
  const savedKey = recordId ? candidateKey(history.find((h) => h.id === recordId)?.candidates[0]) : null;
  const assistantLabel = transport?.label ?? "Claude";
  // Flere bilder og organvalg gjelder bare Pl@ntNet. KI-leverandøren ser på ett bilde, og det gjør sykdomsvurderingen også.
  const multiPhoto = mode === "plante" && !!settings.plantNetApiKey;
  const photo = photos[0]?.blob ?? null;

  useEffect(() => () => abortRef.current?.abort(), []);

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
    let id = recordId;
    if (id) {
      // Nytt forslag i samme oppføring: faktaene hørte til det forrige.
      await db.identifications.update(id, { candidates: [chosen], facts: undefined });
    } else {
      const { record, photo: stored } = await newRecord(photos[0].blob, photos.length, idResult.source, [chosen]);
      await db.transaction("rw", [db.identifications, db.identificationPhotos], async () => {
        await db.identifications.add(record);
        await db.identificationPhotos.put({ id: record.id, blob: stored });
      });
      id = record.id;
      setRecordId(id);
    }
    // Fulle plantefakta hentes i bakgrunnen, så de ligger klare når oppføringen åpnes.
    ensureIdentificationFacts(id).catch(() => undefined);
  }

  function startAdd(c: PlantCandidate, photoBlob: Blob | null) {
    setFormInitial({ name: c.name, latinName: c.latinName, variety: c.variety, category: c.category ?? inferCategory(c.latinName), photo: photoBlob ?? undefined });
  }

  /** Tilbake til start: ingen bilder, ingen svar, ingen åpnet oppføring. */
  function reset() {
    cancel();
    setMode("plante");
    setPhotos([]);
    setIdResult(null);
    setRecordId(null);
    setViewingId(null);
    setDiagnosis(null);
    setError(null);
    setSaved(false);
  }

  // Et trykk på Identifiser i menyen mens skjermen alt er åpen, starter på nytt.
  useEffect(() => {
    const onReselect = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== "/identifiser/") return;
      reset();
      window.scrollTo({ top: 0 });
    };
    window.addEventListener(TAB_RESELECT_EVENT, onReselect);
    return () => window.removeEventListener(TAB_RESELECT_EVENT, onReselect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Startes bare fra knappen, så brukeren bestemmer selv når Pl@ntNet og KI-leverandøren spørres. */
  async function analyse() {
    cancel();
    if (photos.length === 0) return;
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    if (mode === "plante" ? !canIdentify : !canDiagnose) return;
    setBusy(true);
    try {
      if (mode === "plante") {
        if (settings.plantNetApiKey) {
          const result = await identifyPlantPhotos(settings.plantNetApiKey, photos, ac.signal);
          let found = result.candidates;
          if (transport && found.length > 0) found = await enrichCandidates(transport, found, ac.signal);
          if (ac.signal.aborted) return;
          found = found.map(withListedFacts);
          setIdResult({ candidates: found, remaining: result.remaining, source: "plantnet" });
          if (found.length === 0) setError(`Pl@ntNet fant ingen plante i ${photos.length > 1 ? "bildene" : "bildet"}. Prøv et nærmere bilde av blad, blomst eller frukt.`);
        } else if (transport) {
          let found = await identifyPlantWithVision(transport, photos[0].blob, ac.signal);
          if (found.length > 0) found = await enrichCandidates(transport, found, ac.signal);
          if (ac.signal.aborted) return;
          found = found.map(withListedFacts);
          setIdResult({ candidates: found, source: "ki" });
          if (found.length === 0) setError(`${transport.label} kjente ikke igjen noen plante i bildet. Prøv et nærmere bilde.`);
        }
      } else if (transport) {
        setDiagnosis("");
        setSaved(false);
        await diagnosePlant({ transport, file: photos[0].blob, settings, plant: selectedPlant, signal: ac.signal, onText: setDiagnosis });
      }
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      if (!ac.signal.aborted) setBusy(false);
    }
  }

  /** Bildene er endret: svarene gjelder ikke lenger, og et oppslag som pågår avbrytes. */
  function changePhotos(next: PickedPhoto[]) {
    cancel();
    setPhotos(next);
    setIdResult(null);
    setRecordId(null);
    setDiagnosis(null);
    setError(null);
    setSaved(false);
  }

  function onFile(files: FileList | null) {
    const picked = [...(files ?? [])].map((blob): PickedPhoto => ({ id: newId(), blob, organ: "auto" }));
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;
    setViewingId(null);
    // Med Pl@ntNet legges bildene til, opptil fem. Ellers erstatter det nye bildet det gamle.
    changePhotos(multiPhoto ? [...photos, ...picked].slice(0, MAX_IDENTIFY_PHOTOS) : picked.slice(0, 1));
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

  async function forget(id: string) {
    await db.transaction("rw", [db.identifications, db.identificationPhotos], async () => {
      await db.identifications.delete(id);
      await db.identificationPhotos.delete(id);
    });
    if (viewingId === id) setViewingId(null);
  }

  const waitingLabel = multiPhoto ? `Pl@ntNet ser på ${photos.length > 1 ? "bildene" : "bildet"} ...` : `${transport?.label ?? "KI"} ser på bildet ...`;
  const canRun = mode === "plante" ? canIdentify : canDiagnose;

  return (
    <>
      <PageHeader title="Identifiser" subtitle={mode === "sykdom" ? "Hva feiler planten?" : viewing ? "Tidligere identifisering" : "Hvilken plante er dette?"} />
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

        <input ref={inputRef} type="file" accept="image/*" multiple={multiPhoto} className="hidden" onChange={(e) => onFile(e.target.files)} />

        {mode === "plante" && viewing ? (
          <RecordView
            key={viewing.id}
            record={viewing}
            plants={plants}
            zone={settings.climateZone}
            hasTransport={!!transport}
            assistantLabel={assistantLabel}
            onAdd={(c) => startAdd(c, viewing.photo ?? null)}
            onNew={() => {
              setViewingId(null);
              inputRef.current?.click();
            }}
            onClose={() => setViewingId(null)}
            onDelete={() => forget(viewing.id)}
          />
        ) : (
          <>
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

            {photos.length > 0 ? (
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
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center active:bg-muted/60"
              >
                <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Camera className="size-7" />
                </span>
                <span className="font-medium">Ta bilde eller velg fra bilder</span>
                <span className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {mode === "plante" ? "Nærbilde av blad, blomst eller frukt gir best treff." : "Ta bildet nært det som ser galt ut: flekker, blader eller skudd."}
                </span>
              </button>
            )}

            {photos.length > 0 && (
              <>
                {multiPhoto && (
                  <p className="-mt-2 px-1 text-xs text-muted-foreground">
                    Opptil {MAX_IDENTIFY_PHOTOS} bilder av samme plante. Flere bilder, og riktig valg av hva de viser, gir sikrere treff. Auto lar Pl@ntNet avgjøre det selv.
                  </p>
                )}
                {!multiPhoto && photos.length > 1 && <p className="-mt-2 px-1 text-xs text-muted-foreground">Her brukes bare det første bildet.</p>}
                <div className="flex gap-2">
                  {multiPhoto ? (
                    <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" disabled={photos.length >= MAX_IDENTIFY_PHOTOS} onClick={() => inputRef.current?.click()}>
                      <ImagePlus data-icon="inline-start" /> Legg til bilde
                    </Button>
                  ) : (
                    <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" onClick={() => inputRef.current?.click()}>
                      <Camera data-icon="inline-start" /> Nytt bilde
                    </Button>
                  )}
                  {canRun && (
                    <Button className="h-11 flex-1 rounded-xl" disabled={busy} onClick={analyse}>
                      {busy ? (
                        <Loader2 className="animate-spin" data-icon="inline-start" />
                      ) : mode === "plante" ? (
                        <Search data-icon="inline-start" />
                      ) : diagnosis ? (
                        <RefreshCw data-icon="inline-start" />
                      ) : (
                        <Stethoscope data-icon="inline-start" />
                      )}
                      {mode === "plante" ? "Identifiser" : diagnosis ? "Analyser på nytt" : "Analyser"}
                    </Button>
                  )}
                </div>
              </>
            )}

            {mode === "plante" && !canIdentify && (
              <SetupNotice text="For å identifisere planter trenger du en gratis Pl@ntNet-nøkkel, eller en KI-leverandør med en modell som tåler bilder (Gemini Flash)." />
            )}
            {mode === "sykdom" && !canDiagnose && <SetupNotice text="For å vurdere sykdom trenger du en KI-leverandør med en modell som tåler bilder, for eksempel Gemini Flash." />}

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
                    onSave={() =>
                      saveChoice(c)
                        .then(() => {
                          // Lagret: tilbake til start, der oppføringen nå ligger øverst i historikken.
                          reset();
                          window.scrollTo({ top: 0 });
                        })
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

            {mode === "plante" && photos.length === 0 && history.length > 0 && <HistoryList items={history} plants={plants} onOpen={setViewingId} />}
          </>
        )}
      </Page>

      <PlantForm
        open={formInitial !== null}
        onOpenChange={(o) => {
          if (!o) setFormInitial(null);
        }}
        initial={formInitial ?? undefined}
        onSaved={(p) => {
          // Er identifiseringen lagret i historikken, får oppføringen en lenke til planten.
          const id = viewingId ?? recordId;
          if (id) db.identifications.update(id, { plantId: p.id }).catch(() => undefined);
          router.push(`/plante/?id=${p.id}`);
        }}
      />
    </>
  );
}

/** Tidligere identifiseringer, nyeste først. */
function HistoryList({ items, plants, onOpen }: { items: HistoryItem[]; plants: Plant[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="inline-flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <History className="size-3.5" /> Tidligere identifiseringer
      </p>
      <Card className="py-0">
        <ul className="divide-y divide-border">
          {items.map((h) => {
            const top = h.candidates[0];
            const added = h.plantId ? plants.find((p) => p.id === h.plantId) : undefined;
            return (
              <li key={h.id}>
                <button type="button" onClick={() => onOpen(h.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <BlobImage blob={h.photo} alt="" className="size-12 shrink-0 rounded-lg bg-muted object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{top?.name ?? "Ingen treff"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {top?.latinName && <span className="italic">{top.latinName} · </span>}
                      {formatRelative(h.createdAt)}
                    </span>
                    {added && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <Check className="size-3" /> I hagen som {plantTitle(added)}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/** En tidligere identifisering: bildet, forslagene og mulighet for å slette den. */
function RecordView({
  record,
  plants,
  zone,
  hasTransport,
  assistantLabel,
  onAdd,
  onNew,
  onClose,
  onDelete,
}: {
  record: HistoryItem;
  plants: Plant[];
  zone?: string;
  hasTransport: boolean;
  assistantLabel: string;
  onAdd: (candidate: PlantCandidate) => void;
  onNew: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const added = record.plantId ? plants.find((p) => p.id === record.plantId) : undefined;
  const chosen = record.candidates[0];
  /** Hvorfor siste oppslag feilet. Null mens det pågår eller har lyktes. */
  const [factsError, setFactsError] = useState<string | null>(null);
  const needFacts = !record.facts && hasTransport;
  const factsBusy = needFacts && factsError === null;

  // Mangler faktaene (oppslaget feilet, eller leverandøren kom til senere), prøves det igjen når oppføringen åpnes.
  // Pågår oppslaget alt fra lagringen, deles det kallet.
  useEffect(() => {
    if (!needFacts || factsError !== null) return;
    let cancelled = false;
    ensureIdentificationFacts(record.id)
      .then(() => db.identifications.get(record.id))
      .then((fresh) => {
        if (!cancelled && !fresh?.facts) setFactsError("Fikk ikke hentet plantefakta nå.");
      })
      .catch((err: unknown) => {
        if (!cancelled) setFactsError(err instanceof Error && err.message ? err.message : "Fikk ikke hentet plantefakta nå.");
      });
    return () => {
      cancelled = true;
    };
  }, [record.id, needFacts, factsError]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {formatDate(record.createdAt)} · {record.source === "plantnet" ? "Pl@ntNet" : "KI"}
        </p>
        <Button variant="ghost" size="icon-lg" className="-mr-2 rounded-full" aria-label="Tilbake til historikken" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
        <BlobImage blob={record.photo} alt="Bildet som ble identifisert" className="size-full object-cover" />
      </div>
      {record.photoCount > 1 && <p className="-mt-1 px-1 text-xs text-muted-foreground">Første av {record.photoCount} bilder som ble sendt.</p>}
      {added && (
        <Link href={`/plante/?id=${added.id}`} className="inline-flex items-center gap-1.5 px-1 text-sm font-medium text-primary">
          <Check className="size-4" /> Lagt til i hagen som {plantTitle(added)}. Åpne planten.
        </Link>
      )}
      {chosen && (
        <>
          <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lagret som</p>
          <CandidateCard candidate={chosen} plants={plants} zone={zone} assistantLabel={assistantLabel} onAdd={() => onAdd(chosen)} />
          <FactsCard subject={{ name: chosen.name, latinName: chosen.latinName, category: chosen.category, facts: record.facts }} />
          {!record.facts && factsBusy && (
            <p className="inline-flex items-center gap-2 px-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Henter plantefakta fra {assistantLabel} ...
            </p>
          )}
          {!record.facts && factsError !== null && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">Plantefakta: {factsError}</p>
              <Button variant="outline" size="sm" className="shrink-0 rounded-lg bg-card" onClick={() => setFactsError(null)}>
                <RefreshCw data-icon="inline-start" /> Prøv igjen
              </Button>
            </div>
          )}
          {!hasTransport && !record.facts && (
            <p className="px-1 text-[11px] text-muted-foreground">Med en KI-leverandør (Innstillinger) får oppføringen de samme plantefaktaene som plantene i hagen.</p>
          )}
        </>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" onClick={onNew}>
          <Camera data-icon="inline-start" /> Ny identifisering
        </Button>
        <Button variant="outline" className="h-11 rounded-xl bg-card text-destructive" onClick={onDelete}>
          <Trash2 data-icon="inline-start" /> Slett
        </Button>
      </div>
    </div>
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
 * Ett forslag med knappene i den rekkefølgen de brukes: lagre i historikken (man identifiserer oftest andre steder enn
 * hjemme), legge til i hagen, og til sist spørre assistenten. Uten `onSave` (åpnet fra historikken) er «Legg til i hagen» først.
 */
function CandidateCard({
  candidate: c,
  plants,
  zone,
  assistantLabel,
  saved = false,
  onSave,
  onAdd,
}: {
  candidate: PlantCandidate;
  plants: Plant[];
  zone?: string;
  assistantLabel: string;
  saved?: boolean;
  onSave?: () => void;
  onAdd: () => void;
}) {
  const candidateCategory = c.category ?? inferCategory(c.latinName);
  const info = candidateCategory ? categoryInfo(candidateCategory) : undefined;
  const latin = c.latinName.toLowerCase();
  const name = c.name.toLowerCase();
  const existing = plants.find((p) => (latin && p.latinName?.toLowerCase() === latin) || p.name.toLowerCase() === name);
  const images = c.images ?? [];
  return (
    <Card className="gap-2 px-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-heading text-base font-medium">{c.name}</p>
        {info && (
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${info.color}1f`, color: info.color }}>
            {info.emoji} {info.label}
          </span>
        )}
      </div>
      {(c.latinName || c.variety) && (
        <p className="-mt-1 text-sm text-muted-foreground">
          <span className="italic">{c.latinName}</span>
          {c.variety ? ` '${c.variety}'` : ""}
        </p>
      )}
      {images.length > 0 && <ImageStrip images={images} name={c.name} />}
      <FactChips facts={c.facts} zone={zone} />
      {c.note && <p className="text-sm text-muted-foreground">{c.note}</p>}
      {existing && (
        <Link href={`/plante/?id=${existing.id}`} className="text-sm font-medium text-primary">
          Du har allerede {existing.name} i hagen. Åpne planten.
        </Link>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          {onSave && (
            <Button className="h-10 flex-1 rounded-xl" disabled={saved} onClick={onSave}>
              {saved ? <Check data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              {saved ? "Lagret" : "Lagre"}
            </Button>
          )}
          <Button variant={onSave ? "outline" : "default"} className={cn("h-10 flex-1 rounded-xl", onSave && "bg-card")} onClick={onAdd}>
            <Plus data-icon="inline-start" /> Legg til i hagen
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 self-start rounded-xl px-2 text-muted-foreground"
          nativeButton={false}
          render={<Link href={assistantHref(undefined, `Fortell meg om ${c.name.toLowerCase()}${c.latinName ? ` (${c.latinName})` : ""}. Passer den i hagen min, og hvordan steller jeg den?`)} />}
        >
          <Sparkles data-icon="inline-start" /> Spør {assistantLabel}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Referansebildene fra Pl@ntNet i en bla-rad. Et trykk gjør dem over dobbelt så store, animert, så detaljene synes.
 * Når brukeren har skrollet videre, så over halve raden er forbi toppen av skjermen, krymper den tilbake av seg selv.
 */
function ImageStrip({ images, name }: { images: CandidateImage[]; name: string }) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!expanded || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Bare når raden forsvinner oppover. Nederst på skjermen kan den godt være delvis skjult mens man ser på den.
        if (entry.intersectionRatio < 0.5 && entry.boundingClientRect.top < 0) setExpanded(false);
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div ref={ref}>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        {images.map((img, i) => (
          <button
            key={`${img.url}|${i}`}
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Vis bildene mindre" : "Vis bildene større"}
            className={cn("shrink-0 overflow-hidden rounded-lg bg-muted transition-[width,height] duration-300 ease-out", expanded ? "h-44 w-44" : "size-20")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`${name}${img.organ ? `, ${organLabel(img.organ)}` : ""}`}
              title={img.author ? `${img.author}${img.license ? ` (${img.license.toUpperCase()})` : ""}` : undefined}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Referansebilder fra Pl@ntNet. Trykk for å se dem større.</p>
    </div>
  );
}

const ORGAN_LABELS: Record<string, string> = { leaf: "blad", flower: "blomst", fruit: "frukt", bark: "bark", habit: "vekstform", other: "annet" };

function organLabel(organ: string): string {
  return ORGAN_LABELS[organ] ?? organ;
}

const TOXICITY_CLASS: Record<ToxicityLevel, string> = {
  meget: "bg-destructive/10 text-destructive",
  giftig: "bg-destructive/10 text-destructive",
  lite: "bg-amber-500/15 text-amber-800",
  ufarlig: "bg-primary/10 text-primary",
  ukjent: "bg-muted text-muted-foreground",
};

/** Livsløp, herdighet målt mot hagens klimasone, og giftighet. Ettårige lever bare én sommer, så de får ingen herdighet. */
function FactChips({ facts, zone }: { facts?: CandidateFacts; zone?: string }) {
  if (!facts || (!facts.lifecycle && !facts.hardiness && !facts.toxicity)) return null;
  const hardiness = facts.lifecycle === "ettårig" ? undefined : facts.hardiness;
  const hardy = hardyIn(hardiness, zone);
  return (
    <div className="flex flex-wrap gap-1.5">
      {facts.lifecycle && <Chip>{LIFECYCLE_LABELS[facts.lifecycle]}</Chip>}
      {hardiness && (
        <Chip className={hardy === true ? "bg-primary/10 text-primary" : hardy === false ? "bg-destructive/10 text-destructive" : undefined}>
          {hardy === true ? <Check className="size-3" /> : hardy === false ? <X className="size-3" /> : null}
          {hardy === true ? `Herdig i ${zone} (${hardiness})` : hardy === false ? `Ikke herdig i ${zone} (${hardiness})` : `Herdighet ${hardiness}`}
        </Chip>
      )}
      {facts.toxicity && <Chip className={TOXICITY_CLASS[facts.toxicity]}>{facts.toxicity === "ukjent" ? "Giftighet ukjent" : TOXICITY_LABELS[facts.toxicity]}</Chip>}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

function SetupNotice({ text }: { text: string }) {
  return (
    <Link href="/innstillinger/" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <KeyRound className="size-5" />
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium">Sett opp i innstillinger</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </Link>
  );
}
