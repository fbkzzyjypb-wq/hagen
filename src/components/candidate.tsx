"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "cn";
import { hardyIn } from "@/lib/plant-facts";
import { inferCategory, type CandidateImage, type PlantCandidate } from "@/lib/plant-lookup";
import { categoryInfo, LIFECYCLE_LABELS, TOXICITY_LABELS, type CandidateFacts, type Plant, type ToxicityLevel } from "@/lib/types";

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
 * `leading` legges først i raden, for eksempel kategoripillen. Ingenting vises når det ikke finnes noe å vise.
 */
export function FactChips({ facts, zone, leading }: { facts?: CandidateFacts; zone?: string; leading?: React.ReactNode }) {
  const hardiness = facts?.lifecycle === "ettårig" ? undefined : facts?.hardiness;
  if (!leading && !facts?.lifecycle && !hardiness && !facts?.toxicity) return null;
  const hardy = hardyIn(hardiness, zone);
  return (
    <div className="flex flex-wrap gap-1.5">
      {leading}
      {facts?.lifecycle && <Chip>{LIFECYCLE_LABELS[facts.lifecycle]}</Chip>}
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
