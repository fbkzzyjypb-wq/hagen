/** Ren logikk for hvordan meldinger samles i samtaler. Uten databasetilgang, så den kan brukes i migreringer. */

/** Meldinger med mer enn dette mellom seg havner i hver sin samtale. */
export const SESSION_GAP_MS = 60 * 60 * 1000;

/** Om en samtale fortsatt er «åpen», altså at neste spørsmål skal legges til den. */
export function isWithinSession(lastActivity: number, now = Date.now()): boolean {
  return now - lastActivity < SESSION_GAP_MS;
}

/** Deler en tidssortert liste i bolker der avstanden mellom to meldinger er under grensen. */
export function groupIntoSessions<T extends { createdAt: number }>(sorted: T[], gapMs = SESSION_GAP_MS): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (const item of sorted) {
    if (current.length > 0 && item.createdAt - last >= gapMs) {
      groups.push(current);
      current = [];
    }
    current.push(item);
    last = item.createdAt;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** Tittel å bruke før KI har laget en: starten på første spørsmål. */
export function fallbackTitle(question: string, maxLength = 48): string {
  const text = question.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > maxLength / 2 ? cut.slice(0, atWord) : cut).replace(/[,.;:!?]+$/, "")} …`;
}
