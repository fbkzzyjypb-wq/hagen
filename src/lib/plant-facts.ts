import data from "@/data/stauder.json";
import { db } from "./db";
import { newId } from "./id";
import { CATEGORY_RULES } from "./care-rules";
import { completeText, resolveTransport, type ChatTransport } from "./llm-client";
import { scheduleSyncSoon } from "./sync";
import { plantTitle, type CareRule, type DroughtTolerance, type Light, type Plant, type PlantFacts, type PropagationMethod, type Settings } from "./types";

/**
 * Dyrkingsfakta for stauder: herdighet, lys, jord, størrelse, deling eller stiklinger, vanning og tørketoleranse.
 * Vanlige stauder står i src/data/stauder.json. Stauder som ikke står der slås opp hos KI-leverandøren (hvis satt opp),
 * og svaret lagres på planten. Faktaene gir også planten en egen deleregel som overstyrer fellesregelen
 * «Del og flytt stauder»: asters deles oftere enn hosta, og pion bør stå i fred.
 */
type ListedPlant = PlantFacts & { latin: string; aliases?: string[]; names: string[] };

const LISTED = data.plants as unknown as ListedPlant[];
const DIVISION_KEY = "del-stauder";

const LIGHTS: Light[] = ["sol", "halvskygge", "skygge"];
const DROUGHT: DroughtTolerance[] = ["lav", "middel", "god"];
const METHODS: PropagationMethod[] = ["deling", "stiklinger", "fro", "ingen"];

/** «Nepeta × faassenii 'Walker's Low'» → «nepeta faassenii». */
function latinWords(latin: string): string[] {
  return latin
    .toLowerCase()
    .replace(/['‘’"«»].*$/, "")
    .split(/\s+/)
    .filter((w) => w && w !== "×" && w !== "x");
}

/** Oppslag i staudelisten: art først, så slekt, så norsk navn. */
export function findListedFacts(plant: Pick<Plant, "name" | "latinName">): PlantFacts | undefined {
  const words = latinWords(plant.latinName ?? "");
  const byLatin = (key: string) => LISTED.find((p) => [p.latin, ...(p.aliases ?? [])].some((l) => latinWords(l).join(" ") === key));
  const hit = (words.length >= 2 ? byLatin(words.slice(0, 2).join(" ")) : undefined) ?? (words.length >= 1 ? byLatin(words[0]) : undefined);
  if (hit) return hit;
  const name = plant.name.trim().toLowerCase();
  return LISTED.find((p) => p.names.some((n) => n.toLowerCase() === name));
}

/** Fakta for planten: fra staudelisten hvis den står der, ellers det KI-leverandøren har svart. */
export function factsFor(plant: Plant): { facts: PlantFacts; source: "liste" | "ki" } | undefined {
  const listed = findListedFacts(plant);
  if (listed) return { facts: listed, source: "liste" };
  return plant.facts ? { facts: plant.facts, source: "ki" } : undefined;
}

const SYSTEM = [
  "Du er en norsk staudeekspert. Brukeren oppgir én staude i hagen sin. Gi dyrkingsfakta for norske forhold.",
  "Svar bare med et JSON-objekt, uten annen tekst, på denne formen:",
  '{"hardiness": "H6", "light": ["sol", "halvskygge"], "soil": "...", "height": [40, 60], "spread": [30, 50], "propagation": {"method": "deling", "everyYears": 3, "months": [4, 5], "note": "..."}, "watering": "...", "droughtTolerance": "middel"}',
  "hardiness: høyeste norske herdighetssone planten normalt klarer seg i, fra H1 (mildest) til H8.",
  "light: én eller flere av sol, halvskygge, skygge. soil: kort om jorda den trives i. height og spread: fra–til i cm for en utvokst plante.",
  "propagation.method: deling, stiklinger, fro eller ingen. Bruk deling når rotdeling er anbefalt, stiklinger eller fro når det fungerer bedre, og ingen når planten bør stå i fred (f.eks. pion, julerose, stormhatt, bregner og stauder med pælerot).",
  "propagation.everyYears: år mellom hver deling, et heltall fra 2 til 10, når metoden er deling. Ellers 0.",
  "propagation.months: én til tre måneder (tall 1–12) der det bør gjøres i Norge. Vårblomstrende deles på sensommeren, sommer- og høstblomstrende om våren når skuddene er et par cm.",
  "propagation.note: én eller to korte setninger på norsk: tegn på at planten trenger deling og hvordan, hvordan stiklinger tas, eller hvorfor den bør stå i fred.",
  "watering: kort om vanningsbehov. droughtTolerance: lav, middel eller god.",
].join("\n");

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function range(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value)) return typeof value === "number" && value > 0 ? [value, value] : undefined;
  const nums = value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? [Math.min(...nums), Math.max(...nums)] : undefined;
}

