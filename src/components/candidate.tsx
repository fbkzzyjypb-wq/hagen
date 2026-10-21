"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Info, Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FactsCard } from "@/components/plant-facts-card";
import { assistantHref } from "@/components/ask-claude";
import { fetchCandidateFacts, hardyIn } from "@/lib/plant-facts";
import { inferCategory, type CandidateImage, type PlantCandidate } from "@/lib/plant-lookup";
import { categoryInfo, LIFECYCLE_LABELS, TOXICITY_LABELS, type CandidateFacts, type Plant, type PlantFacts, type ToxicityLevel } from "@/lib/types";

/** Bitene som viser et forslag, delt mellom forslagskortet på Identifiser og siden for en lagret identifisering. */

/** En plante i hagen med samme latinske eller norske navn som forslaget. */
export function findExisting(plants: Plant[], c: PlantCandidate): Plant | undefined {
  const latin = c.latinName.toLowerCase();
  const name = c.name.toLowerCase();
  return plants.find((p) => (latin && p.latinName?.toLowerCase() === latin) || p.name.toLowerCase() === name);
}

/** Det ferdige spørsmålet til assistenten om et forslag. */
export function askAbout(c: PlantCandidate): string {
  return `Fortell meg om ${c.name.toLowerCase()}${c.latinName ? ` (${c.latinName})` : ""}. Passer den i hagen min, og hvordan steller jeg den?`;
}

/** Livsløpet som pille: «Ettårig», «Toårig» eller «Flerårig». Null når det ikke er kjent. */
export function lifecyclePill(facts?: CandidateFacts): React.ReactNode {
  return facts?.lifecycle ? <Chip>{LIFECYCLE_LABELS[facts.lifecycle]}</Chip> : null;
}

/** Kategorien som farget pille. Har ikke forslaget noen, utledes den fra det latinske navnet. Null uten kategori. */
export function categoryPill(c: PlantCandidate): React.ReactNode {
  const category = c.category ?? inferCategory(c.latinName);
  const info = category ? categoryInfo(category) : undefined;
  if (!info) return null;
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: `${info.color}1f`, color: info.color }}>
      {info.emoji} {info.label}
    </span>
  );
}

/**
 * Referansebildene fra Pl@ntNet i en bla-rad. Et trykk gjør dem over dobbelt så store, animert, så detaljene synes.
 * Når brukeren har skrollet videre, så over halve raden er forbi toppen av skjermen, krymper den tilbake av seg selv.
 * Raden går ut til kantene av en beholder med 16 px sidemarg (et kort, eller siden selv).
 */
export function ImageStrip({ images, name }: { images: CandidateImage[]; name: string }) {
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

/**
 * Livsløp, herdighet målt mot hagens klimasone, og giftighet. Ettårige lever bare én sommer, så de får ingen herdighet.
 * `leading` legges først i raden, for eksempel kategoripillen. Livsløpet utelates med `showLifecycle` false, når det
 * alt vises et annet sted. Ingenting vises når det ikke finnes noe å vise.
 */
export function FactChips({ facts, zone, leading, showLifecycle = true }: { facts?: CandidateFacts; zone?: string; leading?: React.ReactNode; showLifecycle?: boolean }) {
  const hardiness = facts?.lifecycle === "ettårig" ? undefined : facts?.hardiness;
  const lifecycle = showLifecycle ? facts?.lifecycle : undefined;
  if (!leading && !lifecycle && !hardiness && !facts?.toxicity) return null;
  const hardy = hardyIn(hardiness, zone);
  return (
    <div className="flex flex-wrap gap-1.5">
      {leading}
      {lifecycle && <Chip>{LIFECYCLE_LABELS[lifecycle]}</Chip>}
      {hardiness && (
        <Chip className={hardy === true ? "bg-primary/10 text-primary" : hardy === false ? "bg-destructive/10 text-destructive" : undefined}>
          {hardy === true ? <Check className="size-3" /> : hardy === false ? <X className="size-3" /> : null}
          {hardy === true ? `Herdig i ${zone} (${hardiness})` : hardy === false ? `Ikke herdig i ${zone} (${hardiness})` : `Herdighet ${hardiness}`}
        </Chip>
      )}
      {facts?.toxicity && <Chip className={TOXICITY_CLASS[facts.toxicity]}>{facts.toxicity === "ukjent" ? "Giftighet ukjent" : TOXICITY_LABELS[facts.toxicity]}</Chip>}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium", className)}>{children}</span>;
}

/** Fulle plantefakta hentet for et forslag med «Hent info», før det eventuelt lagres. */
export type CandidateInfo = { status: "busy" } | { status: "done"; facts: PlantFacts } | { status: "error"; message: string };

/** Navn og latinsk navn, så samme forslag kjennes igjen på tvers av lister. */
export function candidateKey(c: PlantCandidate | undefined): string | null {
  return c ? `${c.name.toLowerCase()}|${c.latinName.toLowerCase()}` : null;
}

/**
 * «Hent info» per forslag: fulle plantefakta vist i kortet uten å lagre noe. Gir faktaene per forslag, funksjonen som
 * henter dem, og en som tømmer alt (når bildene byttes).
 */
export function useCandidateInfo(): [Record<string, CandidateInfo>, (c: PlantCandidate) => void, () => void] {
  const [infoByKey, setInfoByKey] = useState<Record<string, CandidateInfo>>({});
  const fetchInfo = useCallback((c: PlantCandidate) => {
    const key = candidateKey(c) ?? "";
    setInfoByKey((m) => ({ ...m, [key]: { status: "busy" } }));
    fetchCandidateFacts(c)
      .then((facts) => setInfoByKey((m) => ({ ...m, [key]: { status: "done", facts } })))
      .catch((err: unknown) =>
        setInfoByKey((m) => ({ ...m, [key]: { status: "error", message: err instanceof Error && err.message ? err.message : "Fikk ikke hentet plantefakta nå." } }))
      );
  }, []);
  const reset = useCallback(() => setInfoByKey({}), []);
  return [infoByKey, fetchInfo, reset];
}

export function FactsHint() {
  return <p className="px-1 text-[11px] text-muted-foreground">Med en KI-leverandør (Innstillinger) vises også giftighet, herdighet og livsløp for forslagene.</p>;
}

/**
 * Ett forslag, med livsløpet øverst til høyre (om planten kommer igjen er det første en hageeier lurer på) og kategorien
 * blant kortfaktaene. Knappene står i den rekkefølgen de brukes: lagre i historikken (man identifiserer oftest andre
 * steder enn hjemme), legge til i hagen, og til sist spørre assistenten. Brukes på Identifiser og på en ulagret
 * oppføring i historikken.
 */
export function CandidateCard({
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
