"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUp, Square, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SimpleMarkdown } from "@/components/simple-markdown";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { appendMessage, refreshSummary } from "@/lib/chat";
import { CHAT_SYSTEM_PROMPT } from "@/lib/claude";
import { streamAnswer, type ChatTransport } from "@/lib/llm-client";
import { formatDate } from "@/lib/dates";
import type { ChatConversation, ChatMessage, Plant } from "@/lib/types";
import { cn } from "cn";

type Props = {
  transport: ChatTransport;
  /** Kontekst om hagen (planter, sted, dato) som sendes med hvert kall. */
  context: string;
  /** Samtalen som vises. null = ny samtale som ikke er opprettet ennå. */
  conversation: ChatConversation | null;
  /** Finner (eller oppretter) samtalen en ny melding skal legges i. */
  resolveConversation: (question: string) => Promise<string>;
  focusPlant?: Plant;
  initialQuestion?: string;
  suggestions: string[];
  plantCount: number;
};

function startedLabel(conversation: ChatConversation): string {
  const d = new Date(conversation.createdAt);
  const time = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(d);
  const today = d.toDateString() === new Date().toDateString();
  return today ? `Startet i dag kl. ${time}` : `Startet ${formatDate(conversation.createdAt, { day: "numeric", month: "long" })} kl. ${time}`;
}

export function AssistantChat({ transport, context, conversation, resolveConversation, focusPlant, initialQuestion = "", suggestions, plantCount }: Props) {
  const conversationId = conversation?.id ?? null;
  const loaded = useLiveQuery(
    () => (conversationId ? db.chatMessages.where("conversationId").equals(conversationId).sortBy("createdAt") : Promise.resolve([] as ChatMessage[])),
    [conversationId]
  );
  const messages = loaded ?? EMPTY;
  const [input, setInput] = useState(initialQuestion);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Samtalen svaret som strømmes hører til. */
  const streamingForRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streaming = draft !== null;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, draft, conversationId]);

  // Bytter brukeren samtale midt i et svar, avbrytes strømmen (det som er kommet lagres i riktig samtale).
  useEffect(() => {
    if (abortRef.current && streamingForRef.current !== conversationId) abortRef.current.abort();
  }, [conversationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (initialQuestion) inputRef.current?.focus();
  }, [initialQuestion]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;
    setError(null);
    setInput("");
    setDraft("");

    const ac = new AbortController();
    abortRef.current = ac;
    let id: string;
    let collected = "";
    try {
      id = await resolveConversation(question);
      streamingForRef.current = id;
      const prior = id === conversationId ? messages : [];
      await appendMessage(id, "user", question);
      const history = [...prior.slice(-20).map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: question }];

      await streamAnswer({
        transport,
        system: CHAT_SYSTEM_PROMPT,
        context,
        history,
        signal: ac.signal,
        onText: (delta) => {
          collected += delta;
          setDraft(collected);
        },
      });
      if (collected) {
        await appendMessage(id, "assistant", collected);
        void refreshSummary(transport, id, "reply");
      }
    } catch (err) {
      if (ac.signal.aborted && collected && streamingForRef.current) {
        await appendMessage(streamingForRef.current, "assistant", collected);
      } else if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
      }
    } finally {
      abortRef.current = null;
      streamingForRef.current = null;
      setDraft(null);
    }
  }

  const intro =
    plantCount > 0
      ? `${transport.label} kjenner alle de ${plantCount === 1 ? "1 planten" : `${plantCount} plantene`} dine, stedet og hva som står på planen denne måneden.`
      : `${transport.label} kjenner stedet ditt og hva som står på planen denne måneden. Legg inn plantene dine, så får du svar tilpasset dem.`;
  const showEmpty = loaded !== undefined && messages.length === 0 && !streaming;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="no-scrollbar -mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        {showEmpty ? (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-sm text-muted-foreground">
              {focusPlant ? `Spør om ${focusPlant.name.toLowerCase()}, eller start med et forslag:` : `${intro} Spør om hva du vil, eller start med et forslag:`}
            </p>
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5 py-2">
            {conversation && messages.length > 0 && <li className="py-1 text-center text-[11px] text-muted-foreground">{startedLabel(conversation)}</li>}
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
                    m.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"
                  )}
                >
                  {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <SimpleMarkdown text={m.content} />}
                </div>
              </li>
            ))}
            {streaming && (
              <li className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-[15px] leading-relaxed">
                  {draft ? (
                    <SimpleMarkdown text={draft} />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Tenker ...
                    </span>
                  )}
                </div>
              </li>
            )}
          </ul>
        )}
        {error && <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </div>

      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={focusPlant ? `Spør om ${focusPlant.name.toLowerCase()} ...` : "Spør om hagen ..."}
          rows={1}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-card text-base"
        />
        {streaming ? (
          <Button type="button" size="icon-lg" variant="secondary" className="size-11 shrink-0 rounded-full" aria-label="Stopp" onClick={() => abortRef.current?.abort()}>
            <Square className="size-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" className="size-11 shrink-0 rounded-full" aria-label="Send" disabled={!input.trim()}>
            <ArrowUp className="size-5" />
          </Button>
        )}
      </form>

      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Sparkles className="size-3" /> {transport.label} · {transport.model}
      </p>
    </div>
  );
}
