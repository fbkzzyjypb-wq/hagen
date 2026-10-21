"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronDown, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Page, EmptyState } from "@/components/page";
import { BlobImage } from "@/components/blob-image";
import { Frame } from "@/components/frame";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { formatRelative } from "@/lib/dates";
import { plantTitle, type Identification } from "@/lib/types";

/** En oppføring i historikken med bildet sitt hentet fra bildetabellen. */
type HistoryItem = Identification & { photo?: Blob };

/**
 * Tidligere identifiseringer, nyeste først, i panelet som dras opp over kameraet. Hver åpnes som egen side.
 * `scrollRef` er listen som ruller, så skallet vet når den står øverst og et drag nedover skal lukke panelet.
 */
export function IdentifyHistoryPanel({ scrollRef, onClose }: { scrollRef: RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const items =
    useLiveQuery(async (): Promise<HistoryItem[]> => {
      const list = await db.identifications.orderBy("createdAt").reverse().toArray();
      const photos = await db.identificationPhotos.bulkGet(list.map((i) => i.id));
      return list.map((item, i) => ({ ...item, photo: photos[i]?.blob }));
    }, []) ?? EMPTY;

  return (
    <Frame scrollRef={scrollRef}>
      <header className="sticky top-0 z-10 rounded-t-[28px] border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" aria-hidden />
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-2 pb-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Historikk</h1>
            <p className="text-sm text-muted-foreground">{items.length === 1 ? "1 identifisering" : `${items.length} identifiseringer`}</p>
          </div>
          <Button variant="ghost" size="icon-lg" className="rounded-full" aria-label="Lukk historikken" onClick={onClose}>
            <ChevronDown className="size-5" />
          </Button>
        </div>
      </header>
      <div>
        <Page className="pt-4 pb-4">
          {items.length === 0 ? (
            <EmptyState
              icon={<History className="size-6" />}
              title="Ingen identifiseringer ennå"
              description="Ta bilde av en plante, så havner svaret her. Trykk Lagre på forslaget du tror stemmer for å ta vare på det."
            />
          ) : (
            <Card className="py-0">
              <ul className="divide-y divide-border">
                {items.map((h) => {
                  const top = h.candidates[0];
                  const added = h.plantId ? plants.find((p) => p.id === h.plantId) : undefined;
                  const unsaved = h.saved === false;
                  return (
                    <li key={h.id}>
                      <Link href={`/identifisering/?id=${h.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted/60">
                        <BlobImage blob={h.photo} alt="" className="size-12 shrink-0 rounded-lg bg-muted object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{top?.name ?? "Ingen treff"}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {unsaved ? (
                              <span className="font-medium text-amber-800">Ikke lagret · {h.candidates.length === 1 ? "1 forslag" : `${h.candidates.length} forslag`} · </span>
                            ) : (
                              top?.latinName && <span className="italic">{top.latinName} · </span>
                            )}
                            {formatRelative(h.createdAt)}
                          </span>
                          {added && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <Check className="size-3" /> I hagen som {plantTitle(added)}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </Page>
      </div>
    </Frame>
  );
}
