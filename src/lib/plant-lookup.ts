import { completeText, type ChatTransport } from "./llm-client";
import { PLANT_CATEGORIES, type PlantCategory } from "./types";
import { PLANT_PROFILES, type PlantProfile } from "./care-rules";

/** Et forslag fra oppslaget: hva brukeren sannsynligvis mener med navnet som ble skrevet. */
export type PlantCandidate = {
  name: string;
  latinName: string;
  variety?: string;
  /** Mangler når treffet kommer rett fra Artsdatabanken uten KI. Da beholdes valgt kategori. */
  category?: PlantCategory;
  note?: string;
  source: "ki" | "artsdatabanken" | "plantnet";
};

type TaxonRank = "art" | "underart" | "slekt";

/** Treff i Artsdatabankens navnebase: norsk navn og gyldig latinsk navn for en art eller slekt. */
export type TaxonHit = { name: string; latinName: string; rank: TaxonRank; family: string; popularName?: string };

type ArtskartRow = {
  CategoryValue?: number;
  Kingdom?: string;
  ValidScientificName?: string;
  PrefferedPopularname?: string | null;
  MatchedName?: string;
  Family?: string;
  PopularNames?: { Name?: string }[] | null;
};

const RANKS: Record<number, TaxonRank> = { 22: "art", 23: "underart", 19: "slekt" };
const RANK_ORDER: Record<TaxonRank, number> = { art: 0, underart: 1, slekt: 2 };

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Søker i Artsdatabankens navnebase (gratis, uten nøkkel, bare karplanter). Prefikssøk på norske og latinske navn,
 * så treffene sorteres her: eksakt navn først, arter før slekter. Tom liste ved feil.
 */
export async function searchArtsdatabanken(query: string, signal?: AbortSignal): Promise<TaxonHit[]> {
  const q = query.replace(/\s+/g, " ").trim().toLowerCase();
  if (q.length < 3) return [];
  let rows: ArtskartRow[];
  try {
    const res = await fetch(`https://artskart.artsdatabanken.no/publicapi/api/taxon?term=${encodeURIComponent(q)}&taxonGroups=19&take=60`, { signal });
    if (!res.ok) return [];
    rows = (await res.json()) as ArtskartRow[];
  } catch (err) {
    if (signal?.aborted) throw err;
    return [];
  }
  const hits: (TaxonHit & { exact: boolean })[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const rank = row.CategoryValue !== undefined ? RANKS[row.CategoryValue] : undefined;
    const latinName = row.ValidScientificName?.trim() ?? "";
    if (!rank || row.Kingdom !== "Plantae" || !latinName || seen.has(latinName.toLowerCase())) continue;
    seen.add(latinName.toLowerCase());
    // Treffet kan være på et norsk navn eller på et latinsk navn (også synonymer). Norsk navn vises hvis det finnes.
    const matched = row.MatchedName?.trim() ?? "";
    const matchedIsPopular = (row.PopularNames ?? []).some((n) => n.Name?.trim().toLowerCase() === matched.toLowerCase());
    const popular = (matchedIsPopular ? matched : row.PrefferedPopularname?.trim()) || "";
    // Slekter heter «roseslekta», «bøkeslekta» osv. Bare når resten er det brukeren skrev («rose»), brukes den som navn.
    const stripped = popular.replace(/slekta$/i, "");
    const name = capitalize(rank === "slekt" ? (stripped.toLowerCase() === q ? stripped : latinName) : popular || latinName);
    hits.push({
      name,
      latinName,
      rank,
      family: row.Family?.trim() ?? "",
      popularName: popular || undefined,
      exact: name.toLowerCase() === q || latinName.toLowerCase() === q,
    });
  }
  hits.sort((a, b) => Number(b.exact) - Number(a.exact) || RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || a.name.length - b.name.length);
  return hits.slice(0, 4).map((h) => ({ name: h.name, latinName: h.latinName, rank: h.rank, family: h.family, popularName: h.popularName }));
}

function hitToCandidate(hit: TaxonHit): PlantCandidate {
  const where = hit.family ? ` i familien ${hit.family}` : "";
  return {
    name: hit.name,
    latinName: hit.latinName,
    source: "artsdatabanken",
    note:
      hit.rank === "slekt"
        ? `Artsdatabanken: slekt${hit.popularName ? ` (${hit.popularName})` : ""}${where}. Legg til art eller sort selv.`
        : `Artsdatabanken: ${hit.rank}${where}.`,
  };
}

function latinKey(latin: string): string {
  return latin.toLowerCase().split(" ").slice(0, 2).join(" ");
}

