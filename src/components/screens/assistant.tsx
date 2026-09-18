"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, History, SquarePen, Trash2, Copy, ExternalLink, Check, KeyRound, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState } from "@/components/page";
import { AssistantChat } from "@/components/assistant-chat";
import { db } from "@/lib/db";
import { EMPTY, useVisualViewport } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { buildGardenContext, buildGardenPrompt, claudeUrl, SUGGESTED_QUESTIONS } from "@/lib/claude";
import { resolveTransport, type ChatTransport } from "@/lib/llm-client";
import { createConversation, deleteConversation, refreshSummary } from "@/lib/chat";
import { isWithinSession } from "@/lib/chat-sessions";
import { tasksForMonth } from "@/lib/tasks";
import { currentMonth, currentYear, formatRelative } from "@/lib/dates";
import type { Area, ChatConversation, Plant } from "@/lib/types";
import { cn } from "cn";

type Props = {
  /** Planten samtalen skal handle om (fra plantesiden). */
  focusPlantId?: string;
  /** Ferdig spørsmål som legges i skrivefeltet. */
  initialQuestion?: string;
};

function plantSuggestions(plant: Plant): string[] {
  const n = plant.name.toLowerCase();
  return [
    `Hvordan steller jeg ${n} gjennom året?`,
    `Når og hvordan beskjærer jeg ${n}?`,
    `Kan jeg ta stiklinger eller frø fra ${n}, og når?`,
    `Hva kan være galt hvis ${n} ser dårlig ut?`,
  ];
}

export function AssistantScreen({ focusPlantId, initialQuestion }: Props) {
  const settings = useSettings();
  // Stabil referanse, så effekter som avhenger av leverandøren ikke kjører på hver render.
  const transport = useMemo(() => resolveTransport(settings), [settings]);
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const completions = useLiveQuery(() => db.completions.where("year").equals(currentYear()).toArray(), []) ?? EMPTY;
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const conversations = useLiveQuery(() => db.chatConversations.orderBy("updatedAt").reverse().toArray(), []);

  const monthTasks = useMemo(() => tasksForMonth(currentMonth(), currentYear(), rules, plants, completions), [rules, plants, completions]);

  if (!transport) {
    const focusPlant = plants.find((p) => p.id === focusPlantId);
    return <ClaudeLinkScreen settings={settings} plants={plants} areas={areas} monthTasks={monthTasks} focusPlant={focusPlant} initialQuestion={initialQuestion} />;
  }
  return (
    <ChatScreen
      transport={transport}
      plants={plants}
      areas={areas}
      monthTasks={monthTasks}
      conversations={conversations}
      settings={settings}
      focusPlantId={focusPlantId}
      initialQuestion={initialQuestion}
    />
  );
}

type ChatScreenProps = {
  transport: ChatTransport;
  plants: Plant[];
  areas: Area[];
  monthTasks: ReturnType<typeof tasksForMonth>;
  conversations: ChatConversation[] | undefined;
  settings: ReturnType<typeof useSettings>;
  focusPlantId?: string;
  initialQuestion?: string;
};

