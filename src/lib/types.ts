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

export interface Plant {
  id: string;
  name: string;
  latinName?: string;
  variety?: string;
  category: PlantCategory;
  plantedYear?: number;
  notes?: string;
  /** Plassering på kartet, i meter. */
  position?: Point;
  /** Nøkkel til planteprofil (stell-mal) hvis planten ble lagt til fra forslagslisten. */
  profileKey?: string;
  createdAt: number;
  updatedAt: number;
}

export type AreaKind = "bed" | "plen" | "sti" | "hus" | "terrasse" | "hekk" | "vann" | "annet";

export const AREA_KINDS: { value: AreaKind; label: string; fill: string; stroke: string }[] = [
  { value: "bed", label: "Blomsterbed", fill: "#d9c2a3", stroke: "#a17c4f" },
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

export type RuleScope = "plant" | "category" | "garden";
export type RuleSource = "standard" | "egen" | "claude";

export interface CareRule {
  id: string;
  /** Stabil nøkkel. En planteregel med samme nøkkel som en kategoriregel overstyrer den for planten. */
  key?: string;
  title: string;
  description?: string;
  /** Måneder (1-12) oppgaven skal gjøres i. */
  months: number[];
  scope: RuleScope;
  plantId?: string;
  category?: PlantCategory;
  source: RuleSource;
  enabled: boolean;
  createdAt: number;
}

export interface TaskCompletion {
  id: string;
  ruleId: string;
  plantId?: string;
  year: number;
  month: number;
  doneAt: number;
}

export interface Settings {
  id: "settings";
  gardenName: string;
  location?: string;
  climateZone?: string;
  mapWidth: number;
  mapHeight: number;
  notifyHour: number;
  pushServerUrl?: string;
  pushServerKey?: string;
  pushSubscription?: PushSubscriptionJSON;
  pushLastSync?: number;
  seededRules?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  gardenName: "Hagen",
  climateZone: "H3",
  mapWidth: 30,
  mapHeight: 20,
  notifyHour: 8,
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
