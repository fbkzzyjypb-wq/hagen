import type { CareRule, Plant } from "./types";

export interface TaskItem {
  /** Unik nøkkel for oppgave + måned. */
  key: string;
  rule: CareRule;
  month: number;
  year: number;
  /** Planter oppgaven gjelder. Tom for hage-oppgaver. */
  plants: Plant[];
}

/** Året alderen regnes fra. Uten plantingsår brukes året planten ble lagt inn i appen. */
function plantedFrom(plant: Plant): number {
  return plant.plantedYear ?? new Date(plant.createdAt).getFullYear();
}

/** Om regelen gjelder planten dette året. Regler med `everyYears` følger plantens alder: 3 gir oppgaven når planten er 3, 6, 9 ... år. */
export function dueThisYear(rule: Pick<CareRule, "everyYears">, plant: Plant, year: number): boolean {
  if (!rule.everyYears || rule.everyYears < 2) return true;
  const age = year - plantedFrom(plant);
  return age > 0 && age % rule.everyYears === 0;
}

/** Neste år (fra og med `fromYear`) en regel med `everyYears` gjelder planten. */
export function nextDueYear(rule: Pick<CareRule, "everyYears">, plant: Plant, fromYear: number): number {
  const every = rule.everyYears && rule.everyYears >= 2 ? rule.everyYears : 1;
  const age = Math.max(1, fromYear - plantedFrom(plant));
  return plantedFrom(plant) + Math.ceil(age / every) * every;
}

/** Oppgaver for en gitt måned, utledet fra regler og planter. De er forslag til hva som kan gjøres, og hukes ikke av. */
export function tasksForMonth(month: number, year: number, rules: CareRule[], plants: Plant[]): TaskItem[] {
  const plantById = new Map(plants.map((p) => [p.id, p]));

  // Planter som har egen regel med samme nøkkel som en kategoriregel, skal ikke også få kategoriregelen.
  // Gjelder også avslåtte egne regler: slik slås en kategoriregel av for bare én plante (f.eks. deling av pion).
  const overriddenByPlant = new Map<string, Set<string>>();
  for (const r of rules) {
    if (r.scope === "plant" && r.plantId && r.key) {
      const set = overriddenByPlant.get(r.plantId) ?? new Set<string>();
      set.add(r.key);
      overriddenByPlant.set(r.plantId, set);
    }
  }

  const items: TaskItem[] = [];
  for (const rule of rules) {
    if (!rule.enabled || !rule.months.includes(month)) continue;

    if (rule.scope === "garden") {
      items.push({ key: `${rule.id}:${year}-${month}`, rule, month, year, plants: [] });
      continue;
    }

    if (rule.scope === "category") {
      const affected = plants.filter(
        (p) => p.category === rule.category && !(rule.key && overriddenByPlant.get(p.id)?.has(rule.key)) && dueThisYear(rule, p, year)
      );
      if (affected.length === 0) continue;
      items.push({ key: `${rule.id}:${year}-${month}`, rule, month, year, plants: affected });
      continue;
    }

    if (rule.scope === "plant" && rule.plantId) {
      const plant = plantById.get(rule.plantId);
      if (!plant || !dueThisYear(rule, plant, year)) continue;
      items.push({ key: `${rule.id}:${rule.plantId}:${year}-${month}`, rule, month, year, plants: [plant] });
    }
  }

  return items.sort((a, b) => a.rule.title.localeCompare(b.rule.title, "nb"));
}

/** Regler som gjelder en bestemt plante (egne regler + kategoriregler som ikke er overstyrt). */
export function rulesForPlant(plant: Plant, rules: CareRule[]): CareRule[] {
  const own = rules.filter((r) => r.scope === "plant" && r.plantId === plant.id);
  const ownKeys = new Set(own.filter((r) => r.key).map((r) => r.key));
  const category = rules.filter((r) => r.scope === "category" && r.category === plant.category && !(r.key && ownKeys.has(r.key)));
  return [...own, ...category].sort((a, b) => Math.min(...a.months) - Math.min(...b.months));
}
