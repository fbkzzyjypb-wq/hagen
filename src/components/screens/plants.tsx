"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ChevronRight, ListPlus, Pencil, Plus, Search, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState, Section } from "@/components/page";
import { PlantForm, type PlantFormInitial } from "@/components/plant-form";
import { PlantListItem } from "@/components/plant-list-item";
import { BedDialog } from "@/components/bed-dialog";
import { BedPlantPicker } from "@/components/bed-plant-picker";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { bedsOf, inBed, quantityInBed, totalQuantity } from "@/lib/beds";
import { areaInfo, PLANT_CATEGORIES, type Area, type Plant, type PlantCategory } from "@/lib/types";
import { cn } from "cn";

export function PlantsScreen({ bedId }: { bedId?: string }) {
  const router = useRouter();
  const settings = useSettings();
  const plants = useLiveQuery(() => db.plants.orderBy("name").toArray(), []) ?? EMPTY;
  const areas = useLiveQuery(() => db.areas.toArray(), []);
  const beds = useMemo(() => bedsOf(areas ?? []), [areas]);
  const activeBed = bedId ? beds.find((b) => b.id === bedId) : undefined;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlantCategory | "alle">("alle");
  const [addInitial, setAddInitial] = useState<PlantFormInitial | null>(null);
  const [bedDialog, setBedDialog] = useState<{ bed: Area | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const scoped = useMemo(() => (activeBed ? plants.filter((p) => inBed(p, activeBed.id)) : plants), [plants, activeBed]);
  /** Det finnes planter utenfor bedet som kan legges i det. */
  const canAddExisting = !!activeBed && scoped.length < plants.length;
  const totalCount = useMemo(() => scoped.reduce((sum, p) => sum + (activeBed ? quantityInBed(p, activeBed.id) : totalQuantity(p)), 0), [scoped, activeBed]);

  const usedCategories = useMemo(() => {
    const set = new Set(scoped.map((p) => p.category));
    return PLANT_CATEGORIES.filter((c) => set.has(c.value));
  }, [scoped]);

  const filtering = query.trim().length > 0 || category !== "alle";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(
      (p) =>
        (category === "alle" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.latinName?.toLowerCase().includes(q) || p.variety?.toLowerCase().includes(q))
    );
  }, [scoped, query, category]);

  /** Grupper per bed, pluss planter uten bed. Bare når det finnes bed og vi ikke står i ett bestemt bed. */
  const groups = useMemo(() => {
    if (activeBed || beds.length === 0) return null;
    return {
      sections: beds.map((bed) => ({ bed, plants: filtered.filter((p) => inBed(p, bed.id)) })),
      loose: filtered.filter((p) => !p.beds || p.beds.length === 0),
    };
  }, [activeBed, beds, filtered]);

  const showMap = !!settings.showMap;

  if (bedId && areas !== undefined && !activeBed) {
    return (
      <Page className="pt-16">
        <EmptyState title="Fant ikke bedet" action={<Button nativeButton={false} render={<Link href="/planter/" />}>Til plantelisten</Button>} />
      </Page>
    );
  }

  return (
    <>
      <PageHeader
        title={activeBed ? activeBed.name : "Planter"}
        subtitle={`${activeBed ? `${areaInfo(activeBed.kind).label} · ` : ""}${scoped.length === 1 ? "1 plante" : `${scoped.length} planter`}${totalCount > scoped.length ? ` · ${totalCount} stk` : ""}`}
        leading={
          activeBed ? (
            <Button variant="ghost" size="icon-lg" className="-ml-2 rounded-full" nativeButton={false} render={<Link href="/planter/" aria-label="Tilbake" />}>
              <ArrowLeft className="size-5" />
            </Button>
          ) : undefined
        }
        action={
          <div className="flex items-center gap-1">
            {activeBed && (
              <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Endre bed" onClick={() => setBedDialog({ bed: activeBed })}>
                <Pencil className="size-5" />
              </Button>
            )}
            <Button
              size="icon-lg"
              className="rounded-full"
              aria-label="Ny plante"
              onClick={() => setAddInitial(activeBed ? { beds: [{ areaId: activeBed.id, quantity: 1 }] } : {})}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        }
      />
      <Page>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk i plantene" className="h-11 rounded-xl bg-card pl-9" type="search" />
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
          {scoped.length === 0 ? (
            <EmptyState
              icon={<Sprout className="size-6" />}
              title={activeBed ? "Ingen planter i bedet ennå" : "Ingen planter enda"}
              description={activeBed ? "Legg til plantene som står her, eller velg blant plantene du allerede har lagt inn." : "Legg inn plantene i hagen din. Kjente planter får ferdig stell-kalender."}
              action={
                <div className="flex flex-col gap-2">
                  <Button className="h-11 rounded-xl" onClick={() => setAddInitial(activeBed ? { beds: [{ areaId: activeBed.id, quantity: 1 }] } : {})}>
                    <Plus data-icon="inline-start" /> Legg til plante
                  </Button>
                  {canAddExisting && (
                    <Button variant="outline" className="h-11 rounded-xl bg-card" onClick={() => setPickerOpen(true)}>
                      <ListPlus data-icon="inline-start" /> Legg til eksisterende planter
                    </Button>
                  )}
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState title="Ingen treff" description="Prøv et annet søk eller en annen kategori." />
          ) : groups ? (
            <div className="flex flex-col gap-5">
              {groups.sections.map(({ bed, plants: list }) => {
                if (list.length === 0 && filtering) return null;
                const count = list.reduce((sum, p) => sum + quantityInBed(p, bed.id), 0);
                return (
                  <section key={bed.id}>
                    <Link href={`/planter/?bed=${bed.id}`} className="mb-2 flex items-center justify-between gap-2 px-1">
                      <span className="flex min-w-0 items-center gap-1 text-sm font-semibold">
                        <span className="truncate">{bed.name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {areaInfo(bed.kind).label} · {list.length === 1 ? "1 plante" : `${list.length} planter`}
                        {count > list.length ? ` · ${count} stk` : ""}
                      </span>
                    </Link>
                    {list.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">Ingen planter i dette bedet ennå.</p>
                    ) : (
                      <PlantCard plants={list} countFor={(p) => quantityInBed(p, bed.id)} showMap={showMap} />
                    )}
                  </section>
                );
              })}
              {groups.loose.length > 0 && (
                <Section title="Uten bed" className="mt-0">
                  <PlantCard plants={groups.loose} countFor={totalQuantity} showMap={showMap} />
                </Section>
              )}
            </div>
          ) : (
            <PlantCard plants={filtered} countFor={(p) => (activeBed ? quantityInBed(p, activeBed.id) : totalQuantity(p))} showMap={showMap} />
          )}
        </div>

        {canAddExisting && scoped.length > 0 && (
          <div className="mt-4">
            <Button variant="outline" className="h-11 w-full rounded-xl bg-card" onClick={() => setPickerOpen(true)}>
              <ListPlus data-icon="inline-start" /> Legg til eksisterende planter
            </Button>
          </div>
        )}

        {!activeBed && (
          <div className="mt-4">
            <Button variant="outline" className="h-11 w-full rounded-xl bg-card" onClick={() => setBedDialog({ bed: null })}>
              <Plus data-icon="inline-start" /> Nytt bed
            </Button>
            {beds.length === 0 && plants.length > 0 && (
              <p className="mt-2 px-1 text-center text-xs text-muted-foreground">Lag bed for å gruppere plantene, for eksempel «Eplehekken» eller «Bedet ved terrassen».</p>
            )}
          </div>
        )}
      </Page>

      <PlantForm
        open={addInitial !== null}
        onOpenChange={(o) => {
          if (!o) setAddInitial(null);
        }}
        initial={addInitial ?? undefined}
      />
      <BedDialog
        open={bedDialog !== null}
        onOpenChange={(o) => {
          if (!o) setBedDialog(null);
        }}
        bed={bedDialog?.bed}
        onDeleted={() => {
          if (activeBed) router.replace("/planter/");
        }}
      />
      {activeBed && <BedPlantPicker open={pickerOpen} onOpenChange={setPickerOpen} bed={activeBed} plants={plants} beds={beds} />}
    </>
  );
}

function PlantCard({ plants, countFor, showMap }: { plants: Plant[]; countFor: (p: Plant) => number; showMap: boolean }) {
  return (
    <Card className="py-0">
      <ul className="divide-y divide-border">
        {plants.map((p) => (
          <PlantListItem key={p.id} plant={p} count={countFor(p)} showMap={showMap} />
        ))}
      </ul>
    </Card>
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
