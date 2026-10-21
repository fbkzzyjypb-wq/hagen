"use client";

import { useSyncExternalStore } from "react";
import Dexie, { type EntityTable } from "dexie";
import { db } from "./db";
import { AuthError, refreshAccessToken, revokeToken, type Tokens } from "./google-auth";
import { createFolder, deleteFile, downloadFile, DriveError, driveUser, findByTag, getFile, listFolder, uploadFile, type DriveFile } from "./google-drive";
import { compressImage } from "./images";
import type { Area, ChatConversation, ChatMessage, CloudAccount, Identification, MapBackground, Photo, Plant, Settings } from "./types";

/**
 * Synkronisering mot Google Disk. Appen er fortsatt lokal først: alt ligger i databasen på telefonen, og dette er en
 * speiling av den til mappen «Hagen» i Disk. Hovedfilen `hagen.json` har alt unntatt selve bildene, som ligger som egne
 * filer den peker på, så en endring i en plante ikke laster opp bildene på nytt.
 *
 * Lokale endringer (fanget med hooks på tabellene) lastes opp noen sekunder senere. Ved oppstart, når nettet kommer
 * tilbake og når appen kommer i forgrunnen, sjekkes hovedfilen: har en annen telefon endret den, hentes den ned og
 * erstatter det lokale (eller flettes inn, om det også finnes lokale endringer som ikke er lastet opp). Bilder som
 * mangler lokalt hentes etterpå, ett om gangen. Ved innlogging med data både her og i Disk må brukeren velge retning.
 */

/** Hovedfilen i Disk. */
interface Snapshot {
  app: "hagen";
  version: 1;
  savedAt: number;
  plants: Plant[];
  areas: Area[];
  settings?: Settings;
  photos: (Omit<Photo, "blob" | "thumb"> & { file?: string })[];
  identifications: Identification[];
  identificationPhotos: { id: string; file: string }[];
  background?: Omit<MapBackground, "blob"> & { file?: string };
  chatConversations: ChatConversation[];
  chatMessages: ChatMessage[];
}

export type CloudPhase = "off" | "idle" | "syncing" | "offline" | "needs-login" | "choose" | "error";

export interface CloudStatus {
  phase: CloudPhase;
  message?: string;
  lastSyncAt?: number;
  progress?: { done: number; total: number; what: string };
  /** Ved innlogging med data både her og i Disk: brukeren må velge hva som skal gjelde. */
  choice?: { localPlants: number; localPhotos: number; remoteSavedAt?: number };
}

const OFF: CloudStatus = { phase: "off" };
let status: CloudStatus = OFF;
const listeners = new Set<() => void>();

function setStatus(patch: Partial<CloudStatus>) {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => OFF
  );
}

/** Ventetiden fra en lokal endring til opplastingen starter, så flere endringer på rad blir én opplasting. */
const PUSH_DELAY_MS = 4000;

let started = false;
let account: CloudAccount | null = null;
/** Over null mens vi selv skriver til databasen (henting fra Disk), så det ikke regnes som lokale endringer. */
let silent = 0;
let changedDuringRun = false;
let pushTimer: number | undefined;
let running: Promise<void> | null = null;
let runAgain = false;
/** Hovedfilen i Disk som venter på at brukeren velger retning etter innlogging. */
let pendingChoice: DriveFile | null = null;

async function persist(): Promise<void> {
  if (account) await db.cloud.put(account);
}

/** Kjører `fn` uten at skrivingene regnes som lokale endringer. */
async function silently<T>(fn: () => Promise<T>): Promise<T> {
  silent++;
  try {
    return await fn();
  } finally {
    silent--;
  }
}

function noteChange(table: string) {
  if (silent > 0 || !account) return;
  // Nytt kartbilde: det gamle i Disk gjelder ikke lenger, så det lastes opp på nytt.
  if (table === "mapBackground") delete account.files["map:bg"];
  changedDuringRun = true;
  if (!account.dirty) {
    account.dirty = true;
    // Hooken kjører inne i transaksjonen som endret tabellen, og den omfatter ikke kontotabellen.
    void Dexie.ignoreTransaction(() => persist());
  }
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => requestSync(), PUSH_DELAY_MS);
}

