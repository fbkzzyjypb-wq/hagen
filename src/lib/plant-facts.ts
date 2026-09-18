import data from "@/data/stauder.json";
import { db } from "./db";
import { newId } from "./id";
import { CATEGORY_RULES } from "./care-rules";
import { completeText, resolveTransport, type ChatTransport } from "./llm-client";
import { categoryInfo, FACT_TEXT_FIELDS, plantTitle, type CareRule, type DroughtTolerance, type Light, type Plant, type PlantFacts, type PropagationMethod, type Settings, type ToxicityLevel } from "./types";

/**
 * Plantefakta: beskrivelse, herdighet, lys, jord, størrelse, vanning, gjødsling, blomstring, beskjæring, planting, høsting,
 * overvintring, formering, skadedyr, dyreliv, spiselighet og giftighet.
 * Alle planter slås opp hos KI-leverandøren (hvis satt opp), og svaret lagres på planten. Vanlige stauder står i tillegg i
 * src/data/stauder.json, og verdiene derfra går foran KI-svaret. For stauder gir faktaene også en egen deleregel som
 * overstyrer fellesregelen «Del og flytt stauder»: asters deles oftere enn hosta, og pion bør stå i fred.
 *
 * Samme oppslag vurderer kategoriens standardoppgaver for akkurat denne planten, så de ikke bare antas: oppgaver som
 * ikke passer slås av for planten med en begrunnelse, måneder justeres, og viktige egne oppgaver legges til.
 */
type ListedPlant = PlantFacts & { latin: string; aliases?: string[]; names: string[] };

const LISTED = data.plants as unknown as ListedPlant[];
const DIVISION_KEY = "del-stauder";
/** Økes når KI-svaret får nye felter, slik at plantene slås opp på nytt. */
const FACTS_VERSION = 2;
/** Høyst så mange egne oppgaver per plante fra KI-leverandøren, så oppgavelisten ikke flommer over. */
const MAX_EXTRA_TASKS = 2;
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

