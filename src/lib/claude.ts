import type { Area, Plant, Settings } from "./types";
import type { TaskItem } from "./tasks";
import { areaInfo, categoryInfo } from "./types";
import { monthName } from "./dates";
import { bedsOf, inBed, quantityInBed } from "./beds";

const MAX_PLANTS_IN_CONTEXT = 200;

function shorten(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type Context = {
  settings: Settings;
  plants: Plant[];
  /** Områder; de som er bed, brukes til å gruppere plantene. */
  areas?: Area[];
  monthTasks?: TaskItem[];
  focusPlant?: Plant;
};

/** Kontekst om hagen, brukt både i lenken til claude.ai og som systemkontekst i chatten. */
export function buildGardenContext(ctx: Context): string {
  const { settings, plants, areas, monthTasks, focusPlant } = ctx;
  const now = new Date();
  const lines: string[] = [];
  lines.push("Om hagen:");
  lines.push(`- Sted: ${settings.location || "Norge"}${settings.climateZone ? `, klimasone ${settings.climateZone}` : ""}`);
  lines.push(`- Dato: ${now.getDate()}. ${monthName(now.getMonth() + 1)} ${now.getFullYear()}`);

  if (focusPlant) {
    lines.push("");
    lines.push("Planten spørsmålet gjelder:");
    lines.push(`- ${describePlant(focusPlant)}`);
    if (focusPlant.notes) lines.push(`  Notater: ${focusPlant.notes}`);
  }

  if (plants.length > 0) {
    lines.push("");
    lines.push(`Alle plantene i hagen (${plants.length}):`);
    const shown = [...plants].sort((a, b) => a.name.localeCompare(b.name, "nb")).slice(0, MAX_PLANTS_IN_CONTEXT);
    for (const p of shown) {
      const note = p.id !== focusPlant?.id && p.notes ? ` Notat: ${shorten(p.notes, 120)}` : "";
      lines.push(`- ${describePlant(p)}${note}`);
    }
    if (plants.length > shown.length) lines.push(`- ... og ${plants.length - shown.length} til`);
  } else {
    lines.push("");
    lines.push("Brukeren har ikke lagt inn planter i appen ennå.");
  }

  const bedLines = bedsOf(areas ?? [])
    .map((bed) => {
      const members = plants.filter((p) => inBed(p, bed.id));
      if (members.length === 0) return null;
      const list = members.map((p) => `${p.name}${p.variety ? ` '${p.variety}'` : ""}${quantityInBed(p, bed.id) > 1 ? ` ${quantityInBed(p, bed.id)} stk` : ""}`).join("; ");
      return `- ${bed.name} (${areaInfo(bed.kind).label.toLowerCase()}): ${list}`;
    })
    .filter((l): l is string => l !== null);
  if (bedLines.length > 0) {
    lines.push("");
    lines.push("Plasseringer (bed, drivhus, krukker og andre steder), med plantene som står der:");
    lines.push(...bedLines);
  }

  if (monthTasks && monthTasks.length > 0) {
    lines.push("");
    lines.push("Forslag til oppgaver denne måneden:");
    for (const t of monthTasks.slice(0, 15)) lines.push(`- ${t.rule.title}`);
  }
  return lines.join("\n");
}

/** Bygger et spørsmål til Claude med kontekst om hagen (til lenken som åpner claude.ai). */
export function buildGardenPrompt(question: string, ctx: Context): string {
  return [
    "Du er min personlige hageekspert. Svar konkret og praktisk, tilpasset norsk klima.",
    "",
    buildGardenContext(ctx),
    "",
    `Spørsmål: ${question.trim()}`,
  ].join("\n");
}

/** Fast del av systemprompten i chatten. Holdes uendret mellom kall. */
export const CHAT_SYSTEM_PROMPT = [
  "Du er hageeksperten i appen Hagen, en personlig assistent for én hobbygartner i Norge.",
  "Svar på norsk (bokmål), konkret og praktisk, tilpasset norsk klima og den klimasonen som er oppgitt.",
  "Du får listen over alle plantene brukeren har lagt inn, med sort, plantingsår og notater, og hvor de står (bed, drivhus, krukker og andre plasseringer). Når et spørsmål nevner en plante eller en plassering, gå ut fra at det er den i listen, og bruk det du vet om den.",
  "Når du foreslår oppgaver, si hvilken måned de bør gjøres i. Bruk gjerne plantene brukeren har når det er relevant.",
  "Hold svarene korte nok til å leses på en mobilskjerm: korte avsnitt og punktlister med '-'. Ikke bruk tabeller eller overskrifter.",
  "Latency-sensitive; begin your visible answer immediately.",
].join("\n");

function describePlant(p: Plant): string {
  let s = p.name;
  if (p.latinName) s += ` (${p.latinName})`;
  if (p.variety) s += ` '${p.variety}'`;
  s += ` – ${categoryInfo(p.category).label.toLowerCase()}`;
  if (p.plantedYear) s += `, plantet ${p.plantedYear}`;
  if (p.quantity && p.quantity > 1) s += `, ${p.quantity} stk`;
  return s;
}

export function claudeUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

export const SUGGESTED_QUESTIONS = [
  "Hva bør jeg gjøre i hagen denne måneden?",
  "Hvordan og når bør jeg beskjære plantene mine?",
  "Hvilke planter passer sammen med det jeg allerede har?",
  "Hvordan lager jeg god kompost til bedene?",
  "Hvilke av plantene mine kan jeg ta stiklinger eller frø fra nå?",
];
