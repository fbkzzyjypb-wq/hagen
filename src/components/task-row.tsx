"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import type { TaskItem } from "@/lib/tasks";
import { scheduleSyncSoon } from "@/lib/sync";

export async function toggleTask(task: TaskItem) {
  if (task.completion) {
    await db.completions.delete(task.completion.id);
  } else {
    await db.completions.add({
      id: newId(),
      ruleId: task.rule.id,
      plantId: task.rule.scope === "plant" ? task.rule.plantId : undefined,
      year: task.year,
      month: task.month,
      doneAt: Date.now(),
    });
  }
  scheduleSyncSoon();
}

export function TaskRow({ task, compact = false }: { task: TaskItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!task.rule.description || task.plants.length > 0;

  return (
    <li className={cn("flex gap-3 px-4 py-3", task.done && "opacity-60")}>
      <button
        type="button"
        aria-label={task.done ? "Merk som ikke gjort" : "Merk som gjort"}
        aria-pressed={task.done}
        onClick={() => toggleTask(task)}
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          task.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"
        )}
      >
        {task.done && <Check className="size-3.5" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => hasDetails && setExpanded((v) => !v)}
          className="flex w-full items-start justify-between gap-2 text-left"
        >
          <span className={cn("text-[15px] leading-snug font-medium", task.done && "line-through")}>{task.rule.title}</span>
          {hasDetails && !compact && (
            <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          )}
        </button>

        {task.plants.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {task.plants.slice(0, expanded ? undefined : 3).map((p) => (
              <Link
                key={p.id}
                href={`/plante/?id=${p.id}`}
                className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
              >
                {p.name}
              </Link>
            ))}
            {!expanded && task.plants.length > 3 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{task.plants.length - 3}</span>
            )}
          </div>
        )}

        {expanded && task.rule.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{task.rule.description}</p>}
      </div>
    </li>
  );
}
