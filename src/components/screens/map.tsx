"use client";

import { EMPTY } from "@/lib/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useGesture, useDrag } from "@use-gesture/react";
import { Maximize2, MapPin, PenLine, Undo2, X, Check, Trash2, ChevronRight, Plus, Settings, Image as ImageIcon, Move, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/fields";
import { PlantForm } from "@/components/plant-form";
import { PlantThumb } from "@/components/plant-list-item";
import { db } from "@/lib/db";
import { newId } from "@/lib/id";
import { useSettings } from "@/lib/settings";
import { AREA_KINDS, areaInfo, categoryInfo, plantTitle, type Area, type AreaKind, type MapBackground, type Plant, type Point } from "@/lib/types";
import { compressImageWithSize } from "@/lib/images";
import { PixelGlyph, hasPixelIcon } from "@/components/pixel-icons";
import { centroid, clamp, distanceToPolyline, isPlaced, pointInPolygon, polygonArea, polylineLength, polylineMidpoint, snap } from "@/lib/geometry";

type View = { x: number; y: number; s: number };
type Mode = { kind: "view" } | { kind: "place"; plantId: string; asLine?: boolean } | { kind: "draw" } | { kind: "bg" };
type Selection = { type: "plant"; id: string } | { type: "area"; id: string } | null;

const MIN_S = 6;
const MAX_S = 200;

export function MapScreen({ placePlantId, focusPlantId }: { placePlantId?: string; focusPlantId?: string }) {
  const settings = useSettings();
  const plants = useLiveQuery(() => db.plants.toArray(), []) ?? EMPTY;
  const areas = useLiveQuery(() => db.areas.toArray(), []) ?? EMPTY;
  const background = useLiveQuery(() => db.mapBackground.get("bg"), []);
  const [bgDraft, setBgDraft] = useState<MapBackground | null>(null);
  const bg = bgDraft ?? background ?? undefined;
  const bgRef = useRef<MapBackground | undefined>(bg);
  useEffect(() => {
    bgRef.current = bg;
  }, [bg]);
  const bgBlob = background?.blob;
  const bgUrl = useMemo(() => (bgBlob && typeof window !== "undefined" ? URL.createObjectURL(bgBlob) : undefined), [bgBlob]);
  useEffect(() => {
    if (!bgUrl) return;
    return () => URL.revokeObjectURL(bgUrl);
  }, [bgUrl]);
  const [bgSheetOpen, setBgSheetOpen] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bgSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const W = settings.mapWidth;
  const H = settings.mapHeight;

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // `null` betyr "ikke rørt enda": da regnes utsnittet ut fra størrelsen på skjermen.
  const [userView, setView] = useState<View | null>(null);

  const [mode, setMode] = useState<Mode>(placePlantId ? { kind: "place", plantId: placePlantId } : { kind: "view" });
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [selection, setSelection] = useState<Selection>(focusPlantId ? { type: "plant", id: focusPlantId } : null);
  const [draft, setDraft] = useState<Point[]>([]);
  const [dragging, setDragging] = useState<{ id: string; pos: Point } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [newPlantOpen, setNewPlantOpen] = useState(false);
  const [areaDialog, setAreaDialog] = useState<{ points: Point[] } | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaKind, setAreaKind] = useState<AreaKind>("bed");
  const [renameArea, setRenameArea] = useState<Area | null>(null);

  const plantById = useMemo(() => new Map(plants.map((p) => [p.id, p])), [plants]);
  const sortedAreas = useMemo(() => [...areas].sort((a, b) => polygonArea(b.points) - polygonArea(a.points)), [areas]);

  // Følg størrelsen på beholderen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const view = useMemo<View>(() => {
    if (userView) return userView;
    if (!size.w || !size.h) return { x: 0, y: 0, s: 30 };
    const focus = focusPlantId ? plantById.get(focusPlantId) : undefined;
    const focusPoint = focus?.position ?? (focus?.line && focus.line.length >= 2 ? polylineMidpoint(focus.line) : undefined);
    if (focusPoint) {
      const s = focus?.line ? clamp(Math.min((size.w - 48) / Math.max(1, polylineLength(focus.line)), 50), MIN_S, 50) : 50;
      return { s, x: size.w / 2 - focusPoint.x * s, y: size.h / 2 - focusPoint.y * s - 40 };
    }
    const s = clamp(Math.min((size.w - 32) / W, (size.h - 220) / H), MIN_S, MAX_S);
    return { s, x: (size.w - W * s) / 2, y: (size.h - H * s) / 2 - 20 };
  }, [userView, size, W, H, focusPlantId, plantById]);

  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const fit = useCallback(() => setView(null), []);

  const toMeters = useCallback((clientX: number, clientY: number): Point => {
    const el = containerRef.current!;
    const r = el.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - r.left - v.x) / v.s, y: (clientY - r.top - v.y) / v.s };
  }, []);

  const handleTapAt = useCallback(
    async (clientX: number, clientY: number) => {
      if (mode.kind === "bg") return;
      const m = toMeters(clientX, clientY);
      if (mode.kind === "place") {
        const pos = { x: snap(clamp(m.x, 0, W)), y: snap(clamp(m.y, 0, H)) };
        const asLine = mode.asLine ?? plantById.get(mode.plantId)?.category === "hekk";
        if (asLine) {
          setDraft((d) => [...d, pos]);
          return;
        }
        await db.plants.update(mode.plantId, { position: pos, line: undefined, updatedAt: Date.now() });
        setMode({ kind: "view" });
        setSelection({ type: "plant", id: mode.plantId });
        return;
      }
      if (mode.kind === "draw") {
        setDraft((d) => [...d, { x: snap(clamp(m.x, 0, W)), y: snap(clamp(m.y, 0, H)) }]);
        return;
      }
      const tolerance = Math.max(0.5, 14 / viewRef.current.s);
      const lineHit = plants
        .filter((p) => p.line && p.line.length >= 2)
        .map((p) => ({ p, d: distanceToPolyline(m, p.line!) }))
        .sort((a, b) => a.d - b.d)[0];
      if (lineHit && lineHit.d <= tolerance) {
        setSelection({ type: "plant", id: lineHit.p.id });
        return;
      }
      const hit = [...sortedAreas].reverse().find((a) => pointInPolygon(m, a.points));
      setSelection(hit ? { type: "area", id: hit.id } : null);
    },
    [mode, toMeters, W, H, sortedAreas, plants, plantById]
  );

  /** Oppdaterer bakgrunnsbildet under en bevegelse, og lagrer når bevegelsen er ferdig. */
  const updateBackground = useCallback((next: MapBackground, persist: boolean) => {
    setBgDraft(next);
    if (bgSaveTimer.current) clearTimeout(bgSaveTimer.current);
    if (persist) db.mapBackground.put(next).catch(() => undefined);
    else bgSaveTimer.current = setTimeout(() => db.mapBackground.put(next).catch(() => undefined), 400);
  }, []);

  /** Skalerer bildet med faktor k rundt et punkt (i meter). */
  const scaleBackground = useCallback((cur: MapBackground, k: number, around: Point): MapBackground => {
    return { ...cur, width: cur.width * k, height: cur.height * k, x: around.x - (around.x - cur.x) * k, y: around.y - (around.y - cur.y) * k };
  }, []);

  useGesture(
    {
      onDrag: ({ pinching, cancel, first, last, tap, delta: [dx, dy], event }) => {
        if (pinching) return cancel();
        const target = event.target as Element;
        // Bare berøringer på selve kartet skal panorere/velge. Knapper og kort over kartet håndterer seg selv.
        if (first && (!target.closest?.("svg") || target.closest?.("[data-marker]"))) return cancel();
        if (tap) {
          if (!target.closest?.("svg")) return;
          const e = event as PointerEvent;
          handleTapAt(e.clientX, e.clientY);
          return;
        }
        if (modeRef.current.kind === "bg") {
          const cur = bgRef.current;
          if (!cur) return;
          const v = viewRef.current;
          updateBackground({ ...cur, x: cur.x + dx / v.s, y: cur.y + dy / v.s }, last);
          return;
        }
        setView(() => {
          const v = viewRef.current;
          return { ...v, x: v.x + dx, y: v.y + dy };
        });
      },
      onPinch: ({ origin: [ox, oy], first, last, offset: [s], memo }) => {
        const el = containerRef.current!;
        if (first) {
          const r = el.getBoundingClientRect();
          memo = { ...viewRef.current, px: ox - r.left, py: oy - r.top, bg: bgRef.current };
        }
        const k = s / memo.s;
        if (modeRef.current.kind === "bg") {
          const cur = memo.bg as MapBackground | undefined;
          if (cur) {
            const around = { x: (memo.px - memo.x) / memo.s, y: (memo.py - memo.y) / memo.s };
            updateBackground(scaleBackground(cur, k, around), last);
          }
          return memo;
        }
        setView({ s, x: memo.px - (memo.px - memo.x) * k, y: memo.py - (memo.py - memo.y) * k });
        return memo;
      },
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault();
        const el = containerRef.current!;
        const r = el.getBoundingClientRect();
        const px = event.clientX - r.left;
        const py = event.clientY - r.top;
        if (modeRef.current.kind === "bg") {
          const cur = bgRef.current;
          if (!cur) return;
          const v = viewRef.current;
          updateBackground(scaleBackground(cur, Math.exp(-dy * 0.002), { x: (px - v.x) / v.s, y: (py - v.y) / v.s }), false);
          return;
        }
        setView(() => {
          const v = viewRef.current;
          const s = clamp(v.s * Math.exp(-dy * 0.002), MIN_S, MAX_S);
          const k = s / v.s;
          return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
        });
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: { filterTaps: true, threshold: 4, pointer: { touch: true } },
      pinch: { from: () => [viewRef.current.s, 0], scaleBounds: { min: MIN_S, max: MAX_S }, rubberband: false },
    }
  );

  async function uploadBackground(file?: File) {
    if (!file) return;
    setBgBusy(true);
    try {
      const { blob, width, height } = await compressImageWithSize(file, 2048, 0.85);
      const aspect = width / height;
      let w = W;
      let h = W / aspect;
      if (h > H) {
        h = H;
        w = H * aspect;
      }
      const next: MapBackground = {
        id: "bg",
        blob,
        pixelWidth: width,
        pixelHeight: height,
        x: (W - w) / 2,
        y: (H - h) / 2,
        width: w,
        height: h,
        opacity: background?.opacity ?? 1,
      };
      await db.mapBackground.put(next);
      setBgDraft(null);
      setBgSheetOpen(false);
      setSelection(null);
      setMode({ kind: "bg" });
    } finally {
      setBgBusy(false);
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  }

  function setBackgroundOpacity(opacity: number) {
    const cur = bgRef.current;
    if (cur) updateBackground({ ...cur, opacity }, true);
  }

  async function removeBackground() {
    await db.mapBackground.delete("bg");
    setBgDraft(null);
    setBgSheetOpen(false);
    if (mode.kind === "bg") setMode({ kind: "view" });
  }

  async function finishDraw() {
    if (draft.length < 3) return;
    setAreaName("");
    setAreaKind("bed");
    setAreaDialog({ points: draft });
  }

  async function saveArea() {
    if (!areaDialog) return;
    const kindInfo = areaInfo(areaKind);
    await db.areas.add({ id: newId(), name: areaName.trim() || kindInfo.label, kind: areaKind, points: areaDialog.points, createdAt: Date.now() });
    setAreaDialog(null);
    setDraft([]);
    setMode({ kind: "view" });
  }

  async function removeFromMap(plantId: string) {
    await db.plants.update(plantId, { position: undefined, line: undefined, updatedAt: Date.now() });
    setSelection(null);
  }

  async function finishLine() {
    if (mode.kind !== "place" || draft.length < 2) return;
    await db.plants.update(mode.plantId, { line: draft, position: undefined, updatedAt: Date.now() });
    setDraft([]);
    setSelection({ type: "plant", id: mode.plantId });
    setMode({ kind: "view" });
  }

  function startPlacing(plantId: string, asLine?: boolean) {
    setPickOpen(false);
    setSelection(null);
    setDraft([]);
    setMode({ kind: "place", plantId, asLine });
  }

  async function deleteArea(id: string) {
    await db.areas.delete(id);
    setSelection(null);
  }

  const selectedPlant = selection?.type === "plant" ? plantById.get(selection.id) : undefined;
  const selectedArea = selection?.type === "area" ? areas.find((a) => a.id === selection.id) : undefined;
  const placingPlant = mode.kind === "place" ? plantById.get(mode.plantId) : undefined;
  const placingAsLine = mode.kind === "place" && (mode.asLine ?? placingPlant?.category === "hekk");
  const placedCount = plants.filter(isPlaced).length;
  const s = view.s;
  const gridStep = s >= 18 ? 1 : 5;
  const showLabels = s >= 22;

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let x = 0; x <= W; x += gridStep) lines.push({ x1: x, y1: 0, x2: x, y2: H, major: x % 5 === 0 });
    for (let y = 0; y <= H; y += gridStep) lines.push({ x1: 0, y1: y, x2: W, y2: y, major: y % 5 === 0 });
    return lines;
  }, [W, H, gridStep]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-x-0 top-0 overflow-hidden select-none"
      style={{ bottom: "calc(var(--tabbar-height) + var(--safe-bottom))", touchAction: "none", backgroundColor: bg ? "#CFE0B4" : "#e6ecdc" }}
    >
      <svg className="size-full" role="img" aria-label="Hagekart">
        <g transform={`translate(${view.x} ${view.y}) scale(${s})`}>
          <rect x={0} y={0} width={W} height={H} fill={bg ? "#CFE0B4" : "#f4f7ee"} rx={0.2} />
          {bg && bgUrl && (
            <image
              href={bgUrl}
              x={bg.x}
              y={bg.y}
              width={bg.width}
              height={bg.height}
              opacity={bg.opacity}
              preserveAspectRatio="none"
              style={{ pointerEvents: "none" }}
            />
          )}
          {gridLines
            .filter((l) => !bg || l.major)
            .map((l, i) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={bg ? "#ffffff" : l.major ? "#c9d4ba" : "#e1e8d4"}
              strokeOpacity={bg ? 0.16 : 1}
              strokeWidth={(l.major ? 1.2 : 0.8) / s}
            />
          ))}

          <g style={{ pointerEvents: mode.kind === "bg" ? "none" : undefined, opacity: mode.kind === "bg" ? 0.5 : 1 }}>

          {sortedAreas.map((a) => {
            const info = areaInfo(a.kind);
            const active = selection?.type === "area" && selection.id === a.id;
            const c = centroid(a.points);
            return (
              <g key={a.id}>
                <polygon
                  points={a.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={info.fill}
                  fillOpacity={bg ? 0.6 : 0.85}
                  stroke={active ? "#1f513a" : info.stroke}
                  strokeWidth={(active ? 3 : 1.5) / s}
                  strokeLinejoin="round"
                />
                {showLabels && (
                  <text
                    x={c.x}
                    y={c.y}
                    fontSize={11 / s}
                    fontWeight={600}
                    fill="#3b4a33"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.8)", strokeWidth: 3 / s }}
                  >
                    {a.name}
                  </text>
                )}
              </g>
            );
          })}

          {mode.kind === "draw" && draft.length > 0 && (
            <g>
              <polygon
                points={draft.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="rgba(47,107,69,0.15)"
                stroke="#2f6b45"
                strokeWidth={2 / s}
                strokeDasharray={`${6 / s} ${4 / s}`}
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={5 / s} fill="#fff" stroke="#2f6b45" strokeWidth={2 / s} />
              ))}
            </g>
          )}

          {plants
            .filter((p) => p.line && p.line.length >= 2)
            .map((p) => {
              const info = categoryInfo(p.category);
              const active = selection?.type === "plant" && selection.id === p.id;
              const mid = polylineMidpoint(p.line!);
              const pts = p.line!.map((q) => `${q.x},${q.y}`).join(" ");
              const width = Math.max(0.5, 8 / s);
              return (
                <g key={p.id} style={{ pointerEvents: "none" }}>
                  {active && <polyline points={pts} fill="none" stroke={info.color} strokeOpacity={0.25} strokeWidth={width * 2.2} strokeLinecap="round" strokeLinejoin="round" />}
                  <polyline points={pts} fill="none" stroke={info.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={pts} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={Math.max(0.1, width * 0.25)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${width * 0.6} ${width * 0.8}`} />
                  {hasPixelIcon(p.category) && <PixelGlyph category={p.category} x={mid.x} y={mid.y} size={14 / s} />}
                  {(showLabels || active) && (
                    <text
                      x={mid.x}
                      y={mid.y - (hasPixelIcon(p.category) ? 7 / s : width / 2) - 6 / s}
                      fontSize={11 / s}
                      fontWeight={600}
                      fill="#243325"
                      textAnchor="middle"
                      style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 3 / s }}
                    >
                      {plantTitle(p)} · {polylineLength(p.line!).toFixed(0)} m
                    </text>
                  )}
                </g>
              );
            })}

          {mode.kind === "place" && placingAsLine && draft.length > 0 && (
            <g style={{ pointerEvents: "none" }}>
              <polyline
                points={draft.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={placingPlant ? categoryInfo(placingPlant.category).color : "#2f6b45"}
                strokeOpacity={0.7}
                strokeWidth={Math.max(0.5, 8 / s)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={5 / s} fill="#fff" stroke="#2f6b45" strokeWidth={2 / s} />
              ))}
            </g>
          )}

          {plants
            .filter((p) => p.position)
            .map((p) => {
              const pos = dragging?.id === p.id ? dragging.pos : p.position!;
              return (
                <PlantMarker
                  key={p.id}
                  plant={p}
                  pos={pos}
                  scale={s}
                  showLabel={showLabels || (selection?.type === "plant" && selection.id === p.id)}
                  selected={selection?.type === "plant" && selection.id === p.id}
                  draggable={mode.kind === "view"}
                  onTap={(e) => {
                    if (mode.kind === "view") setSelection({ type: "plant", id: p.id });
                    else handleTapAt(e.clientX, e.clientY);
                  }}
                  onDrag={(pt) => setDragging({ id: p.id, pos: pt })}
                  onDrop={async (pt) => {
                    setDragging(null);
                    await db.plants.update(p.id, { position: { x: snap(clamp(pt.x, 0, W)), y: snap(clamp(pt.y, 0, H)) }, updatedAt: Date.now() });
                  }}
                />
              );
            })}
          </g>
          <rect x={0} y={0} width={W} height={H} fill="none" stroke={bg ? "#ffffff" : "#a9b897"} strokeOpacity={bg ? 0.45 : 1} strokeWidth={2 / s} rx={0.2} />
        </g>
      </svg>

      {/* Toppfelt */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 pt-3">
          <div className="pointer-events-auto rounded-2xl bg-background/85 px-3.5 py-2 shadow-sm ring-1 ring-foreground/10 backdrop-blur-xl">
            <h1 className="font-heading text-lg font-semibold tracking-tight">Hagekart</h1>
            <p className="text-[11px] text-muted-foreground">
              {W} × {H} m · {placedCount} av {plants.length} planter plassert
            </p>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <Button variant="outline" size="icon-lg" className="rounded-full bg-background/85 shadow-sm backdrop-blur-xl" onClick={fit} aria-label="Tilpass">
              <Maximize2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-full bg-background/85 shadow-sm backdrop-blur-xl"
              aria-label="Bakgrunnsbilde"
              onClick={() => setBgSheetOpen(true)}
            >
              <ImageIcon className="size-4" />
            </Button>
            <Button variant="outline" size="icon-lg" className="rounded-full bg-background/85 shadow-sm backdrop-blur-xl" nativeButton={false} render={<Link href="/innstillinger/" aria-label="Kartstørrelse" />}>
              <Settings className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bunnfelt */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {mode.kind === "view" && selectedPlant && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-background p-3 shadow-lg ring-1 ring-foreground/10">
              <PlantThumb plant={selectedPlant} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{plantTitle(selectedPlant)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedPlant.latinName || categoryInfo(selectedPlant.category).label}
                  {selectedPlant.line ? ` · rekke på ${polylineLength(selectedPlant.line).toFixed(0)} m` : " · dra for å flytte"}
                </p>
              </div>
              {selectedPlant.line && (
                <Button variant="ghost" size="icon-sm" aria-label="Tegn rekken på nytt" onClick={() => startPlacing(selectedPlant.id, true)}>
                  <PenLine className="size-4 text-muted-foreground" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" aria-label="Fjern fra kartet" onClick={() => removeFromMap(selectedPlant.id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
              <Button size="sm" className="rounded-lg" nativeButton={false} render={<Link href={`/plante/?id=${selectedPlant.id}`} />}>
                Åpne <ChevronRight data-icon="inline-end" />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Lukk" onClick={() => setSelection(null)}>
                <X className="size-4" />
              </Button>
            </div>
          )}

          {mode.kind === "view" && selectedArea && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-background p-3 shadow-lg ring-1 ring-foreground/10">
              <span className="size-10 shrink-0 rounded-xl ring-1 ring-foreground/10" style={{ backgroundColor: areaInfo(selectedArea.kind).fill }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedArea.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {areaInfo(selectedArea.kind).label} · {polygonArea(selectedArea.points).toFixed(1)} m²
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Slett område" onClick={() => deleteArea(selectedArea.id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  setRenameArea(selectedArea);
                  setAreaName(selectedArea.name);
                  setAreaKind(selectedArea.kind);
                }}
              >
                Endre
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Lukk" onClick={() => setSelection(null)}>
                <X className="size-4" />
              </Button>
            </div>
          )}

          {mode.kind === "view" && (
            <div className="pointer-events-auto flex gap-2">
              <Button className="h-11 flex-1 rounded-xl shadow-md" onClick={() => setPickOpen(true)}>
                <MapPin data-icon="inline-start" /> Plasser plante
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl bg-background shadow-md"
                onClick={() => {
                  setSelection(null);
                  setDraft([]);
                  setMode({ kind: "draw" });
                }}
              >
                <PenLine data-icon="inline-start" /> Tegn område
              </Button>
            </div>
          )}

          {mode.kind === "place" && (
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg">
              <div className="flex items-center gap-3">
                <MapPin className="size-5 shrink-0" />
                <p className="flex-1 text-sm font-medium">
                  {placingAsLine
                    ? `Trykk langs der ${placingPlant?.name ?? "rekken"} går. ${draft.length === 0 ? "Start i den ene enden." : `${draft.length} ${draft.length === 1 ? "punkt" : "punkter"}${draft.length >= 2 ? `, ${polylineLength(draft).toFixed(0)} m` : ""}.`}`
                    : `Trykk på kartet der ${placingPlant?.name ?? "planten"} står`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-lg bg-primary-foreground/15 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft([]);
                      setMode({ ...mode, asLine: false });
                    }}
                    className={`rounded-md px-2.5 py-1 ${!placingAsLine ? "bg-primary-foreground text-primary" : ""}`}
                  >
                    Punkt
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode({ ...mode, asLine: true })}
                    className={`rounded-md px-2.5 py-1 ${placingAsLine ? "bg-primary-foreground text-primary" : ""}`}
                  >
                    Rekke
                  </button>
                </div>
                {placingAsLine && (
                  <Button variant="secondary" size="sm" className="rounded-lg" disabled={draft.length === 0} onClick={() => setDraft((d) => d.slice(0, -1))}>
                    <Undo2 data-icon="inline-start" /> Angre
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto rounded-lg text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  onClick={() => {
                    setDraft([]);
                    setMode({ kind: "view" });
                  }}
                >
                  Avbryt
                </Button>
                {placingAsLine && (
                  <Button variant="secondary" size="sm" className="rounded-lg" disabled={draft.length < 2} onClick={finishLine}>
                    <Check data-icon="inline-start" /> Ferdig
                  </Button>
                )}
              </div>
            </div>
          )}

          {mode.kind === "bg" && (
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl bg-background p-3 shadow-lg ring-1 ring-foreground/10">
              <p className="text-sm">
                <span className="font-medium">Juster bakgrunnsbildet.</span> Dra for å flytte og klyp for å skalere, til bildet stemmer med rutenettet ({W} × {H} m).
              </p>
              <div className="flex items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">Synlighet</span>
                {[0.4, 0.7, 1].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setBackgroundOpacity(o)}
                    className={`h-8 rounded-lg border px-2.5 text-xs font-medium ${Math.abs((bg?.opacity ?? 1) - o) < 0.01 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                  >
                    {Math.round(o * 100)} %
                  </button>
                ))}
                <Button
                  size="sm"
                  className="ml-auto rounded-lg"
                  onClick={() => {
                    setBgDraft(null);
                    setMode({ kind: "view" });
                  }}
                >
                  <Check data-icon="inline-start" /> Ferdig
                </Button>
              </div>
            </div>
          )}

          {mode.kind === "draw" && (
            <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl bg-background p-3 shadow-lg ring-1 ring-foreground/10">
              <p className="text-sm">
                <span className="font-medium">Tegn område.</span> Trykk på kartet for hvert hjørne. {draft.length > 0 && `${draft.length} ${draft.length === 1 ? "hjørne" : "hjørner"}.`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" disabled={draft.length === 0} onClick={() => setDraft((d) => d.slice(0, -1))}>
                  <Undo2 data-icon="inline-start" /> Angre
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    setDraft([]);
                    setMode({ kind: "view" });
                  }}
                >
                  Avbryt
                </Button>
                <Button size="sm" className="ml-auto rounded-lg" disabled={draft.length < 3} onClick={finishDraw}>
                  <Check data-icon="inline-start" /> Ferdig
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bakgrunnsbilde */}
      <Sheet open={bgSheetOpen} onOpenChange={setBgSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-[calc(var(--safe-bottom)+1.25rem)]">
          <SheetHeader className="px-0">
            <SheetTitle className="text-lg">Bakgrunnsbilde</SheetTitle>
            <SheetDescription>
              Legg et satellittbilde, flyfoto eller en tomtetegning under kartet. Etterpå flytter og skalerer du bildet så det stemmer med rutenettet i meter.
            </SheetDescription>
          </SheetHeader>
          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBackground(e.target.files?.[0])} />
          <div className="flex flex-col gap-2">
            <Button size="lg" className="h-12 rounded-xl" disabled={bgBusy} onClick={() => bgInputRef.current?.click()}>
              {bgBusy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
              {bgBusy ? "Behandler bildet ..." : background ? "Bytt bilde" : "Last opp bilde"}
            </Button>
            {background && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl"
                  onClick={() => {
                    setBgSheetOpen(false);
                    setSelection(null);
                    setMode({ kind: "bg" });
                  }}
                >
                  <Move data-icon="inline-start" /> Juster plassering og størrelse
                </Button>
                <Button variant="destructive" size="lg" className="h-12 rounded-xl" onClick={removeBackground}>
                  <Trash2 data-icon="inline-start" /> Fjern bilde
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Tips: Ta et skjermbilde av tomten med satellittvisning i Google Maps eller Apple Kart, eller flyfoto på norgeskart.no. Sett kartstørrelsen i innstillinger til tomtens mål først, så er bildet enkelt å tilpasse.
          </p>
        </SheetContent>
      </Sheet>

      {/* Velg plante som skal plasseres */}
      <Sheet open={pickOpen} onOpenChange={setPickOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl px-0 pb-[calc(var(--safe-bottom)+0.5rem)]">
          <SheetHeader className="px-5">
            <SheetTitle className="text-lg">Hvilken plante?</SheetTitle>
            <SheetDescription>Velg en plante, og trykk så på kartet der den står.</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto">
            {plants.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">Du har ingen planter enda.</p>
            ) : (
              <ul className="divide-y divide-border">
                {[...plants]
                  .sort((a, b) => Number(isPlaced(a)) - Number(isPlaced(b)) || a.name.localeCompare(b.name, "nb"))
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-muted/60"
                        onClick={() => startPlacing(p.id)}
                      >
                        <PlantThumb plant={p} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{plantTitle(p)}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {isPlaced(p) ? "Allerede på kartet · flytt" : p.category === "hekk" ? "Hekk · tegnes som rekke" : categoryInfo(p.category).label}
                          </span>
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground/60" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div className="px-5 pt-2">
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={() => {
                setPickOpen(false);
                setNewPlantOpen(true);
              }}
            >
              <Plus data-icon="inline-start" /> Ny plante
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PlantForm
        open={newPlantOpen}
        onOpenChange={setNewPlantOpen}
        onSaved={(p) => startPlacing(p.id)}
      />

      {/* Navn og type på nytt / endret område */}
      <Dialog
        open={!!areaDialog || !!renameArea}
        onOpenChange={(o) => {
          if (!o) {
            setAreaDialog(null);
            setRenameArea(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameArea ? "Endre område" : "Nytt område"}</DialogTitle>
            <DialogDescription>{renameArea ? "Gi området nytt navn eller type." : "Hva slags område har du tegnet?"}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field label="Type" htmlFor="area-kind">
              <NativeSelect id="area-kind" value={areaKind} onChange={(e) => setAreaKind(e.target.value as AreaKind)}>
                {AREA_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Navn" htmlFor="area-name">
              <Input id="area-name" value={areaName} onChange={(e) => setAreaName(e.target.value)} placeholder={areaInfo(areaKind).label} className="h-11 rounded-lg" />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAreaDialog(null);
                setRenameArea(null);
              }}
            >
              Avbryt
            </Button>
            <Button
              onClick={async () => {
                if (renameArea) {
                  await db.areas.update(renameArea.id, { name: areaName.trim() || areaInfo(areaKind).label, kind: areaKind });
                  setRenameArea(null);
                } else {
                  await saveArea();
                }
              }}
            >
              Lagre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlantMarker({
  plant,
  pos,
  scale,
  showLabel,
  selected,
  draggable,
  onTap,
  onDrag,
  onDrop,
}: {
  plant: Plant;
  pos: Point;
  scale: number;
  showLabel: boolean;
  selected: boolean;
  draggable: boolean;
  onTap: (e: PointerEvent) => void;
  onDrag: (p: Point) => void;
  onDrop: (p: Point) => void;
}) {
  const info = categoryInfo(plant.category);
  const startRef = useRef<Point>(pos);
  const bind = useDrag(
    ({ first, last, tap, movement: [mx, my], event }) => {
      if (tap) {
        onTap(event as PointerEvent);
        return;
      }
      if (!draggable) return;
      if (first) startRef.current = pos;
      const next = { x: startRef.current.x + mx / scale, y: startRef.current.y + my / scale };
      if (last) onDrop(next);
      else onDrag(next);
    },
    { filterTaps: true, threshold: 4, pointer: { touch: true } }
  );

  const r = (selected ? 16 : 13) / scale;
  const pixel = hasPixelIcon(plant.category);
  const glyphSize = (selected ? 18 : 14) / scale;
  const hitSize = 28 / scale;
  const labelY = pixel ? glyphSize / 2 + 9 / scale : r + 11 / scale;
  return (
    <g
      {...bind()}
      data-marker
      transform={`translate(${pos.x} ${pos.y})`}
      style={{ cursor: draggable ? "grab" : "pointer", touchAction: "none" }}
    >
      {selected && <circle r={pixel ? glyphSize * 0.9 : r * 1.55} fill={info.color} fillOpacity={0.18} />}
      {pixel ? (
        <>
          <rect x={-hitSize / 2} y={-hitSize / 2} width={hitSize} height={hitSize} fill="transparent" />
          <PixelGlyph category={plant.category} size={glyphSize} />
        </>
      ) : (
        <>
          <circle r={r} fill="#fff" stroke={info.color} strokeWidth={(selected ? 3 : 2) / scale} />
          <text fontSize={(selected ? 16 : 13) / scale} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: "none" }}>
            {info.emoji}
          </text>
        </>
      )}
      {showLabel && (
        <text
          y={labelY}
          fontSize={11 / scale}
          fontWeight={600}
          fill="#243325"
          textAnchor="middle"
          style={{ pointerEvents: "none", paintOrder: "stroke", stroke: "rgba(255,255,255,0.9)", strokeWidth: 3 / scale }}
        >
          {plantTitle(plant)}
        </text>
      )}
    </g>
  );
}

