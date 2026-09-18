"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { buildStandardRules, standardRuleKey } from "@/lib/care-rules";
import { DEFAULT_SETTINGS, type CareRule } from "@/lib/types";
import { ensurePlantFacts } from "@/lib/plant-facts";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Rydder opp dupliserte standardregler (kunne oppstå når oppstarten kjørte to ganger samtidig),
 * og legger inn standardregler som mangler (første gang, eller nye i en nyere versjon).
 */
async function prepareDatabase() {
  await db.transaction("rw", [db.rules, db.completions, db.settings], async () => {
    const settings = (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
    const rules = (await db.rules.toArray()).sort((a, b) => a.createdAt - b.createdAt);

    const kept = new Map<string, CareRule>();
    const remap = new Map<string, string>();
    for (const r of rules) {
      if (r.source !== "standard" || r.scope === "plant" || !r.key) continue;
      const k = standardRuleKey(r);
      const first = kept.get(k);
      if (first) remap.set(r.id, first.id);
      else kept.set(k, r);
    }
    if (remap.size > 0) {
      for (const [from, to] of remap) {
        await db.completions.where("ruleId").equals(from).modify({ ruleId: to });
      }
      await db.rules.bulkDelete([...remap.keys()]);
    }

    const standard = buildStandardRules(Date.now());
    for (const t of standard) {
      const stored = kept.get(standardRuleKey(t));
      if (!stored) continue;
      // Standardregler som har fått aldersintervall i en nyere versjon (deling av stauder): oppdater den lagrede regelen.
      if (t.everyYears && stored.everyYears === undefined) {
        await db.rules.update(stored.id, { everyYears: t.everyYears, description: t.description });
      }
      // Hageoppgavene kan ikke redigeres i appen, så de følger malen når den endres i en nyere versjon.
      if (t.scope === "garden" && (stored.title !== t.title || stored.description !== t.description || stored.months.join() !== t.months.join())) {
        await db.rules.update(stored.id, { title: t.title, description: t.description, months: t.months });
      }
    }

    // Standardregler kan ikke slettes i appen, så de som mangler er enten første oppstart eller nye i en nyere versjon.
    const missing = standard.filter((r) => !kept.has(standardRuleKey(r)));
    if (missing.length > 0) await db.rules.bulkPut(missing);
    if (!settings.seededRules) await db.settings.put({ ...settings, seededRules: true });
  });
}

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
    let cancelled = false;
    (async () => {
      await prepareDatabase();
      if (cancelled) return;
      removeLegacyPush().catch(() => undefined);
      // Illustrasjonsbilder og miniatyrer fra tidligere versjoner. De vises ikke lenger og skal ikke fylle opp sikkerhetskopien.
      db.assets.where("id").startsWithAnyOf("plant:", "plant-thumb:").delete().catch(() => undefined);
      ensurePlantFacts().catch(() => undefined);
    })().catch((err) => console.warn("Klargjøring av databasen feilet", err));
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
