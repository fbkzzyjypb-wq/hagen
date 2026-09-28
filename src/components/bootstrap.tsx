"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { ensurePlantFacts } from "@/lib/plant-facts";
import { BASE_PATH } from "@/lib/base-path";

const LEGACY_PUSH_KEYS = ["pushServerUrl", "pushServerKey", "pushSubscription", "pushLastSync", "notifyHour"];

/** Push-varsler er fjernet. Avslutter abonnementet og sletter innstillingene fra tidligere versjoner, så varselserveren slutter å sende. */
async function removeLegacyPush() {
  const stored = await db.settings.get("settings");
  if (stored && LEGACY_PUSH_KEYS.some((k) => k in stored)) {
    await db.settings.where("id").equals("settings").modify((s) => {
      for (const k of LEGACY_PUSH_KEYS) delete (s as unknown as Record<string, unknown>)[k];
    });
  }
  const reg = await navigator.serviceWorker?.getRegistration(`${BASE_PATH}/`);
  const sub = await reg?.pushManager?.getSubscription();
  await sub?.unsubscribe();
}

export function Bootstrap() {
  useEffect(() => {
    removeLegacyPush().catch(() => undefined);
    // Illustrasjonsbilder og miniatyrer fra tidligere versjoner. De vises ikke lenger og skal ikke fylle opp sikkerhetskopien.
    db.assets.where("id").startsWithAnyOf("plant:", "plant-thumb:").delete().catch(() => undefined);
    ensurePlantFacts().catch(() => undefined);
  }, []);
  return null;
}
