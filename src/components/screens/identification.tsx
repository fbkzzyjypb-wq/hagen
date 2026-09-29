"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Camera, Check, Loader2, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Page, EmptyState } from "@/components/page";
import { BlobImage } from "@/components/blob-image";
import { PlantForm, type PlantFormInitial } from "@/components/plant-form";
import { FactsCard } from "@/components/plant-facts-card";
import { assistantHref } from "@/components/ask-claude";
import { askAbout, categoryPill, FactChips, findExisting, ImageStrip } from "@/components/candidate";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { resolveTransport } from "@/lib/llm-client";
import { formatDate } from "@/lib/dates";
import { inferCategory } from "@/lib/plant-lookup";
import { ensureIdentificationFacts } from "@/lib/plant-facts";
import { plantTitle, type Identification } from "@/lib/types";

/** Oppføringen med bildet sitt fra bildetabellen. Null når den ikke finnes (lenger). */
type Item = Identification & { photo?: Blob };

/**
 * En lagret identifisering som egen side, slik en plante i hagen har sin: da tar tilbake-sveipet deg til Identifiser
 * og ikke ut av fanen. Lagt opp som en planteside: bildet, navnet i stor skrift med «Legg til i hagen» øverst til
 * høyre, referansebilder, kortfakta og hvor sikkert treffet var, så assistenten og plantefaktaene i eget kort.
 */
