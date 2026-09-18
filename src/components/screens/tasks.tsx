"use client";

import { EMPTY } from "@/lib/hooks";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState } from "@/components/page";
import { TaskRow } from "@/components/task-row";
import { RuleForm } from "@/components/rule-form";
import { db } from "@/lib/db";
import { tasksForMonth } from "@/lib/tasks";
import { currentMonth, currentYear, monthName } from "@/lib/dates";
import { MONTHS_NB_SHORT } from "@/lib/types";
import { cn } from "cn";

export function TasksScreen() {
  const [month, setMonth] = useState(currentMonth());
  const thisMonth = currentMonth();
  const year = month < thisMonth - 6 ? currentYear() + 1 : currentYear();
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const [addOpen, setAddOpen] = useState(false);

  const tasks = useMemo(() => tasksForMonth(month, year, rules, plants), [month, year, rules, plants]);

  useEffect(() => {
    document.getElementById(`month-chip-${month}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [month]);

  return (
    <>
      <PageHeader
        title="Oppgaver i hagen"
        subtitle={`${monthName(month, true)} ${year}`}
        action={
          <Button size="icon-lg" className="rounded-full" onClick={() => setAddOpen(true)} aria-label="Ny oppgave">
            <Plus className="size-5" />
          </Button>
        }
      />
      <Page>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {MONTHS_NB_SHORT.map((label, i) => {
            const m = i + 1;
            const active = m === month;
            const isNow = m === thisMonth;
            return (
              <button
                key={m}
                id={`month-chip-${m}`}
                type="button"
                onClick={() => setMonth(m)}
                className={cn(
                  "relative h-9 shrink-0 rounded-full px-3.5 text-sm font-medium capitalize transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-border hover:bg-muted"
                )}
              >
                {label}
                {isNow && !active && <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {tasks.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<CalendarCheck className="size-6" />}
              title={`Ingenting planlagt i ${monthName(month)}`}
              description={plants.length === 0 ? "Legg til planter, så fylles kalenderen med oppgaver som passer dem." : "Legg til en egen oppgave for måneden om du vil."}
              action={
                <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={() => setAddOpen(true)}>
                  <Plus data-icon="inline-start" /> Ny oppgave
                </Button>
              }
            />
          </div>
        ) : (
          <Card className="mt-4 py-0">
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <TaskRow key={t.key} task={t} />
              ))}
            </ul>
          </Card>
        )}

        <p className="mt-6 px-1 text-center text-xs text-muted-foreground">
          Oppgavene er forslag til hva som kan gjøres, ut fra plantene dine og en månedsoversikt for mildt kystklima. Juster gjerne et par uker etter
          hvordan sesongen blir. Trykk på en oppgave for å lese mer.
        </p>
      </Page>
      <RuleForm open={addOpen} onOpenChange={setAddOpen} plants={plants} />
    </>
  );
}