export const CATEGORY_GUIDE = [
  "tre: prydtre (bjørk, lønn, magnolia, hjertetre)",
  "frukttre: eple, pære, plomme, kirsebær",
  "busk: prydbusk (hortensia, syrin, rhododendron, rose)",
  "baerbusk: rips, solbær, stikkelsbær, bringebær, blåbær",
  "hekk: planter brukt som hekk (bøk, thuja, liguster)",
  "staude: flerårige urteaktige planter (pion, hosta, storkenebb)",
  "lok: løk- og knollplanter (tulipan, narsiss, dahlia)",
  "sommerblomst: ettårige (tagetes, petunia)",
  "gronnsak",
  "urt: krydderurter",
  "klatreplante: klematis, kaprifol, klatrerose",
  "plen",
  "annet",
].join("; ");

const SYSTEM = [
  "Du er en norsk planteekspert som hjelper en hobbygartner å registrere planter i hagen sin.",
  "Brukeren skriver et plantenavn: ofte et norsk hverdagsnavn, kanskje feilstavet, kanskje med sortsnavn eller latinsk navn.",
  "Norske plantenavn er ofte sammensatt. Forstavelser som pryd-, hage-, henge-, søyle-, dverg-, kjempe-, klatre-, høst- og vår- sier noe om form eller bruk, og resten av ordet er arten.",
  "Eksempler: «prydkattehale» er hagesorten av kattehale, Lythrum salicaria, en staude. «hengehjertetre» er hjertetre, Cercidiphyllum japonicum, med hengende vekst, sort Pendulum, et tre. «kjempesolhatt» er Rudbeckia, en staude.",
  "Tenk først kort gjennom hva navnet kan bety (maks to setninger). Avslutt så med en JSON-liste med 1–3 kandidater, mest sannsynlig først, på formen:",
  '[{"name": "Norsk navn", "latinName": "Slekt art", "variety": "sortsnavn eller tom streng", "category": "kategori", "note": "én kort setning om planten"}]',
  `Kategorier (bruk nøyaktig disse verdiene): ${CATEGORY_GUIDE}.`,
  "name: vanlig norsk bokmålsnavn med stor forbokstav. latinName: bare slekt og art, uten sort. variety: sortsnavn uten anførselstegn, f.eks. Pendulum, ellers tom streng.",
  "Har brukeren skrevet en sort, behold den i variety. Er det uklart hvilken art som menes, gi flere kandidater.",
  "Inneholder meldingen treff fra Artsdatabanken, er de fasit for norsk og latinsk artsnavn: ta dem med som kandidater med riktig kategori, og legg til hageformer eller sorter der det passer.",
  "Gi alltid ditt beste forslag. Svar med tom liste [] bare hvis teksten åpenbart ikke er en plante.",
].join("\n");

const cache = new Map<string, PlantCandidate[]>();

/**
 * Slår opp et plantenavn: først i Artsdatabanken (norsk navn → latinsk navn), så hos KI-leverandøren, som får
 * treffene som fasit og legger til kategori, sort og beskrivelse. Uten leverandør vises Artsdatabanken-treffene direkte.
 * Samme spørring slås bare opp én gang per økt.
 */
