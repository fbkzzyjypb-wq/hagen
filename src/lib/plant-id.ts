import { compressImage } from "./images";
import { completeWithImage, streamWithImage, type ChatTransport } from "./llm-client";
import { CATEGORY_GUIDE, capitalize, parseCandidates, searchArtsdatabanken, type PlantCandidate } from "./plant-lookup";
import { monthName } from "./dates";
import type { Plant, Settings } from "./types";

export const PLANTNET_SITE_URL = "https://my.plantnet.org/";

type PlantNetResponse = {
  results?: {
    score: number;
    species: {
      scientificNameWithoutAuthor?: string;
      commonNames?: string[];
      family?: { scientificName?: string };
    };
  }[];
  remainingIdentificationRequests?: number;
};

export type Identification = { candidates: PlantCandidate[]; remaining?: number };

/** Hva et bilde viser. Pl@ntNet godtar bare disse: «vekstform» og «annet» fra appen deres finnes ikke i API-et. */
export type PlantOrgan = "auto" | "leaf" | "flower" | "fruit" | "bark";
export const PLANT_ORGANS: { value: PlantOrgan; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "leaf", label: "Blad" },
  { value: "flower", label: "Blomst" },
  { value: "fruit", label: "Frukt" },
  { value: "bark", label: "Bark" },
];
/** Pl@ntNet tar imot høyst fem bilder av samme plante per identifisering. */
export const MAX_IDENTIFY_PHOTOS = 5;
export type IdentifyPhoto = { blob: Blob; organ: PlantOrgan };

function describeError(status: number, body: string): Error {
  let detail = "";
  try {
    detail = (JSON.parse(body) as { message?: string }).message ?? "";
  } catch {
    // ignorer
  }
  const said = detail ? ` Pl@ntNet sa: «${detail.slice(0, 120)}».` : "";
  if (status === 401 || status === 403) {
    return new Error(
      `Pl@ntNet avviste nøkkelen (${status}).${said} Sjekk at nøkkelen er riktig, og at «expose my API key» er på med nøyaktig ${window.location.origin} på en egen linje under Authorized domains hos Pl@ntNet.`
    );
  }
  if (status === 429) return new Error("Dagskvoten hos Pl@ntNet er brukt opp. Prøv igjen i morgen.");
  if (status === 413) return new Error("Bildet er for stort for Pl@ntNet.");
  return new Error(`Pl@ntNet svarte ${status}.${said}`);
}

/**
 * Norsk navn for et latinsk artsnavn fra Artsdatabanken, hvis det finnes. Pl@ntNet bruker iblant et synonym
 * (Epilobium angustifolium der Artsdatabanken sier Chamerion angustifolium); søket treffer da på synonymet,
 * så første artstreff med norsk navn godtas for et fullt artsnavn.
 */
async function norwegianName(latinName: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const hits = await searchArtsdatabanken(latinName, signal);
    const named = hits.filter((h) => h.rank !== "slekt" && h.name.toLowerCase() !== h.latinName.toLowerCase());
    const exact = named.find((h) => h.latinName.toLowerCase() === latinName.toLowerCase());
    if (exact) return exact.name;
    return latinName.trim().includes(" ") ? named[0]?.name : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Identifiserer planten med Pl@ntNet ut fra ett til fem bilder av samme plante, sendt i ett kall. Hvert bilde har et organ
 * (blad, blomst ...), eller «auto» så Pl@ntNet avgjør det selv. Bildene krympes før sending. Norsk navn hentes fra
 * Artsdatabanken, ellers brukes Pl@ntNets vanlige navn eller det latinske. Tom liste når Pl@ntNet ikke finner noen plante.
 */
export async function identifyPlantPhotos(apiKey: string, photos: IdentifyPhoto[], signal?: AbortSignal): Promise<Identification> {
  const used = photos.slice(0, MAX_IDENTIFY_PHOTOS);
  const images = await Promise.all(used.map((p) => compressImage(p.blob, 1280, 0.85)));
  const form = new FormData();
  // API-et parer bilder og organer etter rekkefølge, og krever like mange av hver.
  images.forEach((image, i) => form.append("images", image, `plante-${i + 1}.jpg`));
  used.forEach((p) => form.append("organs", p.organ));
  const url = `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&nb-results=4&include-related-images=false`;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: form, signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error("Fikk ikke kontakt med Pl@ntNet. Sjekk nettforbindelsen.");
  }
  if (res.status === 404) return { candidates: [] };
  if (!res.ok) throw describeError(res.status, await res.text().catch(() => ""));

  const data = (await res.json()) as PlantNetResponse;
  const results = (data.results ?? []).filter((r) => r.species?.scientificNameWithoutAuthor).slice(0, 4);
  const names = await Promise.all(results.map((r) => norwegianName(r.species.scientificNameWithoutAuthor!, signal)));
  const candidates = results.map((r, i): PlantCandidate => {
    const latinName = r.species.scientificNameWithoutAuthor!;
    const family = r.species.family?.scientificName;
    return {
      name: capitalize(names[i] ?? r.species.commonNames?.[0] ?? latinName),
      latinName,
      source: "plantnet",
      note: `Pl@ntNet: ${Math.round(r.score * 100)} % sikker${family ? `, familien ${family}` : ""}.`,
    };
  });
  return { candidates, remaining: data.remainingIdentificationRequests };
}

