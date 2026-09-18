"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlantThumb } from "@/components/plant-list-item";
import { factsFor } from "@/lib/plant-facts";
import { plantTitle, TOXICITY_LABELS, type Plant, type ToxicityLevel } from "@/lib/types";
import { cn } from "cn";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plants: Plant[];
};

/** Fra mest til minst giftig. Ukjent står sist, og er ikke det samme som ufarlig. */
const RANKED: { level: ToxicityLevel; className: string }[] = [
  { level: "meget", className: "text-destructive" },
  { level: "giftig", className: "text-destructive" },
  { level: "lite", className: "text-amber-700" },
  { level: "ufarlig", className: "text-primary" },
  { level: "ukjent", className: "text-muted-foreground" },
];

export function ToxicitySheet({ open, onOpenChange, plants }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        {open && <ToxicitySheetBody plants={plants} />}
      </SheetContent>
    </Sheet>
  );
}

function ToxicitySheetBody({ plants }: Pick<Props, "plants">) {
  /** Plantene gruppert etter giftighet. Planter som ikke er slått opp ennå, regnes som ukjente. */
  const groups = useMemo(() => {
    const rows = plants
      .map((plant) => ({ plant, toxicity: factsFor(plant)?.facts.toxicity }))
      .sort((a, b) => plantTitle(a.plant).localeCompare(plantTitle(b.plant), "nb"));
    return RANKED.map((r) => ({ ...r, rows: rows.filter((row) => (row.toxicity?.level ?? "ukjent") === r.level) })).filter((g) => g.rows.length > 0);
  }, [plants]);

  return (
    <>
      <SheetHeader className="px-0 pb-0">
        <SheetTitle className="text-lg">Giftighet</SheetTitle>
        <SheetDescription>Plantene dine, fra mest til minst giftig for mennesker og kjæledyr. Opplysningene kan inneholde feil.</SheetDescription>
      </SheetHeader>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Du har ikke lagt inn noen planter ennå.</p>
      ) : (
        <div className="-mx-5 min-h-0 flex-1 overflow-y-auto border-y border-border">
          {groups.map((g) => (
            <section key={g.level}>
              <h3 className={cn("bg-muted/60 px-5 py-1.5 text-xs font-semibold tracking-wide uppercase", g.className)}>
                {TOXICITY_LABELS[g.level]} · {g.rows.length}
              </h3>
              <ul className="divide-y divide-border">
                {g.rows.map(({ plant, toxicity }) => (
                  <li key={plant.id}>
                    <Link href={`/plante/?id=${plant.id}`} className="flex items-center gap-3 px-5 py-2.5 active:bg-muted/60">
                      <PlantThumb plant={plant} className="size-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">{plantTitle(plant)}</p>
                        <p className="text-sm text-muted-foreground">{toxicity ? toxicity.note : "Ikke slått opp ennå."}</p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="shrink-0 text-xs text-muted-foreground">
        Har noen fått i seg en plante, ring Giftinformasjonen på{" "}
        <a href="tel:22591300" className="font-medium text-primary underline-offset-2 hover:underline">
          22 59 13 00
        </a>
        .
      </p>
    </>
  );
}
