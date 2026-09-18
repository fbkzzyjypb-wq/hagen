"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, ChevronRight, Loader2, Plus, Sparkles, Sprout, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, NativeSelect } from "@/components/fields";
import { PlantThumb } from "@/components/plant-list-item";
import { BlobImage } from "@/components/blob-image";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { newId } from "@/lib/id";
import { useSettings } from "@/lib/settings";
import { resolveTransport } from "@/lib/llm-client";
import { categorizeCandidates, inferCategory, lookupPlant, matchProfile, type PlantCandidate } from "@/lib/plant-lookup";
import { identifyPlantPhotos } from "@/lib/plant-id";
import { compressImage } from "@/lib/images";
import { areaInfo, categoryInfo, PLANT_CATEGORIES, plantTitle, type AreaKind, type Plant, type PlantBed, type PlantCategory } from "@/lib/types";
import { BED_KINDS, bedsOf, createBed } from "@/lib/beds";
import { findProfile, rulesFromProfile, searchProfiles, type PlantProfile } from "@/lib/care-rules";
import { scheduleSyncSoon } from "@/lib/sync";
import { ensurePlantFacts, resetPlantTasks } from "@/lib/plant-facts";

/** Forhåndsutfylling av skjemaet for en ny plante, f.eks. fra bildeidentifisering. */
export type PlantFormInitial = Partial<Pick<Plant, "name" | "latinName" | "variety" | "category" | "beds">> & { photo?: Blob };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plant?: Plant;
  initial?: PlantFormInitial;
  onSaved?: (plant: Plant) => void;
};

