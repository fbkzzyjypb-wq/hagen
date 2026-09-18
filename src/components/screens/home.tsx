"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Map as MapIcon, ChevronRight, Camera, Sprout, Settings, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { GardenPreview } from "@/components/garden-preview";
import { Page, Section } from "@/components/page";
import { AskClaudeButton } from "@/components/ask-claude";
import { PlantForm } from "@/components/plant-form";
import { ToxicitySheet } from "@/components/toxicity-sheet";
import { BlobImage } from "@/components/blob-image";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { tasksForMonth } from "@/lib/tasks";
import { currentMonth, currentYear, monthName, formatRelative } from "@/lib/dates";
import { isPlaced } from "@/lib/geometry";
import { bedsOf } from "@/lib/beds";
import { plantTitle } from "@/lib/types";

export function HomeScreen() {
  const settings = useSettings();
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const recentPhotos = useLiveQuery(() => db.photos.orderBy("takenAt").reverse().limit(8).toArray(), []) ?? EMPTY;
  const photoCount = useLiveQuery(() => db.photos.count(), []) ?? 0;
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const bedCount = useMemo(() => bedsOf(areas).length, [areas]);
  const [addOpen, setAddOpen] = useState(false);
  const [toxicityOpen, setToxicityOpen] = useState(false);

  const month = currentMonth();
  const year = currentYear();
  const tasks = useMemo(() => tasksForMonth(month, year, rules, plants), [month, year, rules, plants]);
  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const onMap = plants.filter(isPlaced).length;

  const hour = new Date().getHours();
  const greeting = hour < 10 ? "God morgen" : hour < 18 ? "God dag" : "God kveld";

  return (
    <>
      <PageHeader
        title="Hei"
        subtitle={`${greeting} · ${new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}`}
        action={
          <Button variant="ghost" size="icon-lg" className="rounded-full" nativeButton={false} render={<Link href="/innstillinger/" aria-label="Innstillinger" />}>
            <Settings className="size-5" />
          </Button>
        }
      />
      <Page>
        {settings.showMap && (
          <div className="mb-3">
            <GardenPreview plants={plants} width={settings.mapWidth} height={settings.mapHeight} />
          </div>
        )}
        <Card className="overflow-hidden border-0 bg-primary text-primary-foreground ring-0 [--card-spacing:--spacing(5)]">
          <div className="flex items-start justify-between px-(--card-spacing)">
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">Oppgaver i hagen · {monthName(month)}</p>
              <p className="mt-0.5 font-heading text-3xl font-semibold tracking-tight">
                {tasks.length === 0 ? "Ingenting planlagt" : `${tasks.length} forslag`}
              </p>
            </div>
            <Link href="/oppgaver/" className="mt-1 flex items-center gap-0.5 text-sm font-medium text-primary-foreground/90">
              Alle <ChevronRight className="size-4" />
            </Link>
          </div>
        </Card>

        <div className={`mt-4 grid gap-2 ${settings.showMap ? "grid-cols-4" : "grid-cols-3"}`}>
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" onClick={() => setAddOpen(true)}>
            <Plus className="size-5 text-primary" />
            <span className="text-xs">Ny plante</span>
          </Button>
          {settings.showMap && (
            <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" nativeButton={false} render={<Link href="/kart/" />}>
              <MapIcon className="size-5 text-primary" />
              <span className="text-xs">Hagekart</span>
            </Button>
          )}
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" nativeButton={false} render={<Link href="/identifiser/" />}>
            <Camera className="size-5 text-primary" />
            <span className="text-xs">Identifiser</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" onClick={() => setToxicityOpen(true)}>
            <Skull className="size-5 text-primary" />
            <span className="text-xs">Giftighet</span>
          </Button>
        </div>

        <div className="mt-3">
          <AskClaudeButton className="h-12 w-full rounded-2xl text-base" />
        </div>

        {recentPhotos.length > 0 && (
          <Section title="Siste bilder">
            <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
              {recentPhotos.map((p) => {
                const plant = plantById.get(p.plantId);
                return (
                  <Link key={p.id} href={`/plante/?id=${p.plantId}`} className="w-28 shrink-0">
                    <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                      <BlobImage blob={p.thumb} alt={plant ? plantTitle(plant) : "Bilde"} className="size-full object-cover" />
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">{plant ? plantTitle(plant) : "Ukjent plante"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{formatRelative(p.takenAt)}</p>
                  </Link>
                );
              })}
            </div>
          </Section>
        )}

        <Section title="Hagen i tall">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Planter" value={plants.length} href="/planter/" />
            {settings.showMap ? <Stat label="På kartet" value={onMap} href="/kart/" /> : <Stat label="Plasseringer" value={bedCount} href="/planter/" />}
            <Stat label="Bilder" value={photoCount} href="/planter/" />
          </div>
        </Section>

        {plants.length === 0 && (
          <Section>
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-8 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Sprout className="size-6" />
              </span>
              <p className="font-medium">Kom i gang</p>
              <p className="mt-1 text-sm text-muted-foreground">Legg inn plantene du har i hagen, så får du en stell-kalender tilpasset dem.</p>
              <Button className="mt-4 h-11 rounded-xl" onClick={() => setAddOpen(true)}>
                <Plus data-icon="inline-start" /> Legg til første plante
              </Button>
            </div>
          </Section>
        )}
      </Page>
      <PlantForm open={addOpen} onOpenChange={setAddOpen} />
      <ToxicitySheet open={toxicityOpen} onOpenChange={setToxicityOpen} plants={plants} />
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border bg-card px-3 py-3">
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
