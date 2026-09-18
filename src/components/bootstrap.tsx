"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
import { buildStandardRules, standardRuleKey } from "@/lib/care-rules";
import { DEFAULT_SETTINGS, type CareRule } from "@/lib/types";
import { syncSchedule } from "@/lib/push";
import { ensurePlantFacts } from "@/lib/plant-facts";

/**
 * Rydder opp dupliserte standardregler (kunne oppstå når oppstarten kjørte to ganger samtidig),
 * legger inn standardregler første gang, og synker varselplanen.
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

    // Standardregler som har fått aldersintervall i en nyere versjon (deling av stauder): oppdater den lagrede regelen.
    for (const t of buildStandardRules(Date.now())) {
      const stored = kept.get(standardRuleKey(t));
      if (t.everyYears && stored && stored.everyYears === undefined) {
        await db.rules.update(stored.id, { everyYears: t.everyYears, description: t.description });
      }
    }

    if (!settings.seededRules) {
      const missing = buildStandardRules(Date.now()).filter((r) => !kept.has(standardRuleKey(r)));
      if (missing.length > 0) await db.rules.bulkPut(missing);
      await db.settings.put({ ...settings, seededRules: true });
    }
  });
}

export function Bootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await prepareDatabase();
      if (cancelled) return;
      const settings = await db.settings.get("settings");
      if (settings?.pushSubscription && settings.pushServerUrl) {
        const stale = !settings.pushLastSync || Date.now() - settings.pushLastSync > 6 * 3600_000;
        if (stale) syncSchedule(settings).catch(() => undefined);
      }
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
