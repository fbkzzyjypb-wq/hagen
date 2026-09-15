import { MONTHS_NB } from "./types";

export function monthName(month: number, capitalize = false): string {
  const name = MONTHS_NB[(month - 1 + 12) % 12];
  return capitalize ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

export function formatDate(ts: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("nb-NO", opts).format(new Date(ts));
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.round(diff / 86_400_000);
  if (days <= 0) return "i dag";
  if (days === 1) return "i går";
  if (days < 7) return `${days} dager siden`;
  if (days < 30) return `${Math.round(days / 7)} uker siden`;
  return formatDate(ts, { day: "numeric", month: "short", year: "numeric" });
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function currentYear(): number {
  return new Date().getFullYear();
}
