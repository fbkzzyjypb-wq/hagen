import type { PlantCandidate } from "./plant-lookup";

export type PlantCategory =
  | "tre"
  | "frukttre"
  | "busk"
  | "baerbusk"
  | "hekk"
  | "staude"
  | "lok"
  | "sommerblomst"
  | "gronnsak"
  | "urt"
  | "klatreplante"
  | "plen"
  | "annet";

export const PLANT_CATEGORIES: { value: PlantCategory; label: string; color: string; emoji: string }[] = [
  { value: "tre", label: "Tre", color: "#4f7942", emoji: "🌳" },
  { value: "frukttre", label: "Frukttre", color: "#c2410c", emoji: "🍎" },
  { value: "busk", label: "Busk", color: "#3f6212", emoji: "🌿" },
  { value: "baerbusk", label: "Bærbusk", color: "#9f1239", emoji: "🫐" },
  { value: "hekk", label: "Hekk", color: "#365314", emoji: "🌲" },
  { value: "staude", label: "Staude", color: "#7e22ce", emoji: "🌸" },
  { value: "lok", label: "Løk og knoll", color: "#ca8a04", emoji: "🌷" },
  { value: "sommerblomst", label: "Sommerblomst", color: "#db2777", emoji: "🌼" },
  { value: "gronnsak", label: "Grønnsak", color: "#15803d", emoji: "🥕" },
  { value: "urt", label: "Urt", color: "#0f766e", emoji: "🌱" },
  { value: "klatreplante", label: "Klatreplante", color: "#1d4ed8", emoji: "🍃" },
  { value: "plen", label: "Plen", color: "#65a30d", emoji: "🟩" },
  { value: "annet", label: "Annet", color: "#64748b", emoji: "🪴" },
];

export function categoryInfo(category: PlantCategory) {
  return PLANT_CATEGORIES.find((c) => c.value === category) ?? PLANT_CATEGORIES[PLANT_CATEGORIES.length - 1];
}

export interface Point {
  x: number;
  y: number;
}

export interface PlantBed {
  /** Id til området (bedet) i `areas`. */
  areaId: string;
  /** Antall av planten i dette bedet. Tomt betyr 1. */
  quantity?: number;
}

export interface Plant {
  id: string;
  name: string;
  latinName?: string;
  variety?: string;
  category: PlantCategory;
  plantedYear?: number;
  /** Antall eksemplarer totalt, f.eks. 28 trær i en eplehekk. Tomt betyr 1. Summen av bedene når planten står i bed. */
  quantity?: number;
  /** Bedene planten står i, med antall per bed. Samme plante kan stå i flere bed. */
  beds?: PlantBed[];
  notes?: string;
  /** Plassering på kartet, i meter. */
  position?: Point;
  /** Plassert som rekke (f.eks. hekk): linje med flere punkter, i meter. */
  line?: Point[];
  /** Plantefakta fra KI-leverandøren (se plant-facts.ts). Står planten i src/data/stauder.json, går verdiene derfra foran. */
  facts?: PlantFacts;
  /** Versjonen av faktaoppslaget som ga `facts`. Eldre versjoner slås opp på nytt. */
  factsVersion?: number;
  createdAt: number;
  updatedAt: number;
}

export type Light = "sol" | "halvskygge" | "skygge";
export type DroughtTolerance = "lav" | "middel" | "god";
/** Beste måte å fornye eller formere planten på. "ingen" betyr at den bør stå i fred eller vanligvis kjøpes ferdig. */
export type PropagationMethod = "deling" | "stiklinger" | "fro" | "avleggere" | "poding" | "ingen";
/** Giftighet etter Giftinformasjonens inndeling. "ukjent" når KI-leverandøren ikke vet. */
export type ToxicityLevel = "ufarlig" | "lite" | "giftig" | "meget" | "ukjent";
export const TOXICITY_LABELS: Record<ToxicityLevel, string> = { ufarlig: "Ufarlig", lite: "Lite giftig", giftig: "Giftig", meget: "Meget giftig", ukjent: "Ukjent" };
/** Livsløp: ettårig, toårig eller flerårig. */
export type Lifecycle = "ettårig" | "toårig" | "flerårig";
export const LIFECYCLE_LABELS: Record<Lifecycle, string> = { ettårig: "Ettårig", toårig: "Toårig", flerårig: "Flerårig" };

/** Kortfakta om et forslag fra identifiseringen, før planten eventuelt legges inn i hagen. */
export interface CandidateFacts {
  toxicity?: ToxicityLevel;
  /** Høyeste herdighetssone planten normalt overvintrer ute i (H1–H8). Mangler for ettårige. */
  hardiness?: string;
  lifecycle?: Lifecycle;
}

/**
 * Tekstfeltene KI-leverandøren fyller ut i tillegg til kjernefeltene: beskrivelse, livsløp og vekstform, plantefamilie,
 * opprinnelse, gjødsling, blomstring, beskjæring, såing og planting, høsting, overvintring, sykdommer og skadedyr,
 * verdi for dyrelivet, spiselighet og annet verdt å vite. Utelatt når feltet ikke er relevant for planten.
 */
export const FACT_TEXT_FIELDS = ["description", "type", "family", "origin", "fertilizing", "bloom", "pruning", "planting", "harvest", "winterCare", "pests", "wildlife", "edible", "tips"] as const;
export type FactTextField = (typeof FACT_TEXT_FIELDS)[number];

