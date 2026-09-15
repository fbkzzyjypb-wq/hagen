import type { Plant, Settings } from "./types";
import type { TaskItem } from "./tasks";
import { categoryInfo } from "./types";
import { monthName } from "./dates";

type Context = {
  settings: Settings;
  plants: Plant[];
  monthTasks?: TaskItem[];
  focusPlant?: Plant;
};

/** Bygger et spørsmål til Claude med kontekst om hagen. */
export function buildGardenPrompt(question: string, ctx: Context): string {
  const { settings, plants, monthTasks, focusPlant } = ctx;
  const now = new Date();
  const lines: string[] = [];

  lines.push("Du er min personlige hageekspert. Svar konkret og praktisk, tilpasset norsk klima.");
  lines.push("");
  lines.push("Om hagen min:");
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
    lines.push(`Planter i hagen (${plants.length}):`);
    const shown = plants.slice(0, 60);
    for (const p of shown) lines.push(`- ${describePlant(p)}`);
    if (plants.length > shown.length) lines.push(`- ... og ${plants.length - shown.length} til`);
  }

  if (monthTasks && monthTasks.length > 0) {
    lines.push("");
    lines.push("Planlagte oppgaver denne måneden:");
    for (const t of monthTasks.slice(0, 15)) lines.push(`- ${t.rule.title}${t.done ? " (gjort)" : ""}`);
  }

  lines.push("");
  lines.push(`Spørsmål: ${question.trim()}`);
  return lines.join("\n");
}

function describePlant(p: Plant): string {
  let s = p.name;
  if (p.latinName) s += ` (${p.latinName})`;
  if (p.variety) s += ` '${p.variety}'`;
  s += ` – ${categoryInfo(p.category).label.toLowerCase()}`;
  if (p.plantedYear) s += `, plantet ${p.plantedYear}`;
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
