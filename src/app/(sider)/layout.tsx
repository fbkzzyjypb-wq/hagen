import type { ReactNode } from "react";

/**
 * Undersidene (plante, plassering, identifisering, innstillinger) ligger i samme avrundede flate som forsiden, men
 * ruller med siden, så `PageHeader` fester seg rett under statuslinjen (`--header-top`).
 */
export default function SubpageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)", paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}>
      <div className="rounded-[28px] bg-card pb-4" style={{ minHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 1.5rem)" }}>
        {children}
      </div>
    </div>
  );
}
