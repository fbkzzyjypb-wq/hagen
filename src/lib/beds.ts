import { db } from "./db";
import { newId } from "./id";
import type { Area, AreaKind, Plant } from "./types";

/** Områdetyper som kan brukes som bed, altså grupper av planter. Hus, sti og vann finnes bare på kartet. */
export const BED_KINDS: AreaKind[] = ["bed", "kjokkenhage", "krukker", "hekk", "plen", "terrasse", "annet"];

export function isBedKind(kind: AreaKind): boolean {
  return BED_KINDS.includes(kind);
}

/** Bedene sortert på navn. */
export function bedsOf(areas: Area[]): Area[] {
  return areas.filter((a) => isBedKind(a.kind)).sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export function inBed(plant: Plant, areaId: string): boolean {
  return plant.beds?.some((b) => b.areaId === areaId) ?? false;
}

/** Antall av planten i et bed. */
export function quantityInBed(plant: Plant, areaId: string): number {
  const entry = plant.beds?.find((b) => b.areaId === areaId);
  return entry ? Math.max(1, entry.quantity ?? 1) : 0;
}

/** Antall eksemplarer totalt. */
export function totalQuantity(plant: Plant): number {
  return Math.max(1, plant.quantity ?? 1);
}

export async function createBed(name: string, kind: AreaKind): Promise<Area> {
  const bed: Area = { id: newId(), name: name.trim(), kind, points: [], createdAt: Date.now() };
  await db.areas.add(bed);
  return bed;
}

/** Legger eksisterende planter i bedet. Planter uten bed tar med seg hele antallet, planter som alt står i et bed får ett eksemplar til. */
export async function addPlantsToBed(plantIds: string[], areaId: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", [db.plants], async () => {
    const plants = await db.plants.bulkGet(plantIds);
    for (const p of plants) {
      if (!p || inBed(p, areaId)) continue;
      const beds = [...(p.beds ?? []), { areaId, quantity: p.beds?.length ? 1 : totalQuantity(p) }];
      const total = beds.reduce((sum, b) => sum + Math.max(1, b.quantity ?? 1), 0);
      await db.plants.update(p.id, { beds, quantity: total >= 2 ? total : undefined, updatedAt: now });
    }
  });
}

/** Sletter bedet. Plantene beholdes, men tas ut av bedet. */
export async function deleteBed(id: string): Promise<void> {
  await db.transaction("rw", [db.areas, db.plants], async () => {
    const affected = await db.plants.filter((p) => inBed(p, id)).toArray();
    for (const p of affected) {
      const beds = (p.beds ?? []).filter((b) => b.areaId !== id);
      await db.plants.update(p.id, { beds: beds.length > 0 ? beds : undefined });
    }
    await db.areas.delete(id);
  });
}