function installHooks() {
  const tables = [db.plants, db.areas, db.photos, db.settings, db.mapBackground, db.identifications, db.identificationPhotos, db.chatConversations, db.chatMessages];
  for (const table of tables) {
    const note = () => noteChange(table.name);
    table.hook("creating", note);
    table.hook("updating", note);
    table.hook("deleting", note);
  }
}

/** Kalles én gang ved oppstart: laster kontoen og synkroniserer om vi er logget inn. */
export async function startCloudSync(): Promise<void> {
  if (started) return;
  started = true;
  installHooks();
  account = (await db.cloud.get("google")) ?? null;
  if (!account) return;
  setStatus({ phase: navigator.onLine ? "idle" : "offline", lastSyncAt: account.lastSyncAt });
  requestSync();
}

/** Synkroniserer nå, eller rett etter at den som pågår er ferdig. Ingenting skjer uten innlogging. */
export function requestSync(): void {
  if (!account) return;
  window.clearTimeout(pushTimer);
  if (running) {
    runAgain = true;
    return;
  }
  running = run().finally(() => {
    running = null;
    if (runAgain) {
      runAgain = false;
      requestSync();
    }
  });
}

function fail(err: unknown) {
  if (err instanceof AuthError) {
    setStatus({ phase: "needs-login", message: err.message, progress: undefined });
    return;
  }
  if (!navigator.onLine || err instanceof TypeError) {
    setStatus({ phase: "offline", message: "Fikk ikke kontakt med Google Disk. Prøver igjen senere.", progress: undefined });
    return;
  }
  console.warn("Synkronisering mot Google Disk feilet", err);
  setStatus({ phase: "error", message: err instanceof Error ? err.message : "Synkroniseringen feilet.", progress: undefined });
}

async function run(): Promise<void> {
  if (!account || pendingChoice) return;
  if (!navigator.onLine) {
    setStatus({ phase: "offline", message: "Ingen nett. Synkroniserer når nettet er tilbake.", progress: undefined });
    return;
  }
  try {
    setStatus({ phase: "syncing", message: "Synkroniserer …", progress: undefined });
    await pull();
    if (account.dirty || !account.snapshotFileId) await push();
    setStatus({ phase: "idle", message: undefined, progress: undefined, lastSyncAt: account.lastSyncAt });
  } catch (err) {
    fail(err);
  }
}

/** Gyldig tilgangsnøkkel, fornyet når den er i ferd med å gå ut. */
async function token(): Promise<string> {
  if (!account) throw new AuthError("Ikke logget inn.");
  if (account.accessToken && (account.accessTokenExpiresAt ?? 0) > Date.now() + 60_000) return account.accessToken;
  const fresh = await refreshAccessToken(account.refreshToken);
  account.accessToken = fresh.accessToken;
  account.accessTokenExpiresAt = fresh.expiresAt;
  await persist();
  return fresh.accessToken;
}

/** Et Disk-kall, og ett forsøk til med ny nøkkel om Google sier nøkkelen er ugyldig. */
async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  try {
    return await fn(await token());
  } catch (err) {
    if (err instanceof DriveError && err.status === 401 && account) {
      account.accessTokenExpiresAt = 0;
      return fn(await token());
    }
    throw err;
  }
}

/** Mappen «Hagen» i Disk: finnes den ikke (lenger), lages den. */
async function folder(): Promise<string> {
  const a = account!;
  if (a.folderId) {
    const f = await withToken((t) => getFile(t, a.folderId!));
    if (f && !f.trashed) return a.folderId;
    // Brukeren har slettet mappen. Da er filene i den borte også.
    a.folderId = undefined;
    a.snapshotFileId = undefined;
    a.files = {};
  }
  const found = await withToken((t) => findByTag(t, "root"));
  a.folderId = found[0]?.id ?? (await withToken((t) => createFolder(t, "Hagen")));
  await persist();
  return a.folderId;
}