/** Tolker svaret fra modellen. Tåler kodegjerder og litt tekst rundt JSON-en. Null når det vesentlige mangler. */
export function parseFacts(raw: string): PlantFacts | null {
  const match = raw.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const hardiness = text(o.hardiness).toUpperCase();
  const light = Array.isArray(o.light) ? LIGHTS.filter((l) => (o.light as unknown[]).some((v) => text(v).toLowerCase() === l)) : [];
  const height = range(o.height);
  const prop = (o.propagation && typeof o.propagation === "object" ? o.propagation : {}) as Record<string, unknown>;
  const method = METHODS.find((m) => m === text(prop.method).toLowerCase());
  const drought = DROUGHT.find((d) => d === text(o.droughtTolerance).toLowerCase());
  if (!/^H[1-8]$/.test(hardiness) || light.length === 0 || !height || !method || !drought) return null;
  const everyYears = Math.round(Number(prop.everyYears));
  const months = Array.isArray(prop.months)
    ? [...new Set(prop.months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b).slice(0, 3)
    : [];
  return {
    hardiness,
    light,
    soil: text(o.soil),
    height,
    spread: range(o.spread),
    propagation: {
      method,
      everyYears: method === "deling" && everyYears >= 2 && everyYears <= 15 ? everyYears : 0,
      months,
      note: text(prop.note),
    },
    watering: text(o.watering),
    droughtTolerance: drought,
  };
}

async function askFacts(transport: ChatTransport, settings: Settings, plant: Plant): Promise<PlantFacts | null> {
  const where = [settings.location, settings.climateZone && `klimasone ${settings.climateZone}`].filter(Boolean).join(", ");
  const content = `${plantTitle(plant)}${plant.latinName ? ` (${plant.latinName})` : ""}${where ? `\nHagen ligger i: ${where}` : ""}`;
  return parseFacts(await completeText({ transport, system: SYSTEM, messages: [{ role: "user", content }], maxTokens: 900 }));
}

/** Plantens egen deleregel. Er deling ikke anbefalt, er regelen slått av og forklarer hvorfor. */
function divisionRule(plant: Plant, facts: PlantFacts, source: CareRule["source"], now: number): CareRule {
  const general = CATEGORY_RULES.staude.find((t) => t.key === DIVISION_KEY);
  const { method, everyYears = 0, months = [], note } = facts.propagation;
  const divide = method === "deling" && everyYears >= 2;
  return {
    id: newId(),
    key: DIVISION_KEY,
    title: `Del ${plant.name.toLowerCase()}`,
    description: note || general?.description,
    months: divide && months.length > 0 ? months : (general?.months ?? [4, 5, 9]),
    // Slår brukeren på en regel som er av, gjelder det vanlige intervallet.
    everyYears: divide ? everyYears : general?.everyYears,
    scope: "plant",
    plantId: plant.id,
    source,
    enabled: divide,
    createdAt: now,
  };
}

let running = false;
let again = false;

/**
 * Slår opp fakta for stauder som ikke er sjekket ennå og gir dem egen deleregel, i bakgrunnen. Trygg å kalle ofte.
 * Stauder utenfor listen venter til en KI-leverandør er satt opp og nettet virker.
 */
export async function ensurePlantFacts(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  let changed = false;
  try {
    do {
      again = false;
      const settings = await db.settings.get("settings");
      let transport = settings && navigator.onLine ? resolveTransport(settings) : null;
      const unchecked = (await db.plants.toArray()).filter((p) => p.category === "staude" && !p.factsChecked);
      for (const plant of unchecked) {
        const listed = findListedFacts(plant);
        let asked: PlantFacts | null = null;
        if (!listed) {
          if (!settings || !transport) continue;
          try {
            asked = await askFacts(transport, settings, plant);
          } catch (err) {
            // Nett- eller leverandørfeil: ikke flere KI-oppslag i denne runden. Prøves igjen senere.
            console.warn("Kunne ikke hente staudefakta nå, prøver igjen senere", err);
            transport = null;
          }
          // Svaret lot seg ikke tolke: fellesregelen gjelder, og vi prøver igjen ved neste anledning.
          if (!asked) continue;
        }
        const facts = listed ?? asked!;
        await db.transaction("rw", [db.plants, db.rules], async () => {
          if (!(await db.plants.get(plant.id))) return;
          // Har planten alt en egen deleregel (laget eller slått av for hånd), beholdes den.
          const hasOwn = (await db.rules.where("plantId").equals(plant.id).filter((r) => r.key === DIVISION_KEY).count()) > 0;
          if (!hasOwn) await db.rules.add(divisionRule(plant, facts, listed ? "standard" : "ki", Date.now()));
          await db.plants.update(plant.id, { factsChecked: true, ...(asked ? { facts: asked } : {}) });
        });
        changed = true;
      }
    } while (again);
  } finally {
    running = false;
    if (changed) scheduleSyncSoon();
  }
}