/** Fakta om en plante. Kjernefeltene har samme form i src/data/stauder.json og i svaret fra KI-leverandøren. */
export interface PlantFacts extends Partial<Record<FactTextField, string>> {
  /** Høyeste herdighetssone planten normalt klarer seg i, H1 (mildest) til H8. Mangler for ettårige. */
  hardiness?: string;
  /** Tom når KI-svaret ikke sa noe om lys. */
  light: Light[];
  soil: string;
  /** Høyde i cm, fra–til. */
  height?: [number, number];
  /** Bredde i cm, fra–til. */
  spread?: [number, number];
  propagation?: {
    method: PropagationMethod;
    /** År mellom hver deling når metoden er deling. */
    everyYears?: number;
    /** Måneder (1-12) det bør gjøres i. */
    months?: number[];
    note: string;
  };
  watering: string;
  droughtTolerance?: DroughtTolerance;
  /** Giftighet for mennesker og kjæledyr. Mangler på fakta som ble slått opp før feltet fantes. */
  toxicity?: { level: ToxicityLevel; note: string };
}

/** Navn med sort, slik planten vises i lister og overskrifter: «Eple 'Elstar'». */
export function plantTitle(p: Pick<Plant, "name" | "variety">): string {
  return p.variety ? `${p.name} '${p.variety}'` : p.name;
}

export type AreaKind = "bed" | "kjokkenhage" | "krukker" | "plen" | "sti" | "hus" | "terrasse" | "hekk" | "vann" | "annet";

export const AREA_KINDS: { value: AreaKind; label: string; fill: string; stroke: string }[] = [
  { value: "bed", label: "Blomsterbed", fill: "#d9c2a3", stroke: "#a17c4f" },
  { value: "kjokkenhage", label: "Kjøkkenhage", fill: "#e9dcc3", stroke: "#a68a5b" },
  { value: "krukker", label: "Potter og krukker", fill: "#efd9c4", stroke: "#b97f5b" },
  { value: "plen", label: "Plen", fill: "#b5d99c", stroke: "#6fa24a" },
  { value: "sti", label: "Sti / gang", fill: "#e3e0d8", stroke: "#a8a49a" },
  { value: "hus", label: "Hus / bygning", fill: "#c9ccd3", stroke: "#7a7f8a" },
  { value: "terrasse", label: "Terrasse", fill: "#e8cfae", stroke: "#b8925e" },
  { value: "hekk", label: "Hekk", fill: "#8bb174", stroke: "#4f7942" },
  { value: "vann", label: "Vann", fill: "#b3d4f0", stroke: "#5f9bd1" },
  { value: "annet", label: "Annet", fill: "#e5e7eb", stroke: "#9ca3af" },
];

export function areaInfo(kind: AreaKind) {
  return AREA_KINDS.find((k) => k.value === kind) ?? AREA_KINDS[AREA_KINDS.length - 1];
}

/** Et område i hagen. Brukes som bed (gruppe av planter) og kan i tillegg ha en figur på kartet. Uten figur er `points` tom. */
export interface Area {
  id: string;
  name: string;
  kind: AreaKind;
  points: Point[];
  createdAt: number;
}

export interface Photo {
  id: string;
  plantId: string;
  blob: Blob;
  thumb: Blob;
  takenAt: number;
  note?: string;
}

/**
 * En identifisering fra Identifiser-fanen: forslaget slik det var lagret, så det kan ses igjen senere. Bildet ligger i
 * `identificationPhotos` med samme id, så oppføringen kan oppdateres (fakta, plante) uten at bildet skrives på nytt:
 * Safari mister blobber som leses fra IndexedDB og lagres igjen.
 */
export interface Identification {
  id: string;
  createdAt: number;
  /** Hvor mange bilder som ble sendt. */
  photoCount: number;
  source: "plantnet" | "ki";
  candidates: PlantCandidate[];
  /** Plantefakta for det lagrede forslaget, slått opp hos KI-leverandøren etter lagring. Samme form som på en plante i hagen. */
  facts?: PlantFacts;
  /** Planten som ble lagt til i hagen fra denne identifiseringen, hvis noen. */
  plantId?: string;
}

/** Det første bildet fra en identifisering, nedskalert. Skrives én gang og endres aldri. */
export interface IdentificationPhoto {
  /** Samme id som identifiseringen. */
  id: string;
  blob: Blob;
}

/** Frittstående bilde, f.eks. forsidebildet på Hjem (id "cover"). */
export interface Asset {
  id: string;
  blob: Blob;
  updatedAt: number;
}

/** Bakgrunnsbilde på kartet, f.eks. satellittbilde av tomten. */
export interface MapBackground {
  id: "bg";
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
  /** Plassering og størrelse på kartet, i meter. */
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export interface Settings {
  id: "settings";
  gardenName: string;
  location?: string;
  climateZone?: string;
  mapWidth: number;
  mapHeight: number;
  /** KI-leverandør med OpenAI-kompatibelt API (Gemini, Groq, OpenRouter ...). Nøkkelen lagres bare på denne enheten. */
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
  /** Nøkkel til Pl@ntNet for å identifisere planter fra bilde. Lagres bare på denne enheten. */
  plantNetApiKey?: string;
  /** Vis kartfanen. Skjult som standard; bed fungerer uten kartet. */
  showMap?: boolean;
}

/** En samtale med KI-assistenten. Meldinger som kommer tett etter hverandre samles i én samtale. */
export interface ChatConversation {
  id: string;
  /** Kort tittel. Laget av KI etter første svar, før det starten på første spørsmål. */
  title: string;
  /** Én setning om hva samtalen handlet om. Laget av KI. */
  summary?: string;
  /** Planten samtalen startet fra, hvis noen. */
  plantId?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** Hvor mange meldinger samtalen hadde da tittel og sammendrag sist ble laget. 0 = aldri. */
  summarizedCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  gardenName: "Hagen",
  climateZone: "H3",
  mapWidth: 30,
  mapHeight: 20,
};

export const CLIMATE_ZONES = ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"] as const;

export const MONTHS_NB = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

export const MONTHS_NB_SHORT = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] as const;
