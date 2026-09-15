import Dexie, { type EntityTable } from "dexie";
import type { Area, CareRule, Photo, Plant, Settings, TaskCompletion } from "./types";

class HagenDB extends Dexie {
  plants!: EntityTable<Plant, "id">;
  areas!: EntityTable<Area, "id">;
  photos!: EntityTable<Photo, "id">;
  rules!: EntityTable<CareRule, "id">;
  completions!: EntityTable<TaskCompletion, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("hagen");
    this.version(1).stores({
      plants: "id, name, category, profileKey, createdAt",
      areas: "id, kind",
      photos: "id, plantId, takenAt",
      rules: "id, scope, plantId, category, source",
      completions: "id, ruleId, [ruleId+year+month], [ruleId+plantId+year+month], year",
      settings: "id",
    });
  }
}

export const db = new HagenDB();
