"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Map as MapIcon } from "lucide-react";
import { db } from "@/lib/db";
import { EMPTY } from "@/lib/hooks";
import { areaInfo, categoryInfo, type Plant } from "@/lib/types";
import { isPlaced, polygonArea } from "@/lib/geometry";
import { PixelGlyph, hasPixelIcon } from "@/components/pixel-icons";

type Props = { plants: Plant[]; width: number; height: number };

/** Statisk miniatyr av hagekartet med alle plasserte planter. Trykk for å åpne kartet. */
export function GardenPreview({ plants, width: W, height: H }: Props) {
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const background = useLiveQuery(() => db.mapBackground.get("bg"), []);
  const bgBlob = background?.blob;
  const bgUrl = useMemo(() => (bgBlob && typeof window !== "undefined" ? URL.createObjectURL(bgBlob) : undefined), [bgBlob]);
  useEffect(() => {
    if (!bgUrl) return;
    return () => URL.revokeObjectURL(bgUrl);
  }, [bgUrl]);

  const sortedAreas = useMemo(() => [...areas].sort((a, b) => polygonArea(b.points) - polygonArea(a.points)), [areas]);
  const placed = plants.filter(isPlaced);
  const unit = Math.max(W, H) / 40; // "en piksel" i meter, så markørene skalerer med hagen
  const r = unit * 1.4;
  const lineWidth = Math.max(unit * 0.9, 0.4);
  const gridStep = 5;
  const gridLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let x = gridStep; x < W; x += gridStep) gridLines.push({ x1: x, y1: 0, x2: x, y2: H });
  for (let y = gridStep; y < H; y += gridStep) gridLines.push({ x1: 0, y1: y, x2: W, y2: y });

  return (
    <Link
      href="/kart/"
      className="group relative block overflow-hidden rounded-2xl ring-1 ring-foreground/10"
      style={{ backgroundColor: background ? "#CFE0B4" : "#e6ecdc", aspectRatio: `${W} / ${H}`, maxHeight: 280 }}
      aria-label="Åpne hagekartet"
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="size-full" role="img" aria-label="Hagekart">
        <rect x={0} y={0} width={W} height={H} fill={background ? "#CFE0B4" : "#f4f7ee"} />
        {background && bgUrl && (
          <image href={bgUrl} x={background.x} y={background.y} width={background.width} height={background.height} opacity={background.opacity} preserveAspectRatio="none" />
        )}
        {gridLines.map((l, i) => (
          <line key={i} {...l} stroke={background ? "#ffffff" : "#d5dec6"} strokeOpacity={background ? 0.16 : 1} strokeWidth={unit * 0.08} />
        ))}
        {sortedAreas.map((a) => {
          const info = areaInfo(a.kind);
          return (
            <polygon
              key={a.id}
              points={a.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={info.fill}
              fillOpacity={background ? 0.6 : 0.85}
              stroke={info.stroke}
              strokeWidth={unit * 0.12}
              strokeLinejoin="round"
            />
          );
        })}
        {placed
          .filter((p) => p.line && p.line.length >= 2)
          .map((p) => (
            <polyline
              key={p.id}
              points={p.line!.map((q) => `${q.x},${q.y}`).join(" ")}
              fill="none"
              stroke={categoryInfo(p.category).color}
              strokeWidth={lineWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {placed
          .filter((p) => p.position)
          .map((p) => {
            const info = categoryInfo(p.category);
            const pos = p.position!;
            return (
              <g key={p.id}>
                {hasPixelIcon(p.category) ? (
                  <PixelGlyph category={p.category} x={pos.x} y={pos.y} size={r * 1.2} />
                ) : (
                  <>
                    <circle cx={pos.x} cy={pos.y} r={r} fill="#fff" stroke={info.color} strokeWidth={unit * 0.18} />
                    <text x={pos.x} y={pos.y} fontSize={r * 1.3} textAnchor="middle" dominantBaseline="central">
                      {info.emoji}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        <rect x={0} y={0} width={W} height={H} fill="none" stroke={background ? "#ffffff" : "#a9b897"} strokeOpacity={background ? 0.45 : 1} strokeWidth={unit * 0.15} />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/45 to-transparent px-3 pt-6 pb-2.5 text-white">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <MapIcon className="size-3.5" />
          {placed.length === 0
            ? "Plasser plantene dine på kartet"
            : `${placed.length} av ${plants.length} ${plants.length === 1 ? "plante" : "planter"} plassert`}
        </span>
        <span className="flex items-center text-xs font-medium">
          Åpne kart <ChevronRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
