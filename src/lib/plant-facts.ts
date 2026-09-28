import data from "@/data/stauder.json";
import { db } from "./db";
import { completeText, resolveTransport, type ChatTransport } from "./llm-client";
import type { PlantCandidate } from "./plant-lookup";
import { categoryInfo, FACT_TEXT_FIELDS, plantTitle, type DroughtTolerance, type Light, type Plant, type PlantFacts, type PropagationMethod, type Settings, type ToxicityLevel } from "./types";

/**
 * Plantefakta: beskrivelse, herdighet, lys, jord, størrelse, vanning, gjødsling, blomstring, beskjæring, planting, høsting,
 * overvintring, formering, skadedyr, dyreliv, spiselighet og giftighet.
 * Alle planter slås opp hos KI-leverandøren (hvis satt opp), og svaret lagres på planten. Vanlige stauder står i tillegg i
 * src/data/stauder.json, og verdiene derfra går foran KI-svaret.
 */
type ListedPlant = PlantFacts & { latin: string; aliases?: string[]; names: string[] };

const LISTED = data.plants as unknown as ListedPlant[];
/** Økes når KI-svaret får nye felter, slik at plantene slås opp på nytt. */
const FACTS_VERSION = 2;
/** Pause mellom oppslagene, så gratisnivåene hos leverandørene ikke sprenges når hele hagen slås opp. */
const LOOKUP_PAUSE_MS = 3000;

const LIGHTS: Light[] = ["sol", "halvskygge", "skygge"];
const DROUGHT: DroughtTolerance[] = ["lav", "middel", "god"];
const METHODS: PropagationMethod[] = ["deling", "stiklinger", "fro", "avleggere", "poding", "ingen"];
const TOXICITY: ToxicityLevel[] = ["ufarlig", "lite", "giftig", "meget", "ukjent"];

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

/** Fakta for planten: svaret fra KI-leverandøren, med verdiene fra staudelisten foran når planten står der. */
export function factsFor(plant: Plant): { facts: PlantFacts; source: "liste" | "ki" | "begge" } | undefined {
  const listed = findListedFacts(plant);
  if (listed && plant.facts) return { facts: { ...plant.facts, ...listed }, source: "begge" };
  if (listed) return { facts: listed, source: "liste" };
  return plant.facts ? { facts: plant.facts, source: "ki" } : undefined;
}

/** Herdighetssonen som tall: «H5» → 5. */
function zoneNumber(zone?: string): number | undefined {
  const m = /^H([1-8])$/i.exec(zone?.trim() ?? "");
  return m ? Number(m[1]) : undefined;
}

/** Om en plante med gitt herdighet normalt overvintrer i hagens klimasone. Undefined når en av dem mangler. */
export function hardyIn(hardiness: string | undefined, zone: string | undefined): boolean | undefined {
  const plant = zoneNumber(hardiness);
  const garden = zoneNumber(zone);
  return plant !== undefined && garden !== undefined ? plant >= garden : undefined;
}

/** Kortfakta fra staudelisten lagt på et forslag fra identifiseringen. Listen går foran KI-svaret, og alt i den er stauder, altså flerårig. */
export function withListedFacts(candidate: PlantCandidate): PlantCandidate {
  const listed = findListedFacts(candidate);
  if (!listed) return candidate;
  return {
    ...candidate,
    facts: {
      ...candidate.facts,
      lifecycle: "flerårig",
      ...(listed.hardiness ? { hardiness: listed.hardiness } : {}),
      ...(listed.toxicity ? { toxicity: listed.toxicity.level } : {}),
    },
  };
}