function ChatScreen({ transport, plants, areas, monthTasks, conversations, settings, focusPlantId, initialQuestion }: ChatScreenProps) {
  /** undefined = ikke bestemt ennå, null = ny samtale. */
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  /** Samtalen ble valgt fra historikken, så den fortsettes selv om det er lenge siden sist. */
  const pinnedRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const transportRef = useRef(transport);
  const [historyOpen, setHistoryOpen] = useState(false);
  const viewport = useVisualViewport();

  // Ved åpning: fortsett siste samtale hvis den er under en time gammel, ellers start blankt.
  useEffect(() => {
    let cancelled = false;
    db.chatConversations
      .orderBy("updatedAt")
      .reverse()
      .first()
      .then((latest) => {
        if (cancelled) return;
        const fresh = latest !== undefined && isWithinSession(latest.updatedAt);
        const matchesFocus = !focusPlantId || latest?.plantId === focusPlantId;
        setActiveId((current) => (current !== undefined ? current : fresh && matchesFocus ? latest.id : null));
      });
    return () => {
      cancelled = true;
    };
  }, [focusPlantId]);

  useEffect(() => {
    activeIdRef.current = activeId ?? null;
    transportRef.current = transport;
  }, [activeId, transport]);

  // Når skjermen forlates, oppdateres sammendraget hvis samtalen har vokst.
  useEffect(
    () => () => {
      if (activeIdRef.current) void refreshSummary(transportRef.current, activeIdRef.current, "close");
    },
    []
  );

  const active = useMemo(() => (activeId ? (conversations ?? []).find((c) => c.id === activeId) ?? null : null), [activeId, conversations]);
  const focusPlant = useMemo(() => plants.find((p) => p.id === (activeId === null || activeId === undefined ? focusPlantId : active?.plantId)), [plants, activeId, focusPlantId, active]);
  const context = useMemo(() => buildGardenContext({ settings, plants, areas, monthTasks, focusPlant }), [settings, plants, areas, monthTasks, focusPlant]);
  const suggestions = focusPlant ? plantSuggestions(focusPlant) : SUGGESTED_QUESTIONS;

  function leave(previousId: string | null | undefined) {
    if (previousId) void refreshSummary(transport, previousId, "close");
  }

  async function resolveConversation(question: string): Promise<string> {
    const current = activeId ? await db.chatConversations.get(activeId) : undefined;
    if (current && (pinnedRef.current || isWithinSession(current.updatedAt))) return current.id;
    leave(current?.id);
    const created = await createConversation(question, focusPlant?.id);
    pinnedRef.current = false;
    setActiveId(created.id);
    return created.id;
  }

  function startNew() {
    leave(activeId);
    pinnedRef.current = false;
    setActiveId(null);
    setHistoryOpen(false);
  }

  function openConversation(id: string) {
    if (id !== activeId) leave(activeId);
    pinnedRef.current = true;
    setActiveId(id);
    setHistoryOpen(false);
  }

  async function remove(id: string) {
    await deleteConversation(id);
    if (id === activeId) {
      pinnedRef.current = false;
      setActiveId(null);
    }
  }

  const frameStyle = viewport.keyboardOpen
    ? { top: viewport.offsetTop, height: viewport.height }
    : { top: 0, bottom: "calc(var(--tabbar-height) + var(--safe-bottom))" };

  return (
    <>
      <div className="fixed inset-x-0 z-10 flex flex-col bg-background" style={frameStyle}>
        <PageHeader
          title="Assistent"
          subtitle={active ? active.title : focusPlant ? `Ny samtale om ${focusPlant.name.toLowerCase()}` : "Ny samtale"}
          className="shrink-0"
          action={
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Historikk" onClick={() => setHistoryOpen(true)}>
                <History className="size-5" />
              </Button>
              <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Ny samtale" disabled={!activeId} onClick={startNew}>
                <SquarePen className="size-5" />
              </Button>
            </div>
          }
        />
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-2">
          {activeId !== undefined && (
            <AssistantChat
              transport={transport}
              context={context}
              conversation={active}
              resolveConversation={resolveConversation}
              focusPlant={focusPlant}
              initialQuestion={initialQuestion}
              suggestions={suggestions}
              plantCount={plants.length}
            />
          )}
        </div>
      </div>
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        conversations={conversations ?? EMPTY}
        activeId={activeId ?? null}
        plants={plants}
        onSelect={openConversation}
        onNew={startNew}
        onDelete={remove}
      />
    </>
  );
}

function bucketLabel(ts: number, now: Date): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.floor((startOfToday - new Date(new Date(ts).setHours(0, 0, 0, 0)).getTime()) / 86_400_000);
  if (days <= 0) return "I dag";
  if (days === 1) return "I går";
  if (days < 7) return "Siste 7 dager";
  if (days < 30) return "Siste 30 dager";
  return "Eldre";
}

function formatWhen(ts: number): string {
  const d = new Date(ts);
  if (d.toDateString() === new Date().toDateString()) {
    return `i dag ${new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(d)}`;
  }
  return formatRelative(ts);
}

