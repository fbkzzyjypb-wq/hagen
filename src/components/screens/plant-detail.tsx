"use client";

import { EMPTY } from "@/lib/hooks";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Pencil, MapPin, Plus, Trash2, Images, CalendarDays, FileText, Sprout } from "lucide-react";
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
import { useSettings } from "@/lib/settings";
import { quantityInBed } from "@/lib/beds";
import { nextDueYear, rulesForPlant } from "@/lib/tasks";
import { categoryInfo, MONTHS_NB_SHORT, plantTitle, type CareRule, type DroughtTolerance, type Photo, type Plant, type PropagationMethod, type ToxicityLevel } from "@/lib/types";
import { currentYear, formatDate } from "@/lib/dates";
import { isPlaced, polylineLength } from "@/lib/geometry";
import { factsFor } from "@/lib/plant-facts";
import { capitalize } from "@/lib/plant-lookup";
import { cn } from "cn";

export function PlantDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const plant = useLiveQuery(() => db.plants.get(id), [id]);
  const photos = useLiveQuery(() => db.photos.where("plantId").equals(id).reverse().sortBy("takenAt"), [id]) ?? EMPTY;
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? EMPTY;
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const settings = useSettings();
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
    router.replace("/planter/");
  }

  async function deletePhoto(photo: Photo) {
    await db.photos.delete(photo.id);
    setViewPhoto(null);
  }

  return (
    <>
      <PageHeader
        title={plantTitle(plant)}
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
          {plant.quantity && plant.quantity > 1 && (!plant.beds || plant.beds.length !== 1) && (
            <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{plant.quantity} stk</span>
          )}
          {(plant.beds ?? []).map((b) => {
            const bed = areas.find((a) => a.id === b.areaId);
            if (!bed) return null;
            const qty = quantityInBed(plant, bed.id);
            return (
              <Link key={bed.id} href={`/planter/?bed=${bed.id}`} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-medium text-accent-foreground">
                <Sprout className="size-3" /> {bed.name}
                {qty > 1 ? ` · ${qty} stk` : ""}
              </Link>
            );
          })}
          {settings.showMap && (
            <Link
              href={isPlaced(plant) ? `/kart/?plante=${plant.id}` : `/kart/?plasser=${plant.id}`}
              className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium", isPlaced(plant) ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}
            >
              <MapPin className="size-3" /> {isPlaced(plant) ? "Vis på kartet" : "Plasser på kartet"}
            </Link>
          )}
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
                        {r.enabled && r.everyYears && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            Hvert {r.everyYears}. år · neste {nextDueYear(r, plant, currentYear())}
                          </span>
                        )}
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
              <Row label="Antall" value={String(plant.quantity ?? 1)} />
              {plant.position && <Row label="På kartet" value={`${plant.position.x.toFixed(1)} m, ${plant.position.y.toFixed(1)} m`} />}
              {plant.line && plant.line.length >= 2 && <Row label="På kartet" value={`Rekke på ${polylineLength(plant.line).toFixed(1)} m`} />}
              <Row label="Lagt til" value={formatDate(plant.createdAt)} />
              {plant.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Notater</p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{plant.notes}</p>
                </div>
              )}
            </Card>
            <FactsCard plant={plant} />
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
                <DialogDescription>{plantTitle(plant)}</DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-lg bg-muted">
                <BlobImage blob={viewPhoto.blob} alt={plantTitle(plant)} className="max-h-[65dvh] w-full object-contain" />
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
            <DialogTitle>Slette {plantTitle(plant)}?</DialogTitle>
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

const DROUGHT_LABELS: Record<DroughtTolerance, string> = { lav: "Tåler tørke dårlig", middel: "Tåler noe tørke", god: "Tåler tørke godt" };
const METHOD_LABELS: Record<PropagationMethod, string> = { deling: "Deling", stiklinger: "Stiklinger", fro: "Frø", avleggere: "Avleggere", poding: "Poding", ingen: "Bør stå i fred" };
const TOXICITY_LABELS: Record<ToxicityLevel, string> = { ufarlig: "Ufarlig", lite: "Lite giftig", giftig: "Giftig", meget: "Meget giftig", ukjent: "Ukjent" };
const SOURCE_LABELS = {
  liste: "Fra appens staudeliste. Verdiene er veiledende.",
  ki: "Fra KI-leverandøren. Kan inneholde feil.",
  begge: "Fra appens staudeliste, utfylt av KI-leverandøren. Kan inneholde feil.",
};