const VISION_ID_SYSTEM = [
  "Du er en norsk planteekspert. Identifiser planten på bildet.",
  "Svar med en JSON-liste med 1–3 kandidater, mest sannsynlig først, på formen:",
  '[{"name": "Norsk navn", "latinName": "Slekt art", "variety": "", "category": "kategori", "note": "én setning om hva i bildet som peker på arten, og hvor sikker du er"}]',
  `Kategorier (bruk nøyaktig disse verdiene): ${CATEGORY_GUIDE}.`,
  "name: vanlig norsk bokmålsnavn med stor forbokstav. latinName: slekt og art. Viser bildet ingen plante, svar [].",
].join("\n");

/** Identifiserer planten på bildet med KI-leverandøren (for dem uten Pl@ntNet-nøkkel). */
export async function identifyPlantWithVision(transport: ChatTransport, file: Blob, signal?: AbortSignal): Promise<PlantCandidate[]> {
  const image = await compressImage(file, 1024, 0.85);
  const raw = await completeWithImage({ transport, system: VISION_ID_SYSTEM, prompt: "Hvilken plante er dette?", image, maxTokens: 800, signal });
  return parseCandidates(raw);
}

const DIAGNOSE_SYSTEM = [
  "Du er hageeksperten i appen Hagen, en personlig assistent for én hobbygartner i Norge.",
  "Brukeren sender et bilde av en plante som ser ut til å ha et problem, gjerne med sted, dato og hvilken plante det er.",
  "Svar på norsk bokmål, konkret og kort nok for en mobilskjerm. Bruk disse fire avsnittene, hver innledet med fet overskrift på egen linje:",
  "**Hva jeg ser** (det synlige på bildet), **Sannsynlig årsak** (1–3 alternativer, mest sannsynlig først, og hvor sikker du er), **Hva du bør gjøre nå** (punktliste med '-'), **Forebygging** (punktliste med '-').",
  "Ta hensyn til årstid og klimasone. Ikke bruk tabeller. Viser bildet ingen plante, eller er det for uklart til å si noe, si det i stedet for å gjette.",
].join("\n");

type DiagnoseArgs = {
  transport: ChatTransport;
  file: Blob;
  settings: Settings;
  plant?: Plant;
  signal?: AbortSignal;
  /** Kalles med hele teksten så langt. */
  onText: (text: string) => void;
};

/** Vurderer sykdom eller skade på planten i bildet. Svaret strømmes. */
export async function diagnosePlant({ transport, file, settings, plant, signal, onText }: DiagnoseArgs): Promise<string> {
  const image = await compressImage(file, 1024, 0.85);
  const now = new Date();
  const lines = [
    `Sted: ${settings.location || "Norge"}${settings.climateZone ? `, klimasone ${settings.climateZone}` : ""}`,
    `Dato: ${now.getDate()}. ${monthName(now.getMonth() + 1)} ${now.getFullYear()}`,
  ];
  if (plant) {
    let line = `Planten: ${plant.name}`;
    if (plant.latinName) line += ` (${plant.latinName})`;
    if (plant.variety) line += ` '${plant.variety}'`;
    if (plant.plantedYear) line += `, plantet ${plant.plantedYear}`;
    if (plant.notes) line += `. Notater: ${plant.notes}`;
    lines.push(line);
  }
  let text = "";
  await streamWithImage({
    transport,
    system: DIAGNOSE_SYSTEM,
    prompt: `${lines.join("\n")}\n\nHva feiler denne planten, og hva bør jeg gjøre?`,
    image,
    signal,
    onText: (delta) => {
      text += delta;
      onText(text);
    },
  });
  return text;
}