function HistorySheet({
  open,
  onOpenChange,
  conversations,
  activeId,
  plants,
  onSelect,
  onNew,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversations: ChatConversation[];
  activeId: string | null;
  plants: Plant[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const plantName = (id?: string) => (id ? plants.find((p) => p.id === id)?.name : undefined);

  const groups = useMemo(() => {
    const now = new Date();
    const out: { label: string; items: ChatConversation[] }[] = [];
    for (const c of conversations) {
      const label = bucketLabel(c.updatedAt, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations]);

  function close(next: () => void) {
    setConfirmId(null);
    next();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirmId(null);
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="flex flex-col rounded-t-3xl px-0 pb-[calc(var(--safe-bottom)+0.75rem)] data-[side=bottom]:h-[82dvh]">
        <SheetHeader className="px-5 pb-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-primary" /> Historikk
          </SheetTitle>
          <SheetDescription>Spørsmål som kommer innen en time samles i én samtale. Trykk på en for å fortsette den.</SheetDescription>
        </SheetHeader>

        <div className="px-5">
          <Button variant="outline" className="h-11 w-full rounded-xl bg-card" onClick={() => close(onNew)}>
            <SquarePen data-icon="inline-start" /> Ny samtale uten kontekst
          </Button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          {conversations.length === 0 ? (
            <EmptyState icon={<MessageCircle className="size-6" />} title="Ingen samtaler ennå" description="Samtalene dine lagres her, bare på denne enheten." />
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mb-4">
                <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h3>
                <ul className="flex flex-col gap-1.5">
                  {g.items.map((c) => {
                    const plant = plantName(c.plantId);
                    const confirming = confirmId === c.id;
                    return (
                      <li key={c.id} className={cn("flex items-stretch gap-1 rounded-2xl border border-border bg-card", c.id === activeId && "border-primary/40 bg-accent/40")}>
                        <button type="button" onClick={() => close(() => onSelect(c.id))} className="min-w-0 flex-1 px-3.5 py-2.5 text-left">
                          <p className="truncate text-sm font-medium">{c.title}</p>
                          {c.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatWhen(c.updatedAt)} · {c.messageCount === 1 ? "1 melding" : `${c.messageCount} meldinger`}
                            {plant ? ` · ${plant}` : ""}
                          </p>
                        </button>
                        {confirming ? (
                          <div className="flex shrink-0 flex-col justify-center gap-1 pr-2">
                            <Button variant="destructive" size="sm" className="h-8 rounded-lg" onClick={() => onDelete(c.id).then(() => setConfirmId(null))}>
                              Slett
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 rounded-lg" onClick={() => setConfirmId(null)}>
                              Avbryt
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Slett samtalen ${c.title}`}
                            onClick={() => setConfirmId(c.id)}
                            className="flex shrink-0 items-center px-3 text-muted-foreground/60 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Uten KI-leverandør: spørsmålet åpnes i Claude-appen med konteksten lagt inn. */
function ClaudeLinkScreen({
  settings,
  plants,
  areas,
  monthTasks,
  focusPlant,
  initialQuestion = "",
}: {
  settings: ReturnType<typeof useSettings>;
  plants: Plant[];
  areas: Area[];
  monthTasks: ReturnType<typeof tasksForMonth>;
  focusPlant?: Plant;
  initialQuestion?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [copied, setCopied] = useState(false);
  const suggestions = focusPlant ? plantSuggestions(focusPlant) : SUGGESTED_QUESTIONS;
  const prompt = useMemo(
    () => buildGardenPrompt(question || "Hva bør jeg gjøre i hagen nå?", { settings, plants, areas, monthTasks, focusPlant }),
    [question, settings, plants, areas, monthTasks, focusPlant]
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignorer
    }
  }

  return (
    <>
      <PageHeader title="Assistent" subtitle={focusPlant ? `Spør om ${focusPlant.name.toLowerCase()}` : "Spør Claude om hagen"} />
      <Page className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Spørsmålet åpnes i Claude-appen din med informasjon om {focusPlant ? focusPlant.name : "plantene dine"}, stedet og datoen lagt inn.
        </p>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors",
                question === s ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Skriv spørsmålet ditt ..." rows={3} className="min-h-24 resize-none rounded-xl bg-card text-base" />

        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="h-11 flex-1 bg-card" onClick={copy}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Kopiert" : "Kopier"}
          </Button>
          <Button size="lg" className="h-11 flex-[2]" nativeButton={false} render={<a href={claudeUrl(prompt)} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink data-icon="inline-start" />
            Åpne i Claude
          </Button>
        </div>

        <Link href="/innstillinger/" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            {settings.llmApiKey ? <KeyRound className="size-5" /> : <Sparkles className="size-5" />}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Vil du ha svaret her i appen?</span>
            <span className="block text-xs text-muted-foreground">
              {settings.llmApiKey && !settings.llmModel
                ? "Nøkkelen er lagt inn, men ingen modell er valgt. Gå til innstillinger og trykk «Hent modeller»."
                : "Sett opp en gratis KI-leverandør i innstillinger. Da lagres samtalene dine her, med plantene dine som kontekst."}
            </span>
          </span>
        </Link>
      </Page>
    </>
  );
}