const SYSTEM = [
  "Du er en norsk hageekspert. Brukeren oppgir én plante i hagen sin, med kategori. Gi fakta om planten for norske forhold.",
  "Svar bare med et JSON-objekt, uten annen tekst, på denne formen:",
  '{"description": "...", "type": "...", "family": "...", "origin": "...", "hardiness": "H6", "light": ["sol", "halvskygge"], "soil": "...", "height": [40, 60], "spread": [30, 50], "watering": "...", "droughtTolerance": "middel", "fertilizing": "...", "bloom": "...", "pruning": "...", "planting": "...", "harvest": "...", "winterCare": "...", "propagation": {"method": "deling", "everyYears": 3, "months": [4, 5], "note": "..."}, "pests": "...", "wildlife": "...", "edible": "...", "tips": "...", "toxicity": {"level": "giftig", "note": "..."}, "tasks": [{"key": "nøkkel fra listen", "applies": true, "months": [4], "note": "..."}], "extraTasks": [{"title": "...", "months": [6], "note": "..."}]}',
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
  "tasks: brukeren lister opp standardoppgavene for kategorien. Ta med hver av dem, med samme key, og vurder om den gjelder akkurat denne planten. applies: false når oppgaven ikke passer planten (f.eks. frøsanking fra et tre, støtte til en lav bunndekker, eller når planten egentlig hører til en annen kategori), med en kort begrunnelse i note. months: månedene (tall 1–12) oppgaven bør gjøres for denne planten i Norge. Behold standardmånedene når de passer. note: én kort setning tilpasset planten.",
  "extraTasks: inntil to oppgaver som er viktige for akkurat denne planten og ikke dekkes av standardoppgavene, med kort title (2–5 ord), months og note. Tom liste når standardoppgavene holder.",
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

export type TaskAdvice = {
  /** Vurderingen av kategoriens standardoppgaver, per nøkkel. */
  standard: { key: string; applies: boolean; months: number[]; note: string }[];
  /** Egne oppgaver for planten. */
  extra: { title: string; months: number[]; note: string }[];
};

/** Tolker oppgavedelen av svaret. Null når modellen ikke har vurdert oppgavene, slik at vi prøver igjen senere. */
export function parseTasks(raw: string): TaskAdvice | null {
  const o = parseObject(raw);
  if (!o || !Array.isArray(o.tasks)) return null;
  const standard = (o.tasks as unknown[])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({ key: text(t.key), applies: t.applies !== false, months: monthList(t.months), note: text(t.note) }))
    .filter((t) => t.key);
  const extra = (Array.isArray(o.extraTasks) ? (o.extraTasks as unknown[]) : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({ title: text(t.title).slice(0, 60), months: monthList(t.months).slice(0, 4), note: text(t.note) }))
    .filter((t) => t.title && t.months.length > 0)
    .slice(0, MAX_EXTRA_TASKS);
  return { standard, extra };
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

/** Kategoriens standardoppgaver som KI-leverandøren skal vurdere. Delingen styres av `propagation` og holdes utenfor. */
function standardTasks(plant: Plant) {
  return CATEGORY_RULES[plant.category].filter((t) => t.key !== DIVISION_KEY);
}

async function askFacts(transport: ChatTransport, settings: Settings, plant: Plant): Promise<{ facts: PlantFacts | null; tasks: TaskAdvice | null }> {
  const where = [settings.location, settings.climateZone && `klimasone ${settings.climateZone}`].filter(Boolean).join(", ");
  const tasks = standardTasks(plant).map((t) => `- ${t.key}: ${t.title} (måneder: ${t.months.join(", ")})`);
  const content = [
    `${plantTitle(plant)}${plant.latinName ? ` (${plant.latinName})` : ""}`,
    `Kategori: ${categoryInfo(plant.category).label}`,
    where && `Hagen ligger i: ${where}`,
    tasks.length > 0 ? `Standardoppgaver for kategorien:\n${tasks.join("\n")}` : "Kategorien har ingen standardoppgaver.",
  ]
    .filter(Boolean)
    .join("\n");
  const raw = await completeText({ transport, system: SYSTEM, messages: [{ role: "user", content }], maxTokens: 2500 });
  return { facts: parseFacts(raw), tasks: parseTasks(raw) };
}

const sameMonths = (a: number[], b: number[]) => a.length === b.length && a.every((m, i) => m === b[i]);

/**
 * Planteregler som tilpasser kategoriens oppgaver til planten. En oppgave som ikke passer blir en avslått regel med samme
 * nøkkel (slik slås kategoriregelen av for bare denne planten), og andre måneder gir en egen regel. Passer standarden,
 * lages ingenting, så planten blir stående i fellesoppgaven. `ownKeys` er nøkler planten alt har egne regler for: de røres ikke.
 */
function taskRules(plant: Plant, advice: TaskAdvice, ownKeys: Set<string>, now: number): CareRule[] {
  const base = { scope: "plant" as const, plantId: plant.id, source: "ki" as const, createdAt: now };
  const rules: CareRule[] = [];
  for (const t of standardTasks(plant)) {
    const a = advice.standard.find((s) => s.key === t.key);
    if (!a || ownKeys.has(t.key)) continue;
    const months = [...t.months].sort((x, y) => x - y);
    if (!a.applies) {
      rules.push({ ...base, id: newId(), key: t.key, title: t.title, description: a.note || t.description, months, everyYears: t.everyYears, enabled: false });
    } else if (a.months.length > 0 && !sameMonths(a.months, months)) {
      rules.push({ ...base, id: newId(), key: t.key, title: t.title, description: a.note || t.description, months: a.months, everyYears: t.everyYears, enabled: true });
    }
  }
  for (const e of advice.extra) {
    rules.push({ ...base, id: newId(), title: e.title, description: e.note || undefined, months: e.months, enabled: true });
  }
  return rules;
}

/**
 * Kalles når planten bytter kategori. Oppgavene fra KI-leverandøren og deleregelen hører til den gamle kategorien:
 * de fjernes, og vurderingen gjøres på nytt for den nye. Regler brukeren har laget selv beholdes.
 */
export async function resetPlantTasks(plantId: string): Promise<void> {
  await db.transaction("rw", [db.plants, db.rules, db.completions], async () => {
    const stale = (await db.rules.where("plantId").equals(plantId).toArray()).filter((r) => r.source === "ki" || (r.key === DIVISION_KEY && r.source !== "egen"));
    for (const r of stale) await db.completions.where("ruleId").equals(r.id).delete();
    await db.rules.bulkDelete(stale.map((r) => r.id));
    await db.plants.update(plantId, { tasksChecked: false, factsChecked: false });
  });
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
 * Slår opp fakta for planter som mangler dem og gir stauder egen deleregel, i bakgrunnen. Trygg å kalle ofte.
 * Oppslaget venter til en KI-leverandør er satt opp og nettet virker. Stauder i listen får deleregelen uansett.
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
      let transport = settings && navigator.onLine ? resolveTransport(settings) : null;
      for (const plant of await db.plants.toArray()) {
        const needsRule = plant.category === "staude" && !plant.factsChecked;
        const needsFacts = plant.factsVersion !== FACTS_VERSION;
        const needsTasks = !plant.tasksChecked;
        if (!needsRule && !needsFacts && !needsTasks) continue;
        let asked: PlantFacts | null = null;
        let advice: TaskAdvice | null = null;
        if ((needsFacts || needsTasks) && settings && transport) {
          try {
            const wait = lastLookup + LOOKUP_PAUSE_MS - Date.now();
            if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
            const answer = await askFacts(transport, settings, plant);
            lastLookup = Date.now();
            asked = answer.facts;
            if (needsTasks) advice = answer.tasks;
          } catch (err) {
            // Nett- eller leverandørfeil: ikke flere KI-oppslag i denne runden. Prøves igjen senere.
            console.warn("Kunne ikke hente plantefakta nå, prøver igjen senere", err);
            transport = null;
          }
        }
        // Deleregelen bygger på listen når stauden står der, ellers på svaret. Uten noen av dem gjelder fellesregelen til neste forsøk.
        const listed = needsRule ? findListedFacts(plant) : undefined;
        const ruleFacts = needsRule ? (listed ?? asked) : null;
        // Svaret lot seg ikke tolke, eller leverandøren mangler: vi prøver igjen ved neste anledning.
        if (!asked && !ruleFacts && !advice) continue;
        await db.transaction("rw", [db.plants, db.rules], async () => {
          // Er planten slettet eller flyttet til en annen kategori mens vi ventet på svaret, gjelder ikke svaret lenger.
          const current = await db.plants.get(plant.id);
          if (!current || current.category !== plant.category) return;
          // Har planten alt en egen regel med samme nøkkel (fra planteprofilen, laget eller slått av for hånd), beholdes den.
          const ownKeys = new Set((await db.rules.where("plantId").equals(plant.id).toArray()).flatMap((r) => (r.key ? [r.key] : [])));
          if (ruleFacts && !ownKeys.has(DIVISION_KEY)) await db.rules.add(divisionRule(plant, ruleFacts, listed ? "standard" : "ki", Date.now()));
          if (advice) await db.rules.bulkAdd(taskRules(plant, advice, ownKeys, Date.now()));
          await db.plants.update(plant.id, {
            ...(ruleFacts ? { factsChecked: true } : {}),
            ...(asked ? { facts: asked, factsVersion: FACTS_VERSION } : {}),
            ...(advice ? { tasksChecked: true } : {}),
          });
        });
      }
    } while (again);
  } finally {
    running = false;
  }
}
