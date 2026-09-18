"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PlantThumb } from "@/components/plant-list-item";
import { addPlantsToBed, inBed } from "@/lib/beds";
import { categoryInfo, plantTitle, type Area, type Plant } from "@/lib/types";
import { cn } from "cn";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Bedet plantene legges i. */
  bed: Area;
  plants: Plant[];
  beds: Area[];
};

export function BedPlantPicker({ open, onOpenChange, bed, plants, beds }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
        {open && <BedPlantPickerBody bed={bed} plants={plants} beds={beds} onOpenChange={onOpenChange} />}
      </SheetContent>
    </Sheet>
  );
}

function BedPlantPickerBody({ bed, plants, beds, onOpenChange }: Omit<Props, "open">) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  /** Plantene som ikke står i bedet, med planter uten bed først. */
  const candidates = useMemo(() => {
    const outside = plants.filter((p) => !inBed(p, bed.id));
    return [...outside.filter((p) => !p.beds?.length), ...outside.filter((p) => p.beds?.length)];
  }, [plants, bed.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((p) => p.name.toLowerCase().includes(q) || p.latinName?.toLowerCase().includes(q) || p.variety?.toLowerCase().includes(q));
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function add() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    try {
      await addPlantsToBed([...selected], bed.id);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader className="px-0 pb-0">
        <SheetTitle className="text-lg">Legg til eksisterende planter</SheetTitle>
        <SheetDescription>Velg plantene som står i «{bed.name}». Antallet kan du justere i plantens skjema etterpå.</SheetDescription>
      </SheetHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk i plantene" className="h-11 rounded-xl bg-card pl-9" type="search" />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{candidates.length === 0 ? "Alle plantene står allerede i bedet." : "Ingen treff."}</p>
      ) : (
        <ul className="-mx-5 min-h-0 flex-1 divide-y divide-border overflow-y-auto border-y border-border">
          {filtered.map((p) => {
            const checked = selected.has(p.id);
            const bedNames = (p.beds ?? []).map((b) => beds.find((a) => a.id === b.areaId)?.name).filter(Boolean);
            return (
              <li key={p.id}>
                <button type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-muted/60">
                  <PlantThumb plant={p} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{plantTitle(p)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {categoryInfo(p.category).label} · {bedNames.length > 0 ? `Står i ${bedNames.join(", ")}` : "Uten bed"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                    )}
                  >
                    {checked && <Check className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button size="lg" className="h-12 shrink-0 rounded-xl text-base" disabled={selected.size === 0 || saving} onClick={add}>
        {selected.size === 0 ? "Velg planter" : selected.size === 1 ? "Legg til 1 plante" : `Legg til ${selected.size} planter`}
      </Button>
    </>
  );
}
