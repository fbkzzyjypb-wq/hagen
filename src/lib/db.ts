import Dexie, { type EntityTable } from "dexie";
import type { Area, Asset, CareRule, ChatConversation, ChatMessage, MapBackground, Photo, Plant, Settings, TaskCompletion } from "./types";
import { fallbackTitle, groupIntoSessions } from "./chat-sessions";
import { newId } from "./id";

class HagenDB extends Dexie {
  plants!: EntityTable<Plant, "id">;
  areas!: EntityTable<Area, "id">;
  photos!: EntityTable<Photo, "id">;
  rules!: EntityTable<CareRule, "id">;
  completions!: EntityTable<TaskCompletion, "id">;
  settings!: EntityTable<Settings, "id">;
  mapBackground!: EntityTable<MapBackground, "id">;
  assets!: EntityTable<Asset, "id">;
  chatMessages!: EntityTable<ChatMessage, "id">;
  chatConversations!: EntityTable<ChatConversation, "id">;

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
    this.version(2).stores({
      plants: "id, name, category, profileKey, createdAt",
      areas: "id, kind",
      photos: "id, plantId, takenAt",
      rules: "id, scope, plantId, category, source",
      completions: "id, ruleId, [ruleId+year+month], [ruleId+plantId+year+month], year",
      settings: "id",
      mapBackground: "id",
    });
    this.version(3).stores({
      plants: "id, name, category, profileKey, createdAt",
      areas: "id, kind",
      photos: "id, plantId, takenAt",
      rules: "id, scope, plantId, category, source",
      completions: "id, ruleId, [ruleId+year+month], [ruleId+plantId+year+month], year",
      settings: "id",
      mapBackground: "id",
      assets: "id",
    });
    this.version(4).stores({
      plants: "id, name, category, profileKey, createdAt",
      areas: "id, kind",
      photos: "id, plantId, takenAt",
      rules: "id, scope, plantId, category, source",
      completions: "id, ruleId, [ruleId+year+month], [ruleId+plantId+year+month], year",
      settings: "id",
      mapBackground: "id",
      assets: "id",
      chatMessages: "id, createdAt",
    });
    this.version(5)
      .stores({
        plants: "id, name, category, profileKey, createdAt",
        areas: "id, kind",
        photos: "id, plantId, takenAt",
        rules: "id, scope, plantId, category, source",
        completions: "id, ruleId, [ruleId+year+month], [ruleId+plantId+year+month], year",
        settings: "id",
        mapBackground: "id",
        assets: "id",
        chatMessages: "id, conversationId, createdAt",
        chatConversations: "id, updatedAt",
      })
      .upgrade(async (tx) => {
        // Meldinger fra før samtaler fantes: samle dem i bolker med samme regel som i appen.
        type OldMessage = ChatMessage & { plantId?: string };
        const messages = ((await tx.table("chatMessages").toArray()) as OldMessage[]).sort((a, b) => a.createdAt - b.createdAt);
        for (const group of groupIntoSessions(messages)) {
          const first = group[0];
          const last = group[group.length - 1];
          const conversation: ChatConversation = {
            id: newId(),
            title: fallbackTitle(group.find((m) => m.role === "user")?.content ?? "Samtale"),
            plantId: first.plantId,
            createdAt: first.createdAt,
            updatedAt: last.createdAt,
            messageCount: group.length,
            summarizedCount: 0,
          };
          await tx.table("chatConversations").add(conversation);
          for (const m of group) await tx.table("chatMessages").update(m.id, { conversationId: conversation.id, plantId: undefined });
        }
      });
  }
}

export const db = new HagenDB();
