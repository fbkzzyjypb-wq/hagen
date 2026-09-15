"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, MapPin, Plus, Trash2, Images, CalendarDays, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState } from "@/components/page";
import { PlantForm } from "@/components/plant-form";
import { RuleForm } from "@/components/rule-form";
import { PhotoCapture } from "@/components/photo-capture";
import { BlobImage } from "@/components/blob-image";
import { AskClaudeButton } from "@/components/ask-claude";
import { db } from "@/lib/db";
import { rulesForPlant } from "@/lib/tasks";
import { categoryInfo, MONTHS_NB_SHORT, type CareRule, type Photo } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { scheduleSyncSoon } from "@/lib/sync";
import { cn } from "cn";

export function PlantDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const plant = useLiveQuery(() => db.plants.get(id), [id]);
  const photos = useLiveQuery(() => db.photos.where("plantId").equals(id).reverse().sortBy("takenAt"), [id]) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const [editOpen, setEditOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editRule, setEditRule] = useState<CareRule | undefined>();
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const plantRules = useMemo(() => (plant ? rulesForPlant(plant, rules) : []), [plant, rules]);

  if (plant === undefined) return <div className="p-8 text-center text-sm text-muted-foreground">Laster ...</div>;
  if (plant === null) {
    return (
      <Page className="pt-16">
        <EmptyState title="Fant ikke planten" action={<Button nativeButton={false} render={<Link href="/planter/" />}>Til plantelisten</Button>} />
      </Page>
    );
  }

  const info = categoryInfo(plant.category);

  async function deletePlant() {
    await db.transaction("rw", [db.plants, db.photos, db.rules, db.completions], async () => {
      await db.photos.where("plantId").equals(plant!.id).delete();
      const ruleIds = await db.rules.where("plantId").equals(plant!.id).primaryKeys();
      await db.rules.where("plantId").equals(plant!.id).delete();
      for (const rid of ruleIds) await db.completions.where("ruleId").equals(rid).delete();
      await db.plants.delete(plant!.id);
    });
    scheduleSyncSoon();
    router.replace("/planter/");
  }

  async function deletePhoto(photo: Photo) {
    await db.photos.delete(photo.id);
    setViewPhoto(null);
  }

  return (
    <>
      <PageHeader
        title={plant.name}
        subtitle={plant.latinName || info.label}
        leading={
          <Button variant="ghost" size="icon-lg" className="-ml-2 rounded-full" nativeButton={false} render={<Link href="/planter/" aria-label="Tilbake" />}>
            <ArrowLeft className="size-5" />
          </Button>
        }
        action={
          <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Rediger" onClick={() => setEditOpen(true)}>
            <Pencil className="size-5" />
          </Button>
        }
      />
      <Page>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full px-2.5 py-1 font-medium" style={{ backgroundColor: `${info.color}1f`, color: info.color }}>
            {info.emoji} {info.label}
          </span>
          {plant.variety && <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{`'${plant.variety}'`}</span>}
          {plant.plantedYear && <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Plantet {plant.plantedYear}</span>}
          <Link
            href={plant.position ? `/kart/?plante=${plant.id}` : `/kart/?plasser=${plant.id}`}
            className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium", plant.position ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}
          >
            <MapPin className="size-3" /> {plant.position ? "Vis på kartet" : "Plasser på kartet"}
          </Link>
        </div>

        <div className="mt-4 flex gap-2">
          <PhotoCapture plantId={plant.id} />
          <AskClaudeButton focusPlant={plant} variant="outline" className="h-11 flex-1 rounded-xl bg-card" />
        </div>

        <Tabs defaultValue="bilder" className="mt-5">
          <TabsList className="w-full">
            <TabsTrigger value="bilder" className="flex-1">
              <Images className="size-4" /> Bilder
            </TabsTrigger>
            <TabsTrigger value="stell" className="flex-1">
              <CalendarDays className="size-4" /> Stell
            </TabsTrigger>
            <TabsTrigger value="info" className="flex-1">
              <FileText className="size-4" /> Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bilder" className="mt-3">
            {photos.length === 0 ? (
              <EmptyState
                icon={<Images className="size-6" />}
                title="Ingen bilder enda"
                description="Ta et bilde nå og et hvert år, så ser du hvordan planten utvikler seg."
              />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((p) => (
                  <button key={p.id} type="button" onClick={() => setViewPhoto(p)} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                    <BlobImage blob={p.thumb} alt="" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-left text-[10px] font-medium text-white">
                      {formatDate(p.takenAt, { month: "short", year: "numeric" })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stell" className="mt-3">
            <Card className="py-0">
              <ul className="divide-y divide-border">
                {plantRules.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          if (r.scope === "plant") {
                            setEditRule(r);
                            setRuleOpen(true);
                          }
                        }}
                      >
                        <p className={cn("text-[15px] font-medium", !r.enabled && "text-muted-foreground line-through")}>{r.title}</p>
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.months.map((m) => (
                          <span key={m} className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground capitalize">
                            {MONTHS_NB_SHORT[m - 1]}
                          </span>
                        ))}
                        {r.scope === "category" && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Alle {info.label.toLowerCase()}</span>}
                      </div>
                      {r.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.description}</p>}
                    </div>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={async (v) => {
                        if (r.scope === "plant") {
                          await db.rules.update(r.id, { enabled: v });
                        } else {
                          // Skru av en kategoriregel for bare denne planten ved å lage en deaktivert planteregel med samme nøkkel.
                          await db.rules.add({ ...r, id: crypto.randomUUID(), scope: "plant", plantId: plant.id, category: undefined, enabled: v, source: "egen", createdAt: Date.now() });
                        }
                        scheduleSyncSoon();
                      }}
                      aria-label={`Slå ${r.enabled ? "av" : "på"} ${r.title}`}
                      className="mt-1"
                    />
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 border-t border-border p-3">
                <Button
                  variant="outline"
                  className="h-10 flex-1 rounded-xl"
                  onClick={() => {
                    setEditRule(undefined);
                    setRuleOpen(true);
                  }}
                >
                  <Plus data-icon="inline-start" /> Egen oppgave
                </Button>
                <AskClaudeButton
                  focusPlant={plant}
                  variant="outline"
                  size="default"
                  className="h-10 flex-1 rounded-xl"
                  label="Foreslå stell"
                  initialQuestion={`Lag en stell-kalender for ${plant.name.toLowerCase()} måned for måned, med beskjæring, gjødsling, formering og vinterbeskyttelse.`}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="mt-3">
            <Card className="gap-3 px-4">
              <Row label="Navn" value={plant.name} />
              {plant.latinName && <Row label="Latinsk navn" value={plant.latinName} italic />}
              {plant.variety && <Row label="Sort" value={plant.variety} />}
              <Row label="Kategori" value={info.label} />
              {plant.plantedYear && <Row label="Plantet" value={String(plant.plantedYear)} />}
              {plant.position && <Row label="Plassering" value={`${plant.position.x.toFixed(1)} m, ${plant.position.y.toFixed(1)} m`} />}
              <Row label="Lagt til" value={formatDate(plant.createdAt)} />
              {plant.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Notater</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{plant.notes}</p>
                </div>
              )}
            </Card>
            <Button variant="destructive" className="mt-4 h-11 w-full rounded-xl" onClick={() => setDeleteOpen(true)}>
              <Trash2 data-icon="inline-start" /> Slett planten
            </Button>
          </TabsContent>
        </Tabs>
      </Page>

      <PlantForm open={editOpen} onOpenChange={setEditOpen} plant={plant} />
      <RuleForm open={ruleOpen} onOpenChange={setRuleOpen} plant={plant} rule={editRule} />

      <Dialog open={!!viewPhoto} onOpenChange={(o) => !o && setViewPhoto(null)}>
        <DialogContent className="max-w-[calc(100%-1.5rem)] gap-3 p-2 sm:max-w-lg">
          {viewPhoto && (
            <>
              <DialogHeader className="px-2 pt-2">
                <DialogTitle className="text-base">{formatDate(viewPhoto.takenAt)}</DialogTitle>
                <DialogDescription>{plant.name}</DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg bg-muted">
                <BlobImage blob={viewPhoto.blob} alt={plant.name} className="max-h-[65dvh] w-full object-contain" />
              </div>
              <DialogFooter className="px-2 pb-2">
                <Button variant="destructive" size="sm" onClick={() => deletePhoto(viewPhoto)}>
                  <Trash2 data-icon="inline-start" /> Slett bildet
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slette {plant.name}?</DialogTitle>
            <DialogDescription>Planten, {photos.length} bilder og egne oppgaver slettes. Dette kan ikke angres.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={deletePlant}>
              Slett
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-right text-sm", italic && "italic")}>{value}</p>
    </div>
  );
}