/** Hovedfilen i Disk, eller null når det ikke finnes noen ennå. */
async function remoteSnapshot(): Promise<DriveFile | null> {
  const a = account!;
  const folderId = await folder();
  if (a.snapshotFileId) {
    const f = await withToken((t) => getFile(t, a.snapshotFileId!));
    if (f && !f.trashed) return f;
    a.snapshotFileId = undefined;
  }
  const found = await withToken((t) => findByTag(t, "snapshot", folderId));
  if (!found[0]) return null;
  a.snapshotFileId = found[0].id;
  await persist();
  return found[0];
}

async function readSnapshot(file: DriveFile): Promise<Snapshot> {
  const text = await withToken(async (t) => (await downloadFile(t, file.id)).text());
  const snapshot = JSON.parse(text) as Snapshot;
  if (snapshot.app !== "hagen") throw new Error("Filen i Google Disk er ikke fra Hagen.");
  return snapshot;
}

/** Henter ned hovedfilen når en annen telefon har endret den. */
async function pull(): Promise<void> {
  const a = account!;
  const file = await remoteSnapshot();
  if (!file || !file.modifiedTime || file.modifiedTime === a.remoteModifiedTime) return;
  setStatus({ phase: "syncing", message: "Henter fra Google Disk …" });
  const snapshot = await readSnapshot(file);
  if (a.dirty) await mergeSnapshot(snapshot);
  else await applySnapshot(snapshot);
  // Filene hovedfilen peker på, kjenner vi nå, så de ikke lastes opp på nytt herfra.
  for (const p of snapshot.photos) if (p.file) a.files[`photo:${p.id}`] = p.file;
  for (const p of snapshot.identificationPhotos) a.files[`ident:${p.id}`] = p.file;
  if (snapshot.background?.file) a.files["map:bg"] = snapshot.background.file;
  a.remoteModifiedTime = file.modifiedTime;
  a.snapshotFileId = file.id;
  a.lastSyncAt = Date.now();
  await persist();
}

/** Det lokale byttes ut med det som ligger i Disk. Bilder vi alt har beholdes; de som mangler hentes etterpå. */
async function applySnapshot(s: Snapshot): Promise<void> {
  await silently(() =>
    db.transaction("rw", [db.plants, db.areas, db.settings, db.identifications, db.chatConversations, db.chatMessages, db.photos, db.identificationPhotos, db.mapBackground], async () => {
      await Promise.all([db.plants.clear(), db.areas.clear(), db.identifications.clear(), db.chatConversations.clear(), db.chatMessages.clear()]);
      await db.plants.bulkPut(s.plants);
      await db.areas.bulkPut(s.areas);
      await db.identifications.bulkPut(s.identifications);
      await db.chatConversations.bulkPut(s.chatConversations);
      await db.chatMessages.bulkPut(s.chatMessages);
      if (s.settings) await db.settings.put({ ...s.settings, id: "settings" });
      const wanted = new Map(s.photos.map((p) => [p.id, p]));
      for (const local of await db.photos.toArray()) {
        const meta = wanted.get(local.id);
        if (!meta) await db.photos.delete(local.id);
        else await db.photos.update(local.id, { plantId: meta.plantId, takenAt: meta.takenAt, note: meta.note });
      }
      const wantedIdent = new Set(s.identifications.map((i) => i.id));
      for (const key of (await db.identificationPhotos.toCollection().primaryKeys()) as string[]) {
        if (!wantedIdent.has(key)) await db.identificationPhotos.delete(key);
      }
      if (!s.background) await db.mapBackground.clear();
      else if (await db.mapBackground.get("bg")) {
        const { file: _file, ...meta } = s.background;
        void _file;
        await db.mapBackground.update("bg", meta);
      }
    })
  );
  await downloadMissing(s);
}

async function addMissing<T extends { id: string }>(table: EntityTable<T, "id">, rows: T[]): Promise<void> {
  const have = new Set((await table.toCollection().primaryKeys()) as string[]);
  const missing = rows.filter((r) => !have.has(r.id));
  if (missing.length > 0) await table.bulkPut(missing);
}

/**
 * Både Disk og telefonen har endringer: det som bare finnes i Disk legges til, det lokale beholdes, og alt lastes opp
 * etterpå. Ingenting slettes, så i verste fall dukker noe slettet opp igjen.
 */
