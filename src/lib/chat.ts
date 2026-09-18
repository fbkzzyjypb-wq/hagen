import { db } from "./db";
import { newId } from "./id";
import { fallbackTitle } from "./chat-sessions";
import { completeText, type ChatTransport } from "./llm-client";
import type { ChatConversation, ChatMessage } from "./types";

export async function createConversation(firstQuestion: string, plantId?: string): Promise<ChatConversation> {
  const now = Date.now();
  const conversation: ChatConversation = {
    id: newId(),
    title: fallbackTitle(firstQuestion),
    plantId,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    summarizedCount: 0,
  };
  await db.chatConversations.add(conversation);
  return conversation;
}

export async function appendMessage(conversationId: string, role: ChatMessage["role"], content: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", [db.chatMessages, db.chatConversations], async () => {
    await db.chatMessages.add({ id: newId(), conversationId, role, content, createdAt: now });
    const conversation = await db.chatConversations.get(conversationId);
    if (conversation) await db.chatConversations.update(conversationId, { updatedAt: now, messageCount: conversation.messageCount + 1 });
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await db.transaction("rw", [db.chatMessages, db.chatConversations], async () => {
    await db.chatMessages.where("conversationId").equals(id).delete();
    await db.chatConversations.delete(id);
  });
}

const SUMMARY_SYSTEM = [
  "Du lager tittel og sammendrag for en samtale mellom en hobbygartner og en hageassistent.",
  'Svar bare med JSON på formen {"title": "...", "summary": "..."} og ingenting annet.',
  "title: 2–5 ord på norsk bokmål, uten punktum og anførselstegn, f.eks. Beskjæring av epletre.",
  "summary: én setning på norsk bokmål, maks 25 ord, som sier hva brukeren lurte på og hva rådet ble.",
].join("\n");

function parseSummary(raw: string): { title: string; summary: string } | null {
  const match = raw.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { title?: unknown; summary?: unknown };
    if (typeof parsed.title !== "string" || typeof parsed.summary !== "string") return null;
    const title = parsed.title.replace(/\s+/g, " ").replace(/^["«]|["»]$/g, "").replace(/[.]+$/, "").trim();
    const summary = parsed.summary.replace(/\s+/g, " ").trim();
    if (!title || !summary) return null;
    return { title: title.slice(0, 60), summary: summary.slice(0, 200) };
  } catch {
    return null;
  }
}

/**
 * Lager tittel og sammendrag med KI. Etter et svar bare første gang; når samtalen forlates hvis den har vokst siden sist.
 * Feiler stille, da beholdes forrige tittel.
 */
export async function refreshSummary(transport: ChatTransport, conversationId: string, reason: "reply" | "close"): Promise<void> {
  try {
    const conversation = await db.chatConversations.get(conversationId);
    if (!conversation) return;
    const newSince = conversation.messageCount - conversation.summarizedCount;
    const due = reason === "reply" ? conversation.summarizedCount === 0 : newSince >= 2;
    if (!due) return;

    const messages = await db.chatMessages.where("conversationId").equals(conversationId).sortBy("createdAt");
    if (!messages.some((m) => m.role === "assistant")) return;
    const transcript = messages
      .slice(-12)
      .map((m) => `${m.role === "user" ? "Bruker" : "Assistent"}: ${m.content.slice(0, 600)}`)
      .join("\n\n");

    const raw = await completeText({ transport, system: SUMMARY_SYSTEM, messages: [{ role: "user", content: transcript }], maxTokens: 200 });
    const parsed = parseSummary(raw);
    if (!parsed) return;
    await db.chatConversations.update(conversationId, { title: parsed.title, summary: parsed.summary, summarizedCount: conversation.messageCount });
  } catch {
    // Beholder forrige tittel og sammendrag.
  }
}
