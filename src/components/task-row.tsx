"use client";

import { plantTitle } from "@/lib/types";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import type { TaskItem } from "@/lib/tasks";

export function TaskRow({ task, compact = false }: { task: TaskItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!task.rule.description || task.plants.length > 0;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="text-[15px] leading-snug font-medium">{task.rule.title}</span>
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
              {plantTitle(p)}
            </Link>
          ))}
          {!expanded && task.plants.length > 3 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{task.plants.length - 3}</span>
          )}
        </div>
      )}

      {expanded && task.rule.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{task.rule.description}</p>}
    </li>
  );
}
