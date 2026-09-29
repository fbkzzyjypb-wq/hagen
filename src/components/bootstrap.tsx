"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { ensurePlantFacts } from "@/lib/plant-facts";
import { BASE_PATH } from "@/lib/base-path";
import type { Identification } from "@/lib/types";

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

/**
 * Bildene på identifiseringer lå først på selve oppføringen. Safari mister blobber som leses fra IndexedDB og lagres
 * igjen, og oppføringen skrives på nytt hver gang faktaene kommer. Bildene flyttes derfor til en egen tabell som bare
 * skrives én gang. Bytene leses utenfor transaksjonen, og bildet lagres som en ny blob.
 */
async function moveIdentificationPhotos() {
  type Legacy = Identification & { photo?: Blob };
  const legacy = ((await db.identifications.toArray()) as Legacy[]).filter((i) => i.photo instanceof Blob);
  for (const item of legacy) {
    const blob = new Blob([await item.photo!.arrayBuffer()], { type: item.photo!.type || "image/jpeg" });
    await db.transaction("rw", [db.identifications, db.identificationPhotos], async () => {
      if (!(await db.identificationPhotos.get(item.id))) await db.identificationPhotos.put({ id: item.id, blob });
      await db.identifications
        .where("id")
        .equals(item.id)
        .modify((rec) => {
          delete (rec as Legacy).photo;
        });
    });
  }
}

export function Bootstrap() {
  useEffect(() => {
    removeLegacyPush().catch(() => undefined);
    moveIdentificationPhotos().catch((err) => console.warn("Flytting av identifiseringsbilder feilet", err));
    // Illustrasjonsbilder og miniatyrer fra tidligere versjoner. De vises ikke lenger og skal ikke fylle opp sikkerhetskopien.
    db.assets.where("id").startsWithAnyOf("plant:", "plant-thumb:").delete().catch(() => undefined);
    ensurePlantFacts().catch(() => undefined);
  }, []);
  return null;
}