async function mergeSnapshot(s: Snapshot): Promise<void> {
  await silently(() =>
    db.transaction("rw", [db.plants, db.areas, db.identifications, db.chatConversations, db.chatMessages], async () => {
      await addMissing(db.plants, s.plants);
      await addMissing(db.areas, s.areas);
      await addMissing(db.identifications, s.identifications);
      await addMissing(db.chatConversations, s.chatConversations);
      await addMissing(db.chatMessages, s.chatMessages);
    })
  );
  await downloadMissing(s);
}

/** Bilder hovedfilen peker på som ikke finnes lokalt, hentes ett om gangen. */
async function downloadMissing(s: Snapshot): Promise<void> {
  const havePhotos = new Set((await db.photos.toCollection().primaryKeys()) as string[]);
  const haveIdent = new Set((await db.identificationPhotos.toCollection().primaryKeys()) as string[]);
  const jobs: (() => Promise<void>)[] = [];
  for (const p of s.photos) {
    if (!p.file || havePhotos.has(p.id)) continue;
    const file = p.file;
    jobs.push(async () => {
      const blob = await withToken((t) => downloadFile(t, file));
      const thumb = await compressImage(blob, 320, 0.75);
      await silently(() => db.photos.put({ id: p.id, plantId: p.plantId, takenAt: p.takenAt, note: p.note, blob, thumb }));
    });
  }
  for (const p of s.identificationPhotos) {
    if (haveIdent.has(p.id)) continue;
    jobs.push(async () => {
      const blob = await withToken((t) => downloadFile(t, p.file));
      await silently(() => db.identificationPhotos.put({ id: p.id, blob }));
    });
  }
  if (s.background?.file && !(await db.mapBackground.get("bg"))) {
    const { file, ...meta } = s.background;
    jobs.push(async () => {
      const blob = await withToken((t) => downloadFile(t, file));
      await silently(() => db.mapBackground.put({ ...meta, id: "bg", blob }));
    });
  }
  for (let i = 0; i < jobs.length; i++) {
    setStatus({ phase: "syncing", message: undefined, progress: { done: i, total: jobs.length, what: "Henter bilder" } });
    await jobs[i]();
  }
}

async function buildSnapshot(files: Record<string, string>): Promise<Snapshot> {
  const [plants, areas, settings, photos, identifications, identPhotos, background, chatConversations, chatMessages] = await Promise.all([
    db.plants.toArray(),
    db.areas.toArray(),
    db.settings.get("settings"),
    db.photos.toArray(),
    db.identifications.toArray(),
    db.identificationPhotos.toArray(),
    db.mapBackground.get("bg"),
    db.chatConversations.toArray(),
    db.chatMessages.toArray(),
  ]);
  return {
    app: "hagen",
    version: 1,
    savedAt: Date.now(),
    plants,
    areas,
    settings,
    photos: photos.map((p) => ({ id: p.id, plantId: p.plantId, takenAt: p.takenAt, note: p.note, file: files[`photo:${p.id}`] })),
    identifications,
    identificationPhotos: identPhotos.flatMap((p) => (files[`ident:${p.id}`] ? [{ id: p.id, file: files[`ident:${p.id}`] }] : [])),
    background: background
      ? { id: "bg", pixelWidth: background.pixelWidth, pixelHeight: background.pixelHeight, x: background.x, y: background.y, width: background.width, height: background.height, opacity: background.opacity, file: files["map:bg"] }
      : undefined,
    chatConversations,
    chatMessages,
  };
}

