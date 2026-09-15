"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "./types";

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get("settings"), []);
  return s ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Omit<Settings, "id">>): Promise<void> {
  const current = (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
  await db.settings.put({ ...current, ...patch, id: "settings" });
}
