"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { categoryInfo, plantTitle, type Plant } from "@/lib/types";
import { isPlaced } from "@/lib/geometry";
import { BlobImage } from "@/components/blob-image";
import { CategoryPixelIcon, hasPixelIcon } from "@/components/pixel-icons";

export function PlantThumb({ plant, className = "size-14" }: { plant: Plant; className?: string }) {
  const photo = useLiveQuery(() => db.photos.where("plantId").equals(plant.id).reverse().sortBy("takenAt").then((p) => p[0]), [plant.id]);
  const info = categoryInfo(plant.category);
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-xl bg-muted`} style={{ backgroundColor: photo ? undefined : `${info.color}22` }}>
      {photo ? (
        <BlobImage blob={photo.thumb} alt={plantTitle(plant)} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-2xl">
          {hasPixelIcon(plant.category) ? <CategoryPixelIcon category={plant.category} className="size-[70%]" /> : info.emoji}
        </div>
      )}
    </div>
  );
}

/** `count` overstyrer antallet som vises, f.eks. antall i ett bestemt bed. */
export function PlantListItem({ plant, count, showMap = false }: { plant: Plant; count?: number; showMap?: boolean }) {
  const info = categoryInfo(plant.category);
  const shown = count ?? plant.quantity ?? 1;
  return (
    <li>
      <Link href={`/plante/?id=${plant.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted/60">
        <PlantThumb plant={plant} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium">
            {plantTitle(plant)}
            {shown > 1 ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">× {shown}</span> : null}
          </p>
          <p className="truncate text-sm text-muted-foreground">{plant.latinName ? <span className="italic">{plant.latinName}</span> : info.label}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: `${info.color}1f`, color: info.color }}>
              {info.label}
            </span>
            {showMap && isPlaced(plant) && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="size-3" /> På kartet
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="size-5 text-muted-foreground/60" />
      </Link>
    </li>
  );
}