export function IdentificationScreen({ id }: { id: string }) {
  const router = useRouter();
  const settings = useSettings();
  const transport = useMemo(() => resolveTransport(settings), [settings]);
  const plants = useLiveQuery(() => db.plants.orderBy("name").toArray(), []) ?? EMPTY;
  const item = useLiveQuery(async (): Promise<Item | null> => {
    const record = await db.identifications.get(id);
    if (!record) return null;
    const photo = await db.identificationPhotos.get(id);
    return { ...record, photo: photo?.blob };
  }, [id]);
  const [formInitial, setFormInitial] = useState<PlantFormInitial | null>(null);
  /** Hvorfor siste oppslag av plantefakta feilet. Null mens det pågår eller har lyktes. */
  const [factsError, setFactsError] = useState<string | null>(null);

  const hasTransport = !!transport;
  const assistantLabel = transport?.label ?? "Claude";
  const needFacts = !!item && !item.facts && hasTransport;
  const factsBusy = needFacts && factsError === null;

  // Mangler faktaene (oppslaget feilet, eller leverandøren kom til senere), prøves det igjen når siden åpnes.
  // Pågår oppslaget alt fra lagringen, deles det kallet.
  useEffect(() => {
    if (!needFacts || factsError !== null) return;
    let cancelled = false;
    ensureIdentificationFacts(id)
      .then(() => db.identifications.get(id))
      .then((fresh) => {
        if (!cancelled && !fresh?.facts) setFactsError("Fikk ikke hentet plantefakta nå.");
      })
      .catch((err: unknown) => {
        if (!cancelled) setFactsError(err instanceof Error && err.message ? err.message : "Fikk ikke hentet plantefakta nå.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, needFacts, factsError]);

  if (item === undefined) return <div className="p-8 text-center text-sm text-muted-foreground">Laster ...</div>;
  if (item === null) {
    return (
      <Page className="pt-16">
        <EmptyState title="Fant ikke identifiseringen" action={<Button nativeButton={false} render={<Link href="/identifiser/" />}>Til Identifiser</Button>} />
      </Page>
    );
  }

  const chosen = item.candidates[0];
  const added = item.plantId ? plants.find((p) => p.id === item.plantId) : undefined;
  /** En plante med samme navn i hagen, når oppføringen ikke selv er lagt til der. */
  const existing = chosen && !added ? findExisting(plants, chosen) : undefined;
  const images = chosen?.images ?? [];

  function startAdd() {
    if (!chosen) return;
    setFormInitial({ name: chosen.name, latinName: chosen.latinName, variety: chosen.variety, category: chosen.category ?? inferCategory(chosen.latinName), photo: item?.photo });
  }

  async function remove() {
    await db.transaction("rw", [db.identifications, db.identificationPhotos], async () => {
      await db.identifications.delete(id);
      await db.identificationPhotos.delete(id);
    });
    router.replace("/identifiser/");
  }

  return (
    <>
      <PageHeader
        title="Identifisering"
        subtitle={`${formatDate(item.createdAt)} · ${item.source === "plantnet" ? "Pl@ntNet" : "KI"}`}
        leading={
          <Button variant="ghost" size="icon-lg" className="-ml-2 rounded-full" nativeButton={false} render={<Link href="/identifiser/" aria-label="Tilbake til Identifiser" />}>
            <ArrowLeft className="size-5" />
          </Button>
        }
      />
      <Page className="flex flex-col gap-3">
        <div className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
          <BlobImage blob={item.photo} alt="Bildet som ble identifisert" className="size-full object-cover" />
        </div>
        {item.photoCount > 1 && <p className="-mt-1 px-1 text-xs text-muted-foreground">Første av {item.photoCount} bilder som ble sendt.</p>}
        {chosen && (
          <>
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lagret som</p>
                {added ? (
                  <Button variant="outline" size="lg" className="rounded-full bg-card" nativeButton={false} render={<Link href={`/plante/?id=${added.id}`} />}>
                    <Check data-icon="inline-start" /> I hagen som {plantTitle(added)}
                  </Button>
                ) : (
                  <Button size="lg" className="rounded-full" onClick={startAdd}>
                    <Plus data-icon="inline-start" /> Legg til i hagen
                  </Button>
                )}
              </div>
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight">{chosen.name}</h2>
                {(chosen.latinName || chosen.variety) && (
                  <p className="text-sm text-muted-foreground">
                    <span className="italic">{chosen.latinName}</span>
                    {chosen.variety ? ` '${chosen.variety}'` : ""}
                  </p>
                )}
              </div>
              {images.length > 0 && <ImageStrip images={images} name={chosen.name} />}
              <FactChips facts={chosen.facts} zone={settings.climateZone} leading={categoryPill(chosen)} />
              {chosen.note && <p className="text-sm text-muted-foreground">{chosen.note}</p>}
              {existing && (
                <Link href={`/plante/?id=${existing.id}`} className="text-sm font-medium text-primary">
                  Du har allerede {existing.name} i hagen. Åpne planten.
                </Link>
              )}
            </div>
            <Button variant="outline" className="h-11 rounded-xl bg-card" nativeButton={false} render={<Link href={assistantHref(undefined, askAbout(chosen))} />}>
              <Sparkles data-icon="inline-start" /> Spør {assistantLabel} om {chosen.name.toLowerCase()}
            </Button>
            <FactsCard subject={{ name: chosen.name, latinName: chosen.latinName, category: chosen.category, facts: item.facts }} />
            {!item.facts && factsBusy && (
              <p className="inline-flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Henter plantefakta fra {assistantLabel} ...
              </p>
            )}
            {!item.facts && factsError !== null && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2">
                <p className="text-sm text-destructive">Plantefakta: {factsError}</p>
                <Button variant="outline" size="sm" className="shrink-0 rounded-lg bg-card" onClick={() => setFactsError(null)}>
                  <RefreshCw data-icon="inline-start" /> Prøv igjen
                </Button>
              </div>
            )}
            {!hasTransport && !item.facts && (
              <p className="px-1 text-[11px] text-muted-foreground">Med en KI-leverandør (Innstillinger) får oppføringen de samme plantefaktaene som plantene i hagen.</p>
            )}
          </>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 rounded-xl bg-card" nativeButton={false} render={<Link href="/identifiser/" />}>
            <Camera data-icon="inline-start" /> Ny identifisering
          </Button>
          <Button variant="outline" className="h-11 rounded-xl bg-card text-destructive" onClick={remove}>
            <Trash2 data-icon="inline-start" /> Slett
          </Button>
        </div>
      </Page>

      <PlantForm
        open={formInitial !== null}
        onOpenChange={(o) => {
          if (!o) setFormInitial(null);
        }}
        initial={formInitial ?? undefined}
        onSaved={(p) => {
          // Oppføringen får en lenke til planten, så den viser «I hagen som …» neste gang.
          db.identifications.update(id, { plantId: p.id }).catch(() => undefined);
          router.push(`/plante/?id=${p.id}`);
        }}
      />
    </>
  );
}