const SYSTEM = [
  "Du er en norsk hageekspert. Brukeren oppgir én plante i hagen sin, med kategori. Gi fakta om planten for norske forhold.",
  "Svar bare med et JSON-objekt, uten annen tekst, på denne formen:",
  '{"description": "...", "type": "...", "family": "...", "origin": "...", "hardiness": "H6", "light": ["sol", "halvskygge"], "soil": "...", "height": [40, 60], "spread": [30, 50], "watering": "...", "droughtTolerance": "middel", "fertilizing": "...", "bloom": "...", "pruning": "...", "planting": "...", "harvest": "...", "winterCare": "...", "propagation": {"method": "deling", "everyYears": 3, "months": [4, 5], "note": "..."}, "pests": "...", "wildlife": "...", "edible": "...", "tips": "...", "toxicity": {"level": "giftig", "note": "..."}}',
  "Alle tekstfelt er én eller to korte setninger på norsk. Bruk tom streng når feltet ikke er relevant for planten (f.eks. harvest for en prydbusk) eller når du er usikker. Ikke gjett.",
  "description: hva slags plante det er, utseende og bruk i hagen. type: livsløp og vekstform, f.eks. «Flerårig, løvfellende busk» eller «Ettårig grønnsak». family: plantefamilien på norsk med latinsk navn i parentes. origin: hvor planten kommer fra.",
  "hardiness: høyeste norske herdighetssone planten normalt klarer seg i, fra H1 (mildest) til H8. Tom streng for ettårige og planter som ikke overvintrer ute.",
  "light: én eller flere av sol, halvskygge, skygge. soil: kort om jorda den trives i, med pH når det betyr noe. height og spread: fra–til i cm for en utvokst plante, også for trær (8 m er 800).",
  "watering: kort om vanningsbehov. droughtTolerance: lav, middel eller god. fertilizing: når og med hva det gjødsles.",
  "bloom: blomstringstid og farge. pruning: når og hvordan planten beskjæres, klippes eller skjæres ned. planting: såtid, plantetid, plantedybde og planteavstand. harvest: når og hvordan det høstes. winterCare: vinterdekking, opptak av knoller eller annet som trengs for overvintring.",
  "propagation.method: deling, stiklinger, fro, avleggere, poding eller ingen. For stauder: bruk deling når rotdeling er anbefalt, stiklinger eller fro når det fungerer bedre, og ingen når planten bør stå i fred (f.eks. pion, julerose, stormhatt, bregner og stauder med pælerot). For andre planter: metoden som passer best for en hobbygartner, eller ingen når planten vanligvis kjøpes ferdig.",
  "propagation.everyYears: år mellom hver deling, et heltall fra 2 til 10, bare for stauder der metoden er deling. Ellers 0.",
  "propagation.months: én til tre måneder (tall 1–12) der det bør gjøres i Norge. Vårblomstrende stauder deles på sensommeren, sommer- og høstblomstrende om våren når skuddene er et par cm.",
  "propagation.note: én eller to korte setninger på norsk: tegn på at planten trenger deling og hvordan, hvordan stiklinger tas eller frø sås, eller hvorfor den bør stå i fred.",
  "pests: vanlige sykdommer og skadedyr i Norge og hva som hjelper. wildlife: verdi for bier, humler, sommerfugler og fugler. edible: hvilke deler som kan spises og hvordan de brukes. tips: annet som er verdt å vite, f.eks. behov for pollinatorsort, støtte eller oppbinding.",
  "toxicity.level: ufarlig, lite, giftig, meget eller ukjent, etter Giftinformasjonens inndeling (ufarlig, lite giftig, giftig, meget giftig). Gjelder både mennesker og kjæledyr: bruk det høyeste nivået. Bruk ukjent når du er usikker, aldri ufarlig på gjetning.",
  "toxicity.note: én eller to korte setninger på norsk om hvilke plantedeler som er giftige, symptomer, og om planten er farlig for barn, hunder eller katter.",
].join("\n");

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function range(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value)) return typeof value === "number" && value > 0 ? [value, value] : undefined;
  const nums = value.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? [Math.min(...nums), Math.max(...nums)] : undefined;
}

function monthList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
}