export async function lookupPlant(transport: ChatTransport | null, query: string, signal?: AbortSignal): Promise<PlantCandidate[]> {
  const q = query.replace(/\s+/g, " ").trim();
  const key = `${transport?.model ?? "artsdatabanken"}|${q.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const hits = await searchArtsdatabanken(q, signal);
  if (!transport) {
    const found = hits.map(hitToCandidate);
    cache.set(key, found);
    return found;
  }

  const content =
    hits.length > 0
      ? `${q}\n\nArtsdatabanken (norsk artsnavnebase) fant:\n${hits.map((h) => `- ${h.name} = ${h.latinName} (${h.rank}${h.family ? `, familie ${h.family}` : ""})`).join("\n")}`
      : q;
  let found: PlantCandidate[] = [];
  try {
    let raw = await completeText({ transport, system: SYSTEM, messages: [{ role: "user", content }], maxTokens: 800, signal });
    found = parseCandidates(raw);
    if (found.length === 0 && !/\[\s*\]/.test(raw)) {
      // Svaret lot seg ikke tolke (ikke en uttrykkelig tom liste). Ett forsøk til med strengere beskjed.
      raw = await completeText({
        transport,
        system: SYSTEM,
        messages: [
          { role: "user", content },
          { role: "assistant", content: raw.slice(0, 1500) },
          { role: "user", content: "Svar nå bare med JSON-listen, uten annen tekst og uten kodegjerder." },
        ],
        maxTokens: 800,
        signal,
      });
      found = parseCandidates(raw);
    }
    if (process.env.NODE_ENV !== "production") console.debug("[planteoppslag]", q, "→", raw, found);
  } catch (err) {
    if (signal?.aborted || hits.length === 0) throw err;
    console.warn("KI-oppslaget feilet, viser treff fra Artsdatabanken", err);
  }

  // Artsdatabanken-treff modellen ikke tok med, legges til bakerst.
  const covered = new Set(found.map((c) => latinKey(c.latinName)));
  for (const hit of hits) {
    if (!covered.has(latinKey(hit.latinName))) found.push(hitToCandidate(hit));
  }
  cache.set(key, found);
  return found;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Første ikke-tomme verdi blant nøklene. Modeller oversetter iblant nøklene til norsk. */
function pick(o: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = clean(o[k]);
    if (v) return v;
  }
  return "";
}

/** Tolker svaret fra modellen. Tåler kodegjerder og litt tekst rundt JSON-en. */
export function parseCandidates(raw: string): PlantCandidate[] {
  const text = raw.replace(/```(?:json)?/gi, "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  let parsed: unknown;
  try {
    parsed = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const out: PlantCandidate[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const latinName = pick(o, ["latinName", "latin_name", "latinskNavn", "latinsk_navn", "scientificName", "latin"]);
    const name = pick(o, ["name", "navn", "norskNavn", "norsk_navn", "norwegianName"]) || latinName;
    if (!name) continue;
    const variety = pick(o, ["variety", "sort", "cultivar", "sortsnavn"]).replace(/^['"«»‘’]+|['"«»‘’]+$/g, "");
    const cat = pick(o, ["category", "kategori", "type"]).toLowerCase();
    const category = PLANT_CATEGORIES.some((c) => c.value === cat) ? (cat as PlantCategory) : "annet";
    const key = `${name.toLowerCase()}|${latinName.toLowerCase()}|${variety.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: capitalize(name),
      latinName,
      variety: variety || undefined,
      category,
      note: pick(o, ["note", "notat", "beskrivelse", "description"]) || undefined,
      source: "ki",
    });
    if (out.length === 3) break;
  }
  return out;
}

/** Innebygd planteprofil (med stell-kalender) som passer kandidaten, hvis noen. */
export function matchProfile(candidate: PlantCandidate): PlantProfile | undefined {
  const name = candidate.name.toLowerCase();
  const latin = candidate.latinName.toLowerCase();
  const genus = latin.split(" ")[0];
  return PLANT_PROFILES.find((p) => {
    if (candidate.category && p.category !== candidate.category) return false;
    if (p.name.toLowerCase() === name) return true;
    if (!p.latinName || !latin) return false;
    const profileLatin = p.latinName.toLowerCase();
    return profileLatin === latin || (!profileLatin.includes(" ") && profileLatin === genus);
  });
}

/**
 * Kategori for vanlige hageslekter, brukt når forslaget kommer uten kategori (Pl@ntNet og Artsdatabanken kjenner ikke
 * kategoriene, og KI-oppslaget kan feile). Uten dette blir skjemaets standardvalg «Staude» stående, også for trær.
 * Nøkkelen er slekt, eller «slekt art» der arten skiller seg fra resten av slekta. Stauder trenger ingen oppføring.
 */
const GENUS_CATEGORIES: Partial<Record<PlantCategory, string[]>> = {
  tre: [
    "abies", "acer", "aesculus", "alnus", "betula", "carpinus", "castanea", "catalpa", "cedrus", "cercidiphyllum", "chamaecyparis", "crataegus",
    "cupressus", "fagus", "fraxinus", "ginkgo", "juglans", "laburnum", "larix", "liquidambar", "liriodendron", "magnolia", "metasequoia", "picea",
    "pinus", "platanus", "populus", "prunus serrulata", "prunus padus", "pseudotsuga", "quercus", "robinia", "salix", "sorbus", "tilia", "tsuga", "ulmus",
  ],
  frukttre: ["cydonia", "malus", "prunus", "pyrus"],
  busk: [
    "amelanchier", "berberis", "buddleja", "buxus", "calluna", "chaenomeles", "cornus", "corylus", "cotoneaster", "daphne", "dasiphora", "deutzia",
    "erica", "euonymus", "forsythia", "fothergilla", "hamamelis", "hibiscus", "hydrangea", "ilex", "juniperus", "kalmia", "kerria", "kolkwitzia",
    "mahonia", "philadelphus", "physocarpus", "pieris", "pinus mugo", "prunus laurocerasus", "rhododendron", "ribes sanguineum", "rosa", "sambucus",
    "skimmia", "spiraea", "symphoricarpos", "syringa", "taxus", "viburnum", "weigela",
  ],
  baerbusk: ["aronia", "hippophae", "lonicera caerulea", "ribes", "rubus", "vaccinium"],
  hekk: ["ligustrum", "thuja"],
  klatreplante: ["actinidia", "aristolochia", "campsis", "clematis", "hedera", "humulus", "hydrangea anomala", "hydrangea petiolaris", "lonicera", "parthenocissus", "vitis", "wisteria"],
  lok: [
    "allium", "camassia", "canna", "chionodoxa", "colchicum", "crocosmia", "crocus", "dahlia", "eranthis", "erythronium", "fritillaria", "galanthus",
    "gladiolus", "hyacinthoides", "hyacinthus", "iris reticulata", "leucojum", "lilium", "muscari", "narcissus", "ornithogalum", "puschkinia", "scilla", "tulipa",
  ],
  sommerblomst: [
    "ageratum", "antirrhinum", "begonia", "calendula", "calibrachoa", "centaurea cyanus", "cosmos", "eschscholzia", "helianthus annuus", "impatiens",
    "ipomoea", "lathyrus odoratus", "lobularia", "nemesia", "nicotiana", "nigella", "osteospermum", "papaver rhoeas", "pelargonium", "petunia",
    "salvia splendens", "tagetes", "tropaeolum", "viola wittrockiana", "zinnia",
  ],
  gronnsak: [
    "allium cepa", "allium porrum", "allium sativum", "apium", "asparagus", "beta", "brassica", "capsicum", "cucumis", "cucurbita", "daucus", "lactuca",
    "pastinaca", "phaseolus", "pisum", "raphanus", "rheum", "solanum", "spinacia", "vicia faba", "zea",
  ],
  urt: [
    "allium schoenoprasum", "allium ursinum", "anethum", "artemisia dracunculus", "coriandrum", "foeniculum", "levisticum", "melissa", "mentha", "ocimum",
    "origanum", "petroselinum", "rosmarinus", "salvia officinalis", "salvia rosmarinus", "satureja", "thymus",
  ],
};

const CATEGORY_BY_LATIN = new Map(
  (Object.entries(GENUS_CATEGORIES) as [PlantCategory, string[]][]).flatMap(([category, names]) => names.map((n) => [n, category] as const))
);

/** Kategori ut fra latinsk navn: art først, så slekt. Undefined når slekta ikke står i tabellen. */
export function inferCategory(latinName: string | undefined): PlantCategory | undefined {
  const words = (latinName ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && w !== "×" && w !== "x");
  if (words.length === 0) return undefined;
  return CATEGORY_BY_LATIN.get(words.slice(0, 2).join(" ")) ?? CATEGORY_BY_LATIN.get(words[0]);
}

const CATEGORY_SYSTEM = [
  "Du er en norsk planteekspert. For hver plante i listen, oppgi hvilken kategori den hører til i en hageapp.",
  `Kategorier (bruk nøyaktig disse verdiene): ${CATEGORY_GUIDE}.`,
  'Svar bare med et JSON-objekt der nøkkelen er det latinske navnet slik det står i listen og verdien er kategorien, f.eks. {"Thymus praecox": "urt"}.',
].join("\n");

/** Fyller inn kategori på kandidater som mangler den (f.eks. fra bildeidentifisering). Ett kall for alle. Uendret ved feil: da gjelder `inferCategory`. */
export async function categorizeCandidates(transport: ChatTransport, candidates: PlantCandidate[], signal?: AbortSignal): Promise<PlantCandidate[]> {
  const missing = candidates.filter((c) => !c.category && c.latinName);
  if (missing.length === 0) return candidates;
  try {
    const raw = await completeText({
      transport,
      system: CATEGORY_SYSTEM,
      messages: [{ role: "user", content: missing.map((c) => `- ${c.name} (${c.latinName})`).join("\n") }],
      // Romslig, fordi modeller som tenker før de svarer (Gemini Flash) bruker av samme kvote og ellers svarer tomt.
      maxTokens: 1500,
      signal,
    });
    const match = raw.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
    if (!match) return candidates;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    // Modellen gjentar ikke alltid navnet helt likt (autornavn, ×), så slekt og art sammenlignes.
    const latinKey = (latin: string) => latin.toLowerCase().split(/\s+/).filter((w) => w && w !== "×" && w !== "x").slice(0, 2).join(" ");
    const byLatin = new Map(Object.entries(parsed).map(([k, v]) => [latinKey(k), clean(v).toLowerCase()]));
    return candidates.map((c) => {
      if (c.category) return c;
      const cat = byLatin.get(latinKey(c.latinName));
      return cat && PLANT_CATEGORIES.some((x) => x.value === cat) ? { ...c, category: cat as PlantCategory } : c;
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn("Kunne ikke hente kategori fra KI-leverandøren", err);
    return candidates;
  }
}