/** Laster opp bilder som mangler i Disk, så hovedfilen, og rydder bort filer som ikke brukes lenger. */
async function push(): Promise<void> {
  const a = account!;
  const folderId = await folder();
  const files = a.files;
  const [photos, identPhotos, background] = await Promise.all([db.photos.toArray(), db.identificationPhotos.toArray(), db.mapBackground.get("bg")]);
  const uploads: { key: string; name: string; blob: Blob }[] = [];
  for (const p of photos) if (!files[`photo:${p.id}`]) uploads.push({ key: `photo:${p.id}`, name: `bilde-${p.id}.jpg`, blob: p.blob });
  for (const p of identPhotos) if (!files[`ident:${p.id}`]) uploads.push({ key: `ident:${p.id}`, name: `identifisering-${p.id}.jpg`, blob: p.blob });
  if (background && !files["map:bg"]) uploads.push({ key: "map:bg", name: "kartbakgrunn.jpg", blob: background.blob });
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    setStatus({ phase: "syncing", message: undefined, progress: { done: i, total: uploads.length, what: "Laster opp bilder" } });
    const res = await withToken((t) => uploadFile(t, { name: u.name, parent: folderId, tag: "photo", key: u.key, blob: u.blob }));
    files[u.key] = res.id;
    await persist();
  }

  setStatus({ phase: "syncing", message: "Laster opp …", progress: undefined });
  changedDuringRun = false;
  const snapshot = await buildSnapshot(files);
  const blob = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const res = await withToken((t) => uploadFile(t, { name: "hagen.json", parent: folderId, tag: "snapshot", blob, fileId: a.snapshotFileId }));
  a.snapshotFileId = res.id;
  a.remoteModifiedTime = res.modifiedTime;
  a.lastSyncAt = Date.now();
  // Kom det endringer mens vi lastet opp, må det en runde til.
  a.dirty = changedDuringRun;

  // Filer som ikke brukes lenger (slettede bilder): bort fra Disk og fra listen vår.
  const inUse = new Set([...photos.map((p) => `photo:${p.id}`), ...identPhotos.map((p) => `ident:${p.id}`), ...(background ? ["map:bg"] : [])]);
  for (const key of Object.keys(files)) if (!inUse.has(key)) delete files[key];
  const keep = new Set(Object.values(files));
  keep.add(res.id);
  for (const f of await withToken((t) => listFolder(t, folderId))) {
    if (!keep.has(f.id)) await withToken((t) => deleteFile(t, f.id));
  }
  await persist();
}

/**
 * Etter godkjent kode: kontoen lagres, mappen finnes, og første synkronisering avgjøres. Finnes det data både her og i
 * Disk, får brukeren velge (se `resolveChoice`); ellers går det av seg selv i den retningen som har noe.
 */
export async function finishLogin(tokens: Tokens): Promise<void> {
  account = { id: "google", refreshToken: tokens.refreshToken, accessToken: tokens.accessToken, accessTokenExpiresAt: tokens.expiresAt, files: {} };
  pendingChoice = null;
  await persist();
  setStatus({ phase: "syncing", message: "Kobler til Google Disk …", progress: undefined, choice: undefined, lastSyncAt: undefined });
  try {
    const user = await withToken((t) => driveUser(t));
    account.email = user.email;
    await persist();
    const file = await remoteSnapshot();
    const [plants, photos, identifications] = await Promise.all([db.plants.count(), db.photos.count(), db.identifications.count()]);
    const hasLocal = plants + photos + identifications > 0;
    if (file && hasLocal) {
      pendingChoice = file;
      setStatus({ phase: "choose", message: undefined, choice: { localPlants: plants, localPhotos: photos, remoteSavedAt: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined } });
      return;
    }
    account.dirty = !file && hasLocal;
    await persist();
    setStatus({ phase: "idle", message: undefined });
    requestSync();
  } catch (err) {
    fail(err);
  }
}

/** Brukerens valg etter innlogging: hente det som ligger i Disk (erstatter det lokale), eller laste opp det lokale (erstatter Disk). */
export async function resolveChoice(choice: "pull" | "push"): Promise<void> {
  if (!account || !pendingChoice) return;
  const file = pendingChoice;
  pendingChoice = null;
  if (choice === "pull") {
    account.dirty = false;
    account.remoteModifiedTime = undefined;
  } else {
    account.dirty = true;
    account.snapshotFileId = file.id;
    account.remoteModifiedTime = file.modifiedTime;
  }
  await persist();
  setStatus({ phase: "idle", choice: undefined });
  requestSync();
}

/** Logger ut: nøklene slettes her og trekkes tilbake hos Google. Dataene på telefonen og i Disk blir liggende. */
export async function logout(): Promise<void> {
  const current = account;
  account = null;
  pendingChoice = null;
  window.clearTimeout(pushTimer);
  await db.cloud.delete("google");
  setStatus({ phase: "off", message: undefined, progress: undefined, choice: undefined, lastSyncAt: undefined });
  if (current?.refreshToken) await revokeToken(current.refreshToken);
}