/** «40–60 cm», og meter for trær og store busker: «3–8 m». */
function sizeRange([from, to]: [number, number]): string {
  const meters = to >= 200;
  const n = (v: number) => (meters ? (v / 100).toLocaleString("nb-NO", { maximumFractionDigits: 1 }) : String(v));
  return `${from === to ? n(from) : `${n(from)}–${n(to)}`} ${meters ? "m" : "cm"}`;
}

/** Plantefakta fra staudelisten og KI-leverandøren. Vises ikke når planten ikke er slått opp. */
function FactsCard({ plant }: { plant: Plant }) {
  const found = factsFor(plant);
  if (!found) return null;
  const { facts, source } = found;
  const { method, everyYears, months = [], note } = facts.propagation;
  const toxic = facts.toxicity?.level === "giftig" || facts.toxicity?.level === "meget";
  // Bare stauder «bør stå i fred». For andre planter betyr ingen at de vanligvis kjøpes ferdige.
  const methodLabel = method === "ingen" && plant.category !== "staude" ? "Formeres sjelden i hagen" : METHOD_LABELS[method];
  const propagation = [method === "deling" && everyYears ? `Deling hvert ${everyYears}. år` : methodLabel, months.map((m) => MONTHS_NB_SHORT[m - 1]).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card className="mt-3 gap-3 px-4">
      <p className="text-sm font-semibold">Plantefakta</p>
      {facts.description && <p className="text-sm">{facts.description}</p>}
      {facts.type && <Row label="Type" value={facts.type} />}
      {facts.family && <Row label="Familie" value={facts.family} />}
      {facts.origin && <Row label="Opprinnelse" value={facts.origin} />}
      {facts.hardiness && <Row label="Herdighet" value={facts.hardiness} />}
      <Row label="Lys" value={capitalize(facts.light.join(", "))} />
      <Row label="Størrelse" value={`${sizeRange(facts.height)} høy${facts.spread ? `, ${sizeRange(facts.spread)} bred` : ""}`} />
      <Row label="Tørke" value={DROUGHT_LABELS[facts.droughtTolerance]} />
      {facts.soil && <Block label="Jord" value={facts.soil} />}
      {facts.watering && <Block label="Vanning" value={facts.watering} />}
      {facts.fertilizing && <Block label="Gjødsling" value={facts.fertilizing} />}
      {facts.bloom && <Block label="Blomstring" value={facts.bloom} />}
      {facts.pruning && <Block label="Beskjæring" value={facts.pruning} />}
      {facts.planting && <Block label="Såing og planting" value={facts.planting} />}
      {facts.harvest && <Block label="Høsting" value={facts.harvest} />}
      {facts.winterCare && <Block label="Overvintring" value={facts.winterCare} />}
      {(method !== "ingen" || note) && <Block label="Formering" value={propagation} note={note} />}
      {facts.pests && <Block label="Sykdommer og skadedyr" value={facts.pests} />}
      {facts.wildlife && <Block label="Dyreliv" value={facts.wildlife} />}
      {facts.edible && <Block label="Spiselig" value={facts.edible} />}
      {facts.tips && <Block label="Verdt å vite" value={facts.tips} />}
      {facts.toxicity && (
        <Block label="Giftighet" value={TOXICITY_LABELS[facts.toxicity.level]} note={facts.toxicity.note} valueClassName={toxic ? "font-medium text-destructive" : undefined} />
      )}
      <p className="text-xs text-muted-foreground">
        {SOURCE_LABELS[source]}
        {facts.toxicity && facts.toxicity.level !== "ufarlig" && (
          <>
            {" "}Har noen fått i seg planten, ring Giftinformasjonen på{" "}
            <a href="tel:22591300" className="font-medium text-primary underline-offset-2 hover:underline">
              22 59 13 00
            </a>
            .
          </>
        )}
      </p>
    </Card>
  );
}

function Block({ label, value, note, valueClassName }: { label: string; value: string; note?: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm", valueClassName)}>{value}</p>
      {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
    </div>
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

