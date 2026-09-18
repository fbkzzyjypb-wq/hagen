import { db } from "./db";
import { compressImage } from "./images";
import type { Plant } from "./types";

/**
 * Illustrasjonsbilde til hver plante, hentet fra Wikipedia (gratis, uten nøkkel, tillater oppslag rett fra nettleseren).
 * Lagres i `assets`, atskilt fra brukerens egne bilder i `photos`, og vises bare på plantesiden. Listene bruker pixel-ikonene.
 */
export const refImageId = (plantId: string) => `plant:${plantId}`;

function lookupKey(plant: Pick<Plant, "name" | "latinName">): string {
  return `${plant.latinName?.trim() ?? ""}|${plant.name.trim()}`.toLowerCase();
}

type FoundImage = { imageUrl: string; credit: string; sourceUrl: string };

async function wikiQuery(lang: string, params: Record<string, string>) {
  const search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", origin: "*", ...params });
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${search}`);
  if (!res.ok) throw new Error(`Wikipedia svarte ${res.status}`);
  return res.json();
}

function htmlToText(html: string | undefined): string {
  if (!html) return "";
  return (new DOMParser().parseFromString(html, "text/html").body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Hovedbildet i artikkelen med denne tittelen, med fotograf og lisens. */
async function articleImage(lang: string, title: string): Promise<FoundImage | null> {
  const page = (await wikiQuery(lang, { redirects: "1", prop: "pageimages", piprop: "name", titles: title })).query?.pages?.[0];
  if (!page?.pageimage) return null;
  const info = (
    await wikiQuery(lang, {
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "960",
      iiextmetadatafilter: "Artist|LicenseShortName",
      titles: `File:${page.pageimage}`,
    })
  ).query?.pages?.[0]?.imageinfo?.[0];
  if (!info?.thumburl) return null;
  const artist = htmlToText(info.extmetadata?.Artist?.value).slice(0, 60);
  const license = htmlToText(info.extmetadata?.LicenseShortName?.value);
  return { imageUrl: info.thumburl, credit: [artist, license, "Wikimedia Commons"].filter(Boolean).join(" · "), sourceUrl: info.descriptionurl ?? info.thumburl };
}

/** Latinsk navn treffer best (engelsk Wikipedia har flest arter). Norsk navn er siste utvei. */
async function findImage(plant: Pick<Plant, "name" | "latinName">): Promise<FoundImage | null> {
  const latin = plant.latinName?.trim();
  const attempts: [string, string][] = [];
  if (latin) attempts.push(["en", latin], ["no", latin]);
  attempts.push(["no", plant.name.trim()]);
  for (const [lang, title] of attempts) {
    const found = await articleImage(lang, title);
    if (found) return found;
  }
  return null;
}

/** Returnerer false når nettet sviktet, slik at vi prøver igjen senere. */
async function ensureReferenceImage(plant: Plant): Promise<boolean> {
  const key = lookupKey(plant);
  let image: { found: FoundImage; blob: Blob } | null = null;
  try {
    const found = await findImage(plant);
    if (found) {
      const res = await fetch(found.imageUrl);
      if (!res.ok) throw new Error(`Bildet svarte ${res.status}`);
      image = { found, blob: await compressImage(await res.blob(), 960, 0.8) };
    }
  } catch {
    return false;
  }
  await db.transaction("rw", [db.plants, db.assets], async () => {
    if (!(await db.plants.get(plant.id))) return;
    if (image) {
      await db.assets.put({ id: refImageId(plant.id), blob: image.blob, updatedAt: Date.now(), credit: image.found.credit, sourceUrl: image.found.sourceUrl });
    } else {
      // Navnet er endret og gir ikke lenger treff: det gamle bildet hører til det gamle navnet.
      await db.assets.delete(refImageId(plant.id));
    }
    await db.plants.update(plant.id, { imageLookup: key });
  });
  return true;
}

let running = false;
let again = false;

/** Henter illustrasjonsbilde til plantene som mangler det, i bakgrunnen. Trygg å kalle ofte. */
export async function ensureReferenceImages(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    // Miniatyrer fra en tidligere versjon. Listene bruker pixel-ikonene, så de trengs ikke.
    await db.assets.where("id").startsWith("plant-thumb:").delete();
    do {
      again = false;
      if (!navigator.onLine) return;
      for (const plant of await db.plants.toArray()) {
        if (plant.imageLookup === lookupKey(plant)) continue;
        if (!(await ensureReferenceImage(plant))) return;
      }
    } while (again);
  } finally {
    running = false;
  }
}

/** Fjerner illustrasjonsbildet. Det hentes ikke på nytt før planten får nytt navn. */
export async function removeReferenceImage(plantId: string): Promise<void> {
  await db.assets.delete(refImageId(plantId));
}