/** JSON-objektet i svaret. Tåler kodegjerder og litt tekst rundt. */
function parseObject(raw: string): Record<string, unknown> | null {
  const match = raw.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Tolker faktadelen av svaret fra modellen. Null når det vesentlige mangler. */
export function parseFacts(raw: string): PlantFacts | null {
  const o = parseObject(raw);
  if (!o) return null;
  const hardiness = text(o.hardiness).toUpperCase();
  const light = Array.isArray(o.light) ? LIGHTS.filter((l) => (o.light as unknown[]).some((v) => text(v).toLowerCase() === l)) : [];
  const height = range(o.height);
  const prop = (o.propagation && typeof o.propagation === "object" ? o.propagation : {}) as Record<string, unknown>;
  const method = METHODS.find((m) => m === text(prop.method).toLowerCase());
  const drought = DROUGHT.find((d) => d === text(o.droughtTolerance).toLowerCase());
  const tox = (o.toxicity && typeof o.toxicity === "object" ? o.toxicity : {}) as Record<string, unknown>;
  if (light.length === 0 || !height || !method || !drought) return null;
  const everyYears = Math.round(Number(prop.everyYears));
  const months = monthList(prop.months).slice(0, 3);
  const extra: Partial<PlantFacts> = {};
  for (const field of FACT_TEXT_FIELDS) {
    const value = text(o[field]);
    if (value) extra[field] = value;
  }
  return {
    ...extra,
    // Ettårige og planter som ikke overvintrer ute har ingen herdighetssone.
    hardiness: /^H[1-8]$/.test(hardiness) ? hardiness : undefined,
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
    // Mangler nivået, er giftigheten ukjent. Aldri «ufarlig» som standard.
    toxicity: { level: TOXICITY.find((t) => t === text(tox.level).toLowerCase()) ?? "ukjent", note: text(tox.note) },
  };
}

async function askFacts(transport: ChatTransport, settings: Settings, plant: Plant): Promise<PlantFacts | null> {
  const where = [settings.location, settings.climateZone && `klimasone ${settings.climateZone}`].filter(Boolean).join(", ");
  const content = [`${plantTitle(plant)}${plant.latinName ? ` (${plant.latinName})` : ""}`, `Kategori: ${categoryInfo(plant.category).label}`, where && `Hagen ligger i: ${where}`]
    .filter(Boolean)
    .join("\n");
  const raw = await completeText({ transport, system: SYSTEM, messages: [{ role: "user", content }], maxTokens: 2500 });
  return parseFacts(raw);
}

let running = false;
let again = false;

/**
 * Slår opp fakta for planter som mangler dem, i bakgrunnen. Trygg å kalle ofte.
 * Oppslaget venter til en KI-leverandør er satt opp og nettet virker.
 */
export async function ensurePlantFacts(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  let lastLookup = 0;
  try {
    do {
      again = false;
      const settings = await db.settings.get("settings");
      const transport = settings && navigator.onLine ? resolveTransport(settings) : null;
      if (!settings || !transport) break;
      for (const plant of await db.plants.toArray()) {
        if (plant.factsVersion === FACTS_VERSION) continue;
        let facts: PlantFacts | null;
        try {
          const wait = lastLookup + LOOKUP_PAUSE_MS - Date.now();
          if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
          facts = await askFacts(transport, settings, plant);
          lastLookup = Date.now();
        } catch (err) {
          // Nett- eller leverandørfeil: ikke flere oppslag i denne runden. Prøves igjen senere.
          console.warn("Kunne ikke hente plantefakta nå, prøver igjen senere", err);
          break;
        }
        // Svaret lot seg ikke tolke: vi prøver igjen ved neste anledning.
        if (!facts) continue;
        await db.transaction("rw", [db.plants], async () => {
          // Er planten slettet eller flyttet til en annen kategori mens vi ventet på svaret, gjelder ikke svaret lenger.
          const current = await db.plants.get(plant.id);
          if (!current || current.category !== plant.category) return;
          await db.plants.update(plant.id, { facts, factsVersion: FACTS_VERSION });
        });
      }
    } while (again);
  } finally {
    running = false;
  }
}
