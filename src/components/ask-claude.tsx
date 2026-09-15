"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Copy, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { buildGardenPrompt, claudeUrl, SUGGESTED_QUESTIONS } from "@/lib/claude";
import { tasksForMonth } from "@/lib/tasks";
import { currentMonth, currentYear } from "@/lib/dates";
import type { Plant } from "@/lib/types";
import { cn } from "cn";

type Props = {
  focusPlant?: Plant;
  initialQuestion?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function AskClaudeButton({ focusPlant, initialQuestion, label = "Spør Claude", variant = "default", size = "lg", className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Sparkles data-icon="inline-start" />
        {label}
      </Button>
      <AskClaudeSheet open={open} onOpenChange={setOpen} focusPlant={focusPlant} initialQuestion={initialQuestion} />
    </>
  );
}

export function AskClaudeSheet({
  open,
  onOpenChange,
  focusPlant,
  initialQuestion = "",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  focusPlant?: Plant;
  initialQuestion?: string;
}) {
  const settings = useSettings();
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const completions = useLiveQuery(() => db.completions.where("year").equals(currentYear()).toArray(), []) ?? EMPTY;
  const [question, setQuestion] = useState(initialQuestion);
  const [copied, setCopied] = useState(false);

  const monthTasks = useMemo(() => tasksForMonth(currentMonth(), currentYear(), rules, plants, completions), [rules, plants, completions]);
  const prompt = useMemo(
    () => buildGardenPrompt(question || "Hva bør jeg gjøre i hagen nå?", { settings, plants, monthTasks, focusPlant }),
    [question, settings, plants, monthTasks, focusPlant]
  );

  const suggestions = focusPlant
    ? [
        `Hvordan steller jeg ${focusPlant.name.toLowerCase()} gjennom året?`,
        `Når og hvordan beskjærer jeg ${focusPlant.name.toLowerCase()}?`,
        `Kan jeg ta stiklinger eller frø fra ${focusPlant.name.toLowerCase()}, og når?`,
        `Hva kan være galt hvis ${focusPlant.name.toLowerCase()} ser dårlig ut?`,
      ]
    : SUGGESTED_QUESTIONS;

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        <SheetHeader className="px-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" />
            Spør Claude om hagen
          </SheetTitle>
          <SheetDescription>
            Spørsmålet åpnes i Claude-appen din med informasjon om {focusPlant ? focusPlant.name : "plantene dine"}, stedet og datoen lagt inn.
          </SheetDescription>
        </SheetHeader>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
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

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Skriv spørsmålet ditt ..."
          rows={3}
          className="min-h-24 resize-none rounded-xl text-base"
        />

        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="h-11 flex-1" onClick={copy}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Kopiert" : "Kopier"}
          </Button>
          <Button
            size="lg"
            className="h-11 flex-[2]"
            nativeButton={false} render={<a href={claudeUrl(prompt)} target="_blank" rel="noopener noreferrer" />}
            onClick={() => setTimeout(() => onOpenChange(false), 300)}
          >
            <ExternalLink data-icon="inline-start" />
            Åpne i Claude
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