export function PlantForm({ open, onOpenChange, plant, initial, onSaved }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        {open && <PlantFormBody plant={plant} initial={initial} onSaved={onSaved} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}

function PlantFormBody({ plant, initial, onSaved, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState(plant?.name ?? initial?.name ?? "");
  const [latinName, setLatinName] = useState(plant?.latinName ?? initial?.latinName ?? "");
  const [variety, setVariety] = useState(plant?.variety ?? initial?.variety ?? "");
  const [category, setCategory] = useState<PlantCategory>(plant?.category ?? initial?.category ?? "staude");
  // Nye planter får inneværende år som forhåndsvalg. Ved redigering vises det som er lagret.
  const [plantedYear, setPlantedYear] = useState(plant ? (plant.plantedYear ? String(plant.plantedYear) : "") : String(new Date().getFullYear()));
  const [quantity, setQuantity] = useState(plant?.quantity && plant.quantity > 1 ? String(plant.quantity) : "1");

  /** Bedene planten står i, med antall per bed. Samme plante kan stå i flere bed. */
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const bedOptions = useMemo(() => bedsOf(areas), [areas]);
  const [bedRows, setBedRows] = useState<{ areaId: string; quantity: string }[]>(() =>
    (plant?.beds ?? initial?.beds ?? []).map((b) => ({ areaId: b.areaId, quantity: String(Math.max(1, b.quantity ?? 1)) }))
  );
  /** Rad som venter på at et nytt bed opprettes. */
  const [newBedFor, setNewBedFor] = useState<number | null>(null);
  const [newBedName, setNewBedName] = useState("");
  const [newBedKind, setNewBedKind] = useState<AreaKind>("bed");
  const bedTotal = bedRows.reduce((sum, r) => sum + Math.max(1, Number(r.quantity) || 1), 0);

  function addBedRow() {
    const unused = bedOptions.find((b) => !bedRows.some((r) => r.areaId === b.id));
    if (unused) {
      setBedRows([...bedRows, { areaId: unused.id, quantity: "1" }]);
    } else {
      setBedRows([...bedRows, { areaId: "", quantity: "1" }]);
      setNewBedFor(bedRows.length);
    }
  }

  function removeBedRow(index: number) {
    setBedRows(bedRows.filter((_, i) => i !== index));
    setNewBedFor((n) => (n === index ? null : n !== null && n > index ? n - 1 : n));
  }

  async function createNewBed() {
    const trimmed = newBedName.trim();
    if (!trimmed || newBedFor === null) return;
    const bed = await createBed(trimmed, newBedKind);
    setBedRows((rows) => rows.map((r, i) => (i === newBedFor ? { ...r, areaId: bed.id } : r)));
    setNewBedFor(null);
    setNewBedName("");
    setNewBedKind("bed");
  }
  const [notes, setNotes] = useState(plant?.notes ?? "");
  const [profileKey, setProfileKey] = useState<string | undefined>(plant?.profileKey);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  const settings = useSettings();
  const transport = useMemo(() => resolveTransport(settings), [settings]);
  /** Navnet slik brukeren selv har skrevet det. null når det kom fra et forslag. Styrer KI-oppslaget. */
  const [typedName, setTypedName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PlantCandidate[]>([]);
  /** Spørringen kandidatene gjelder, så vi kan si «fant ingen» for riktig navn. */
  const [lookedUp, setLookedUp] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lookupSeq = useRef(0);
  const manualAbort = useRef<AbortController | null>(null);

  /** Bilde tatt i skjemaet: brukes til identifisering og lagres på planten. */
  const [photo, setPhoto] = useState<Blob | null>(initial?.photo ?? null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const identifyAbort = useRef<AbortController | null>(null);

  const suggestions = useMemo(() => (showSuggestions && !plant ? searchProfiles(name) : []), [name, showSuggestions, plant]);
  const query = name.trim();

  // Planter du allerede har med lignende navn, så du ser dem før du legger inn en til.
  const allPlants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const existing = useMemo(() => {
    const q = query.toLowerCase();
    if (q.length < 2) return [];
    return allPlants
      .filter((p) => {
        if (p.id === plant?.id) return false;
        const n = p.name.toLowerCase();
        return n.includes(q) || (n.length >= 3 && q.includes(n)) || (p.latinName?.toLowerCase().includes(q) ?? false);
      })
      .slice(0, 3);
  }, [allPlants, query, plant]);

  const runLookup = useCallback(
    async (q: string, ac: AbortController) => {
      const seq = ++lookupSeq.current;
      setLooking(true);
      setLookupError(null);
      try {
        const found = await lookupPlant(transport, q, ac.signal);
        if (ac.signal.aborted) return;
        setCandidates(found);
        setLookedUp(q);
      } catch (err) {
        if (!ac.signal.aborted) setLookupError(err instanceof Error ? err.message : "Oppslaget feilet. Prøv igjen.");
      } finally {
        if (seq === lookupSeq.current) setLooking(false);
      }
    },
    [transport]
  );

  // Slår opp automatisk litt etter at du slutter å skrive, når den innebygde listen ikke har treff.
  useEffect(() => {
    if (typedName === null || latinName.trim()) return;
    const q = typedName.trim();
    if (q.length < 4 || searchProfiles(q).length > 0) return;
    const ac = new AbortController();
    const timer = setTimeout(() => runLookup(q, ac), 900);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [typedName, latinName, transport, runLookup]);

  useEffect(
    () => () => {
      manualAbort.current?.abort();
      identifyAbort.current?.abort();
    },
    []
  );

  async function onPhoto(files: FileList | null) {
    const file = files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    setPhoto(file);
    setIdentifyError(null);
    setRemaining(null);
    if (!settings.plantNetApiKey) {
      setIdentifyError("no-key");
      return;
    }
    identifyAbort.current?.abort();
    const ac = new AbortController();
    identifyAbort.current = ac;
    setIdentifying(true);
    setShowSuggestions(false);
    resetLookup();
    try {
      const result = await identifyPlantPhotos(settings.plantNetApiKey, [{ blob: file, organ: "auto" }], ac.signal);
      if (ac.signal.aborted) return;
      let found = result.candidates;
      if (transport && found.length > 0) found = await categorizeCandidates(transport, found, ac.signal);
      if (ac.signal.aborted) return;
      setCandidates(found);
      setLookedUp(null);
      setTypedName(null);
      setRemaining(result.remaining ?? null);
      if (found.length === 0) setIdentifyError("Pl@ntNet fant ingen plante i bildet. Prøv et nærmere bilde av blad, blomst eller frukt.");
    } catch (err) {
      if (!ac.signal.aborted) setIdentifyError(err instanceof Error ? err.message : "Identifiseringen feilet. Prøv igjen.");
    } finally {
      if (!ac.signal.aborted) setIdentifying(false);
    }
  }

  function removePhoto() {
    identifyAbort.current?.abort();
    setPhoto(null);
    setIdentifying(false);
    setIdentifyError(null);
    setRemaining(null);
  }

  function lookupNow() {
    manualAbort.current?.abort();
    const ac = new AbortController();
    manualAbort.current = ac;
    setShowSuggestions(false);
    runLookup(query, ac);
  }

  function resetLookup() {
    setCandidates([]);
    setLookedUp(null);
    setLookupError(null);
  }

  function applyProfile(p: PlantProfile) {
    setName(p.name);
    setLatinName(p.latinName);
    setCategory(p.category);
    setProfileKey(p.key);
    setShowSuggestions(false);
    setTypedName(null);
    resetLookup();
  }

  function applyCandidate(c: PlantCandidate) {
    setName(c.name);
    setLatinName(c.latinName);
    setVariety(c.variety ?? "");
    // Forslag uten kategori (Pl@ntNet og Artsdatabanken uten KI-svar) skal ikke bli stående som standardvalget «Staude».
    const candidateCategory = c.category ?? inferCategory(c.latinName);
    if (candidateCategory) setCategory(candidateCategory);
    const profile = plant ? undefined : matchProfile({ ...c, category: candidateCategory });
    setProfileKey(profile && profile.category === (candidateCategory ?? category) ? profile.key : undefined);
    setShowSuggestions(false);
    setTypedName(null);
    resetLookup();
  }

  const noMatch = lookedUp !== null && lookedUp === query && candidates.length === 0 && !looking && !lookupError;
  // Ingen oppslagsknapp rett etter at et forslag er valgt; den kommer tilbake når du skriver videre.
  const canLookup = query.length >= 3 && !profileKey && candidates.length === 0 && !noMatch && (typedName !== null || !!plant);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    const now = Date.now();
    try {
      const photoBlobs = photo ? await Promise.all([compressImage(photo, 1600, 0.82), compressImage(photo, 320, 0.75)]) : null;
      const beds: PlantBed[] = bedRows.filter((r) => r.areaId).map((r) => ({ areaId: r.areaId, quantity: Math.max(1, Number(r.quantity) || 1) }));
      const total = beds.length > 0 ? beds.reduce((sum, b) => sum + (b.quantity ?? 1), 0) : Number(quantity) || 1;
      if (plant) {
        const updated: Plant = {
          ...plant,
          name: name.trim(),
          latinName: latinName.trim() || undefined,
          variety: variety.trim() || undefined,
          category,
          plantedYear: plantedYear ? Number(plantedYear) : undefined,
          quantity: total >= 2 ? total : undefined,
          beds: beds.length > 0 ? beds : undefined,
          notes: notes.trim() || undefined,
          updatedAt: now,
        };
        await db.plants.put(updated);
        if (plant.category !== category) await resetPlantTasks(plant.id);
        if (photoBlobs) await db.photos.add({ id: newId(), plantId: plant.id, blob: photoBlobs[0], thumb: photoBlobs[1], takenAt: now });
        onSaved?.(updated);
      } else {
        const created: Plant = {
          id: newId(),
          name: name.trim(),
          latinName: latinName.trim() || undefined,
          variety: variety.trim() || undefined,
          category,
          plantedYear: plantedYear ? Number(plantedYear) : undefined,
          quantity: total >= 2 ? total : undefined,
          beds: beds.length > 0 ? beds : undefined,
          notes: notes.trim() || undefined,
          profileKey,
          createdAt: now,
          updatedAt: now,
        };
        const profile = findProfile(profileKey);
        await db.transaction("rw", [db.plants, db.rules, db.photos], async () => {
          await db.plants.add(created);
          if (profile && profile.category === category) {
            await db.rules.bulkAdd(rulesFromProfile(profile, created.id, now, newId));
          }
          if (photoBlobs) await db.photos.add({ id: newId(), plantId: created.id, blob: photoBlobs[0], thumb: photoBlobs[1], takenAt: now });
        });
        onSaved?.(created);
      }
      scheduleSyncSoon();
      ensurePlantFacts().catch(() => undefined);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <SheetHeader className="px-0">
          <SheetTitle className="text-lg">{plant ? "Rediger plante" : "Ny plante"}</SheetTitle>
          <SheetDescription>
            {plant
              ? "Oppdater informasjonen om planten."
              : transport
                ? "Skriv navnet slik du husker det, så foreslår vi planten med latinsk navn, sort og kategori."
                : "Begynn å skrive navnet, så foreslår vi kjente planter med ferdig stell-kalender."}
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field
            label="Navn"
            htmlFor="plant-name"
            hint={latinName.trim() ? "Navnet er ditt eget og kan endres fritt. Sorten vises automatisk etter navnet, som Eple 'Elstar'." : undefined}
          >
            <div className="flex gap-2">
              <Input
                id="plant-name"
                value={name}
                autoComplete="off"
                onChange={(e) => {
                  setName(e.target.value);
                  setTypedName(e.target.value);
                  setShowSuggestions(true);
                  if (profileKey) setProfileKey(undefined);
                  resetLookup();
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="F.eks. Bøkehekk"
                className="h-11 flex-1 rounded-lg"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="size-11 shrink-0 rounded-lg bg-card"
                aria-label="Identifiser fra bilde"
                disabled={identifying}
                onClick={() => photoInputRef.current?.click()}
              >
                {identifying ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
              </Button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files)} />
            </div>

            {photo && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
                <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <BlobImage blob={photo} alt="Bilde av planten" className="size-full object-cover" />
                </div>
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {identifying ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Pl@ntNet ser på bildet ...
                    </span>
                  ) : (
                    <>
                      Bildet lagres på planten når du lagrer.
                      {remaining !== null ? ` ${remaining} oppslag igjen hos Pl@ntNet i dag.` : ""}
                    </>
                  )}
                </p>
                <button type="button" aria-label="Fjern bildet" onClick={removePhoto} className="shrink-0 p-2 text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              </div>
            )}
            {identifyError === "no-key" ? (
              <p className="text-xs text-muted-foreground">
                For å identifisere planten fra bildet trenger du en gratis nøkkel fra Pl@ntNet.{" "}
                <Link href="/innstillinger/" onClick={() => onOpenChange(false)} className="font-medium text-primary underline underline-offset-2">
                  Legg den inn i innstillinger
                </Link>
                . Bildet lagres uansett på planten.
              </p>
            ) : identifyError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{identifyError}</p>
            ) : null}

            {existing.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-900">
                  <Sprout className="size-3.5" /> {existing.length === 1 ? "Denne har du allerede i hagen" : "Disse har du allerede i hagen"}
                </p>
                <ul className="flex flex-col gap-1">
                  {existing.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/plante/?id=${p.id}`}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center gap-2.5 rounded-lg bg-card px-2 py-1.5 ring-1 ring-foreground/5 active:bg-muted/60"
                      >
                        <PlantThumb plant={p} className="size-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{plantTitle(p)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.latinName ? <span className="italic">{p.latinName}</span> : categoryInfo(p.category).label}
                            {p.plantedYear ? ` · plantet ${p.plantedYear}` : ""}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground/60" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] text-amber-900/80">Trykk for å åpne planten. Du kan fortsatt legge til en ny med samme navn.</p>
              </div>
            )}

            {suggestions.length > 0 && (
              <div>
                <p className="mb-1 px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Kjente planter med stell-kalender</p>
                <ul className="overflow-hidden rounded-xl border border-border bg-card">
                  {suggestions.map((s) => (
                    <li key={s.key} className="border-b border-border last:border-b-0">
                      <button type="button" onClick={() => applyProfile(s)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
                        <span className="font-medium">{s.name}</span>
                        <span className="truncate text-xs text-muted-foreground italic">{s.latinName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {looking ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Slår opp «{query}»{transport ? ` i Artsdatabanken og hos ${transport.label}` : " i Artsdatabanken"} ...
              </p>
            ) : canLookup ? (
              <button type="button" onClick={lookupNow} className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline">
                <Sparkles className="size-3.5" /> Slå opp «{query}»
              </button>
            ) : !transport && !plant && !query ? (
              <p className="text-xs text-muted-foreground">Navnet slås opp i Artsdatabanken. Med en KI-leverandør (Innstillinger) fylles også kategori og sort ut.</p>
            ) : null}

            {lookupError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {lookupError}{" "}
                <button type="button" onClick={lookupNow} className="font-medium underline underline-offset-2">
                  Prøv igjen
                </button>
              </p>
            )}
            {noMatch && (
              <p className="text-xs text-muted-foreground">
                Fant ingen plante som heter «{lookedUp}». Sjekk stavemåten, prøv det latinske navnet, eller{" "}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${lookedUp} latinsk navn`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  søk på nettet
                </a>
                .
              </p>
            )}

            {candidates.length > 0 && (
              <ul className="flex flex-col gap-1.5" aria-label="Forslag fra KI">
                {candidates.map((c, i) => {
                  const candidateCategory = c.category ?? inferCategory(c.latinName);
                  const info = candidateCategory ? categoryInfo(candidateCategory) : undefined;
                  return (
                    <li key={`${c.name}|${c.latinName}|${c.variety ?? ""}|${i}`}>
                      <button type="button" onClick={() => applyCandidate(c)} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{c.name}</span>
                          {info ? (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${info.color}1f`, color: info.color }}>
                              {info.emoji} {info.label}
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Velg kategori</span>
                          )}
                        </span>
                        {(c.latinName || c.variety) && (
                          <span className="block text-xs text-muted-foreground">
                            <span className="italic">{c.latinName}</span>
                            {c.variety ? ` '${c.variety}'` : ""}
                          </span>
                        )}
                        {c.note && <span className="mt-0.5 block text-xs text-muted-foreground">{c.note}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          <Field label="Kategori" htmlFor="plant-category">
            <NativeSelect id="plant-category" value={category} onChange={(e) => setCategory(e.target.value as PlantCategory)}>
              {PLANT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Plantet år" htmlFor="plant-year">
              <Input
                id="plant-year"
                inputMode="numeric"
                value={plantedYear}
                onChange={(e) => setPlantedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={String(new Date().getFullYear())}
                className="h-11 rounded-lg"
              />
            </Field>
            {bedRows.length === 0 && (
              <Field label="Antall" htmlFor="plant-quantity" hint="F.eks. 28 for en hekk med 28 trær.">
                <Input
                  id="plant-quantity"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  onBlur={() => !Number(quantity) && setQuantity("1")}
                  className="h-11 rounded-lg"
                />
              </Field>
            )}
          </div>

          <Field label="Bed" hint={bedRows.length > 1 ? `Totalt ${bedTotal} stk.` : "Samme plante kan stå i flere bed, med antall per bed."}>
            <div className="flex flex-col gap-2">
              {bedRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <NativeSelect
                      aria-label="Bed"
                      value={newBedFor === i ? "__new" : row.areaId}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__new") {
                          setNewBedFor(i);
                          setBedRows((rows) => rows.map((r, j) => (j === i ? { ...r, areaId: "" } : r)));
                        } else {
                          setNewBedFor((n) => (n === i ? null : n));
                          setBedRows((rows) => rows.map((r, j) => (j === i ? { ...r, areaId: v } : r)));
                        }
                      }}
                    >
                      <option value="">Velg bed ...</option>
                      {bedOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                      <option value="__new">Nytt bed ...</option>
                    </NativeSelect>
                  </div>
                  <Input
                    aria-label="Antall i bedet"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setBedRows((rows) => rows.map((r, j) => (j === i ? { ...r, quantity: v } : r)));
                    }}
                    onBlur={() => !Number(row.quantity) && setBedRows((rows) => rows.map((r, j) => (j === i ? { ...r, quantity: "1" } : r)))}
                    className="h-11 w-20 shrink-0 rounded-lg text-center"
                  />
                  <button type="button" aria-label="Fjern fra bedet" onClick={() => removeBedRow(i)} className="shrink-0 p-2 text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              {newBedFor !== null && (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
                  <Input
                    value={newBedName}
                    onChange={(e) => setNewBedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createNewBed();
                      }
                    }}
                    placeholder="Navn på bedet, f.eks. Eplehekken"
                    className="h-11 rounded-lg bg-card"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <NativeSelect aria-label="Type bed" value={newBedKind} onChange={(e) => setNewBedKind(e.target.value as AreaKind)}>
                        {BED_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {areaInfo(k).label}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <Button type="button" className="h-11 rounded-lg" disabled={!newBedName.trim()} onClick={createNewBed}>
                      Opprett
                    </Button>
                  </div>
                </div>
              )}
              <button type="button" onClick={addBedRow} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
                <Plus className="size-4" /> {bedRows.length > 0 ? "Legg til i et bed til" : "Legg i et bed"}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latinsk navn" htmlFor="plant-latin">
              <Input id="plant-latin" value={latinName} onChange={(e) => setLatinName(e.target.value)} placeholder="Valgfritt" className="h-11 rounded-lg" />
            </Field>
            <Field label="Sort" htmlFor="plant-variety">
              <Input id="plant-variety" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="F.eks. 'Aroma'" className="h-11 rounded-lg" />
            </Field>
          </div>

          <Field label="Notater" htmlFor="plant-notes">
            <Textarea id="plant-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Hvor kjøpt, spesielle hensyn ..." className="resize-none rounded-lg text-base" />
          </Field>

          {profileKey && !plant && (
            <p className="rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
              Stell-kalender for {findProfile(profileKey)?.name} legges inn automatisk.
            </p>
          )}

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={!name.trim() || saving}>
            {plant ? "Lagre endringer" : "Legg til plante"}
          </Button>
        </form>
    </>
  );
}
