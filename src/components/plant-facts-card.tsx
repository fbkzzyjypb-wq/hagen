"use client";

import { Card } from "@/components/ui/card";
import { factsFor } from "@/lib/plant-facts";
import { capitalize } from "@/lib/plant-lookup";
import { MONTHS_NB_SHORT, TOXICITY_LABELS, type DroughtTolerance, type Plant, type PlantCategory, type PropagationMethod } from "@/lib/types";
import { cn } from "cn";

/** Det faktakortet trenger: navn og latinsk navn for oppslag i staudelisten, KI-svaret, og kategori for ordvalget. */
export type FactsSubject = Pick<Plant, "name" | "latinName" | "facts"> & { category?: PlantCategory };

const DROUGHT_LABELS: Record<DroughtTolerance, string> = { lav: "Tåler tørke dårlig", middel: "Tåler noe tørke", god: "Tåler tørke godt" };
const METHOD_LABELS: Record<PropagationMethod, string> = { deling: "Deling", stiklinger: "Stiklinger", fro: "Frø", avleggere: "Avleggere", poding: "Poding", ingen: "Bør stå i fred" };
const SOURCE_LABELS = {
  liste: "Fra appens staudeliste. Verdiene er veiledende.",
  ki: "Fra KI-leverandøren. Kan inneholde feil.",
  begge: "Fra appens staudeliste, utfylt av KI-leverandøren. Kan inneholde feil.",
};

/** «40–60 cm», og meter for trær og store busker: «3–8 m». */
function sizeRange([from, to]: [number, number]): string {
  const meters = to >= 200;
  const n = (v: number) => (meters ? (v / 100).toLocaleString("nb-NO", { maximumFractionDigits: 1 }) : String(v));
  return `${from === to ? n(from) : `${n(from)}–${n(to)}`} ${meters ? "m" : "cm"}`;
}

/** Plantefakta fra staudelisten og KI-leverandøren, for en plante i hagen eller en lagret identifisering. Vises ikke når ingenting er slått opp. */
export function FactsCard({ subject, className }: { subject: FactsSubject; className?: string }) {
  const found = factsFor(subject);
  if (!found) return null;
  const { facts, source } = found;
  const { method, everyYears, months = [], note } = facts.propagation;
  const toxic = facts.toxicity?.level === "giftig" || facts.toxicity?.level === "meget";
  // Bare stauder «bør stå i fred». For andre planter betyr ingen at de vanligvis kjøpes ferdige.
  const methodLabel = method === "ingen" && subject.category !== "staude" ? "Formeres sjelden i hagen" : METHOD_LABELS[method];
  const propagation = [method === "deling" && everyYears ? `Deling hvert ${everyYears}. år` : methodLabel, months.map((m) => MONTHS_NB_SHORT[m - 1]).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className={cn("gap-3 px-4", className)}>
      <p className="text-sm font-semibold">Plantefakta</p>
      {facts.description && <p className="text-sm">{facts.description}</p>}
      {facts.type && <Row label="Type" value={facts.type} />}
      {facts.family && <Row label="Familie" value={facts.family} />}
      {facts.origin && <Row label="Opprinnelse" value={facts.origin} />}
      {facts.hardiness && <Row label="Herdighet" value={facts.hardiness} />}
      <Row label="Lys" value={capitalize(facts.light.join(", "))} />
      <Row label="Størrelse" value={`${sizeRange(facts.height)} høy${facts.spread ? `, ${sizeRange(facts.spread)} bred` : ""}`} />
      <Row label="Tørke" value={DROUGHT_LABELS[facts.droughtTolerance]} />
      {facts.soil && <Block label="Jord" value={facts.soil} />}
      {facts.watering && <Block label="Vanning" value={facts.watering} />}
      {facts.fertilizing && <Block label="Gjødsling" value={facts.fertilizing} />}
      {facts.bloom && <Block label="Blomstring" value={facts.bloom} />}
      {facts.pruning && <Block label="Beskjæring" value={facts.pruning} />}
      {facts.planting && <Block label="Såing og planting" value={facts.planting} />}
      {facts.harvest && <Block label="Høsting" value={facts.harvest} />}
      {facts.winterCare && <Block label="Overvintring" value={facts.winterCare} />}
      {(method !== "ingen" || note) && <Block label="Formering" value={propagation} note={note} />}
      {facts.pests && <Block label="Sykdommer og skadedyr" value={facts.pests} />}
      {facts.wildlife && <Block label="Dyreliv" value={facts.wildlife} />}
      {facts.edible && <Block label="Spiselig" value={facts.edible} />}
      {facts.tips && <Block label="Verdt å vite" value={facts.tips} />}
      {facts.toxicity && (
        <Block label="Giftighet" value={TOXICITY_LABELS[facts.toxicity.level]} note={facts.toxicity.note} valueClassName={toxic ? "font-medium text-destructive" : undefined} />
      )}
      <p className="text-xs text-muted-foreground">
        {SOURCE_LABELS[source]}
        {facts.toxicity && facts.toxicity.level !== "ufarlig" && (
          <>
            {" "}Har noen fått i seg planten, ring Giftinformasjonen på{" "}
            <a href="tel:22591300" className="font-medium text-primary underline-offset-2 hover:underline">
              22 59 13 00
            </a>
            .
          </>
        )}
      </p>
    </Card>
  );
}

function Block({ label, value, note, valueClassName }: { label: string; value: string; note?: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm", valueClassName)}>{value}</p>
      {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Row({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-right text-sm", italic && "italic")}>{value}</p>
    </div>
  );
}
