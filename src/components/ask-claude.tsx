"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings";
import { resolveTransport } from "@/lib/llm-client";
import type { Plant } from "@/lib/types";

type Props = {
  focusPlant?: Plant;
  initialQuestion?: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
};

/** Lenke til assistenten på forsiden, eventuelt med en plante i fokus og et ferdig spørsmål. */
export function assistantHref(focusPlant?: Plant, initialQuestion?: string): string {
  const params = new URLSearchParams({ vis: "assistent" });
  if (focusPlant) params.set("plante", focusPlant.id);
  if (initialQuestion) params.set("q", initialQuestion);
  return `/?${params.toString()}`;
}

export function AskClaudeButton({ focusPlant, initialQuestion, label, variant = "default", size = "lg", className }: Props) {
  const settings = useSettings();
  const transport = resolveTransport(settings);
  return (
    <Button variant={variant} size={size} className={className} nativeButton={false} render={<Link href={assistantHref(focusPlant, initialQuestion)} />}>
      <Sparkles data-icon="inline-start" />
      {label ?? `Spør ${transport?.label ?? "Claude"}`}
    </Button>
  );
}
