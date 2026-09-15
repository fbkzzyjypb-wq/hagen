"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Settings, Plus, Map as MapIcon, ChevronRight, Bell, Camera, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Page, Section } from "@/components/page";
import { TaskRow } from "@/components/task-row";
import { AskClaudeButton } from "@/components/ask-claude";
import { PlantForm } from "@/components/plant-form";
import { BlobImage } from "@/components/blob-image";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";
import { tasksForMonth } from "@/lib/tasks";
import { currentMonth, currentYear, monthName, formatRelative } from "@/lib/dates";

export function HomeScreen() {
  const settings = useSettings();
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const completions = useLiveQuery(() => db.completions.where("year").equals(currentYear()).toArray(), []) ?? EMPTY;
  const recentPhotos = useLiveQuery(() => db.photos.orderBy("takenAt").reverse().limit(8).toArray(), []) ?? EMPTY;
  const photoCount = useLiveQuery(() => db.photos.count(), []) ?? 0;
  const [addOpen, setAddOpen] = useState(false);

  const month = currentMonth();
  const year = currentYear();
  const tasks = useMemo(() => tasksForMonth(month, year, rules, plants, completions), [month, year, rules, plants, completions]);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.length - open.length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const onMap = plants.filter((p) => p.position).length;

  const hour = new Date().getHours();
  const greeting = hour < 10 ? "God morgen" : hour < 18 ? "God dag" : "God kveld";

  return (
    <>
      <PageHeader
        title={settings.gardenName}
        subtitle={`${greeting} · ${new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}`}
        action={
          <Button variant="ghost" size="icon-lg" className="rounded-full" nativeButton={false} render={<Link href="/innstillinger/" aria-label="Innstillinger" />}>
            <Settings className="size-5" />
          </Button>
        }
      />
      <Page>
        <Card className="overflow-hidden border-0 bg-primary text-primary-foreground ring-0 [--card-spacing:--spacing(5)]">
          <div className="flex flex-col gap-4 px-(--card-spacing)">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Oppgaver i {monthName(month)}</p>
                <p className="mt-0.5 font-heading text-3xl font-semibold tracking-tight">
                  {tasks.length === 0 ? "Ingenting planlagt" : open.length === 0 ? "Alt er gjort" : `${open.length} å gjøre`}
                </p>
              </div>
              <Link href="/oppgaver/" className="mt-1 flex items-center gap-0.5 text-sm font-medium text-primary-foreground/90">
                Alle <ChevronRight className="size-4" />
              </Link>
            </div>
            {tasks.length > 0 && (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
                  <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-primary-foreground/80">
                  {done} av {tasks.length} gjort
                </p>
              </div>
            )}
          </div>
        </Card>

        {open.length > 0 && (
          <Card className="mt-3 py-1">
            <ul className="divide-y divide-border">
              {open.slice(0, 4).map((t) => (
                <TaskRow key={t.key} task={t} compact />
              ))}
            </ul>
            {open.length > 4 && (
              <Link href="/oppgaver/" className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary">
                Se {open.length - 4} til
              </Link>
            )}
          </Card>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" onClick={() => setAddOpen(true)}>
            <Plus className="size-5 text-primary" />
            <span className="text-xs">Ny plante</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" nativeButton={false} render={<Link href="/kart/" />}>
            <MapIcon className="size-5 text-primary" />
            <span className="text-xs">Hagekart</span>
          </Button>
          <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-2xl bg-card py-3" nativeButton={false} render={<Link href="/planter/" />}>
            <Camera className="size-5 text-primary" />
            <span className="text-xs">Ta bilde</span>
          </Button>
        </div>

        <div className="mt-3">
          <AskClaudeButton className="h-12 w-full rounded-2xl text-base" />
        </div>

        {!settings.pushSubscription && (
          <Link href="/innstillinger/" className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Bell className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Slå på varsler</span>
              <span className="block text-xs text-muted-foreground">Få beskjed når det er tid for beskjæring, frø og kompost.</span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground/60" />
          </Link>
        )}

        {recentPhotos.length > 0 && (
          <Section title="Siste bilder">
            <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
              {recentPhotos.map((p) => {
                const plant = plantById.get(p.plantId);
                return (
                  <Link key={p.id} href={`/plante/?id=${p.plantId}`} className="w-28 shrink-0">
                    <div className="aspect-square overflow-hidden rounded-xl bg-muted">
                      <BlobImage blob={p.thumb} alt={plant?.name ?? "Bilde"} className="size-full object-cover" />
                    </div>
                    <p className="mt-1 truncate text-xs font-medium">{plant?.name ?? "Ukjent plante"}</p>
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
            <Stat label="På kartet" value={onMap} href="/kart/" />
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
