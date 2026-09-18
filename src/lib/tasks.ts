import type { CareRule, Plant, Settings, TaskCompletion } from "./types";
import { monthName, isoDate } from "./dates";

export interface TaskItem {
  /** Unik nøkkel for oppgave + måned. */
  key: string;
  rule: CareRule;
  month: number;
  year: number;
  /** Planter oppgaven gjelder. Tom for hage-oppgaver. */
  plants: Plant[];
  done: boolean;
  completion?: TaskCompletion;
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

function completionKey(ruleId: string, plantId: string | undefined, year: number, month: number) {
  return `${ruleId}|${plantId ?? ""}|${year}|${month}`;
}

/** Oppgaver for en gitt måned, utledet fra regler, planter og hva som er gjort. */
export function tasksForMonth(
  month: number,
  year: number,
  rules: CareRule[],
  plants: Plant[],
  completions: TaskCompletion[]
): TaskItem[] {
  const doneMap = new Map(completions.map((c) => [completionKey(c.ruleId, c.plantId, c.year, c.month), c]));
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
      const completion = doneMap.get(completionKey(rule.id, undefined, year, month));
      items.push({ key: `${rule.id}:${year}-${month}`, rule, month, year, plants: [], done: !!completion, completion });
      continue;
    }

    if (rule.scope === "category") {
      const affected = plants.filter(
        (p) => p.category === rule.category && !(rule.key && overriddenByPlant.get(p.id)?.has(rule.key)) && dueThisYear(rule, p, year)
      );
      if (affected.length === 0) continue;
      const completion = doneMap.get(completionKey(rule.id, undefined, year, month));
      items.push({ key: `${rule.id}:${year}-${month}`, rule, month, year, plants: affected, done: !!completion, completion });
      continue;
    }

    if (rule.scope === "plant" && rule.plantId) {
      const plant = plantById.get(rule.plantId);
      if (!plant || !dueThisYear(rule, plant, year)) continue;
      const completion = doneMap.get(completionKey(rule.id, rule.plantId, year, month));
      items.push({
        key: `${rule.id}:${rule.plantId}:${year}-${month}`,
        rule,
        month,
        year,
        plants: [plant],
        done: !!completion,
        completion,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.rule.title.localeCompare(b.rule.title, "nb");
  });
}

/** Regler som gjelder en bestemt plante (egne regler + kategoriregler som ikke er overstyrt). */
export function rulesForPlant(plant: Plant, rules: CareRule[]): CareRule[] {
  const own = rules.filter((r) => r.scope === "plant" && r.plantId === plant.id);
  const ownKeys = new Set(own.filter((r) => r.key).map((r) => r.key));
  const category = rules.filter((r) => r.scope === "category" && r.category === plant.category && !(r.key && ownKeys.has(r.key)));
  return [...own, ...category].sort((a, b) => Math.min(...a.months) - Math.min(...b.months));
}

export interface ScheduleItem {
  date: string; // YYYY-MM-DD
  title: string;
  body: string;
  url?: string;
}

function summarize(items: TaskItem[]): string {
  const titles = items.map((t) => t.rule.title);
  const head = titles.slice(0, 3).join(", ");
  const rest = titles.length - 3;
  return rest > 0 ? `${head} og ${rest} til` : head;
}

/**
 * Bygger varselplan for de neste månedene: ett varsel ved månedsstart med månedens oppgaver,
 * og en påminnelse midt i måneden om det som ikke er gjort.
 */
export function buildNotificationSchedule(
  rules: CareRule[],
  plants: Plant[],
  completions: TaskCompletion[],
  settings: Settings,
  from: Date = new Date(),
  monthsAhead = 4
): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  const today = isoDate(from);

  for (let i = 0; i <= monthsAhead; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const items = tasksForMonth(month, year, rules, plants, completions);
    const open = items.filter((t) => !t.done);
    if (open.length === 0) continue;

    const first = isoDate(new Date(year, month - 1, 1));
    const mid = isoDate(new Date(year, month - 1, 15));
    const name = monthName(month);

    if (first >= today) {
      out.push({
        date: first,
        title: `Hageoppgaver i ${name}`,
        body: `${open.length} ${open.length === 1 ? "oppgave" : "oppgaver"} i ${settings.gardenName}: ${summarize(open)}.`,
        url: "/oppgaver/",
      });
    }
    if (mid >= today) {
      out.push({
        date: mid,
        title: `Fortsatt å gjøre i ${name}`,
        body: `${summarize(open)}.`,
        url: "/oppgaver/",
      });
    }
  }
  return out;
}
