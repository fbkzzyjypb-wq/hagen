import type { CSSProperties, ReactNode, Ref } from "react";
import { cn } from "cn";

/**
 * Den avrundede, hvite flaten alle visninger ligger i, med luft til skjermkantene og til status- og hjemlinjen.
 * Flaten ruller selv, så en `PageHeader` i den fester seg øverst i flaten (`--header-top` er null der). `scrollRef`
 * peker på flaten, for den som trenger å vite hvor langt den er rullet.
 */
export function Frame({ children, className, scrollRef }: { children: ReactNode; className?: string; scrollRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="flex h-full flex-col px-3" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)", paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}>
      <div
        ref={scrollRef}
        className={cn("relative min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[28px] bg-card", className)}
        style={{ "--header-top": "0px", touchAction: "pan-y" } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
