import { db } from "./db";
import type { Area, Asset, CareRule, MapBackground, Photo, Plant, Settings, TaskCompletion } from "./types";

type ExportedPhoto = Omit<Photo, "blob" | "thumb"> & { blob: string; thumb: string; type: string };
type ExportedBackground = Omit<MapBackground, "blob"> & { blob: string; type: string };
type ExportedAsset = Omit<Asset, "blob"> & { blob: string; type: string };

export interface ExportFile {
  app: "hagen";
  version: 1;
  exportedAt: number;
  plants: Plant[];
  areas: Area[];
  rules: CareRule[];
  completions: TaskCompletion[];
  settings?: Settings;
  photos: ExportedPhoto[];
  background?: ExportedBackground;
  assets?: ExportedAsset[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, type: string): Blob {
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return new Blob([arr], { type });
}

export async function exportAll(): Promise<Blob> {
  const [plants, areas, rules, completions, settings, photos, background, assets] = await Promise.all([
    db.plants.toArray(),
    db.areas.toArray(),
    db.rules.toArray(),
    db.completions.toArray(),
    db.settings.get("settings"),
    db.photos.toArray(),
    db.mapBackground.get("bg"),
    db.assets.toArray(),
  ]);
  const exportedAssets: ExportedAsset[] = [];
  for (const a of assets) {
    exportedAssets.push({ ...a, type: a.blob.type || "image/jpeg", blob: await blobToBase64(a.blob) });
  }
  const exportedPhotos: ExportedPhoto[] = [];
  for (const p of photos) {
    exportedPhotos.push({
      ...p,
      type: p.blob.type || "image/jpeg",
      blob: await blobToBase64(p.blob),
      thumb: await blobToBase64(p.thumb),
    });
  }
  const data: ExportFile = {
    app: "hagen",
    version: 1,
    exportedAt: Date.now(),
    plants,
    areas,
    rules,
    completions,
    settings: settings ? { ...settings, pushSubscription: undefined, pushLastSync: undefined } : undefined,
    photos: exportedPhotos,
    background: background ? { ...background, type: background.blob.type || "image/jpeg", blob: await blobToBase64(background.blob) } : undefined,
    assets: exportedAssets,
  };
  return new Blob([JSON.stringify(data)], { type: "application/json" });
}

export async function importAll(file: Blob): Promise<{ plants: number; photos: number }> {
  const data = JSON.parse(await file.text()) as ExportFile;
  if (data.app !== "hagen") throw new Error("Dette er ikke en eksportfil fra Hagen.");
  const photos: Photo[] = data.photos.map((p) => ({
    id: p.id,
    plantId: p.plantId,
    takenAt: p.takenAt,
    note: p.note,
    blob: base64ToBlob(p.blob, p.type),
    thumb: base64ToBlob(p.thumb, p.type),
  }));
  await db.transaction("rw", [db.plants, db.areas, db.rules, db.completions, db.settings, db.photos, db.mapBackground, db.assets], async () => {
    await Promise.all([db.plants.clear(), db.areas.clear(), db.rules.clear(), db.completions.clear(), db.photos.clear(), db.mapBackground.clear(), db.assets.clear()]);
    for (const a of data.assets ?? []) {
      const { type, blob, ...rest } = a;
      await db.assets.put({ ...rest, blob: base64ToBlob(blob, type) });
    }
    if (data.background) {
      const { type, blob, ...rest } = data.background;
      await db.mapBackground.put({ ...rest, id: "bg", blob: base64ToBlob(blob, type) });
    }
    await db.plants.bulkPut(data.plants);
    await db.areas.bulkPut(data.areas);
    await db.rules.bulkPut(data.rules);
    await db.completions.bulkPut(data.completions);
    await db.photos.bulkPut(photos);
    if (data.settings) {
      const current = await db.settings.get("settings");
      await db.settings.put({
        ...data.settings,
        id: "settings",
        pushSubscription: current?.pushSubscription,
        pushServerUrl: current?.pushServerUrl ?? data.settings.pushServerUrl,
        pushServerKey: current?.pushServerKey ?? data.settings.pushServerKey,
      });
    }
  });
  return { plants: data.plants.length, photos: photos.length };
}

/** Deler eller laster ned filen. På iOS gir deling mulighet for "Lagre i Filer". */
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
