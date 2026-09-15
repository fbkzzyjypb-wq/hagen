"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState } from "@/components/page";
import { PlantForm } from "@/components/plant-form";
import { PlantListItem } from "@/components/plant-list-item";
import { db } from "@/lib/db";
import { PLANT_CATEGORIES, type PlantCategory } from "@/lib/types";
import { cn } from "cn";

export function PlantsScreen() {
  const plants = useLiveQuery(() => db.plants.orderBy("name").toArray(), []) ?? EMPTY;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlantCategory | "alle">("alle");
  const [addOpen, setAddOpen] = useState(false);

  const usedCategories = useMemo(() => {
    const set = new Set(plants.map((p) => p.category));
    return PLANT_CATEGORIES.filter((c) => set.has(c.value));
  }, [plants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plants.filter(
      (p) =>
        (category === "alle" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.latinName?.toLowerCase().includes(q) || p.variety?.toLowerCase().includes(q))
    );
  }, [plants, query, category]);

  return (
    <>
      <PageHeader
        title="Planter"
        subtitle={plants.length === 1 ? "1 plante" : `${plants.length} planter`}
        action={
          <Button size="icon-lg" className="rounded-full" onClick={() => setAddOpen(true)} aria-label="Ny plante">
            <Plus className="size-5" />
          </Button>
        }
      />
      <Page>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk i plantene"
            className="h-11 rounded-xl bg-card pl-9"
            type="search"
          />
        </div>

        {usedCategories.length > 1 && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            <Chip active={category === "alle"} onClick={() => setCategory("alle")}>
              Alle
            </Chip>
            {usedCategories.map((c) => (
              <Chip key={c.value} active={category === c.value} onClick={() => setCategory(c.value)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-4">
          {plants.length === 0 ? (
            <EmptyState
              icon={<Sprout className="size-6" />}
              title="Ingen planter enda"
              description="Legg inn plantene i hagen din. Kjente planter får ferdig stell-kalender."
              action={
                <Button className="h-11 rounded-xl" onClick={() => setAddOpen(true)}>
                  <Plus data-icon="inline-start" /> Legg til plante
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState title="Ingen treff" description="Prøv et annet søk eller en annen kategori." />
          ) : (
            <Card className="py-0">
              <ul className="divide-y divide-border">
                {filtered.map((p) => (
                  <PlantListItem key={p.id} plant={p} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </Page>
      <PlantForm open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
