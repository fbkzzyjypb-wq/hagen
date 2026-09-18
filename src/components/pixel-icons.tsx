import type { PlantCategory } from "@/lib/types";

type PixelIcon = { rows: string[]; palette: Record<string, string> };

/** Små pixel art-ikoner (8 × 8) for utvalgte kategorier. Andre kategorier bruker emoji. */
export const PIXEL_ICONS: Partial<Record<PlantCategory, PixelIcon>> = {
  tre: {
    rows: [
      "...gg...",
      "..gGGg..",
      ".gGGGGg.",
      "gGGGGGGg",
      "GGgGGGGG",
      ".GGGGGG.",
      "...BB...",
      "...BB...",
    ],
    palette: { G: "#3f7a3a", g: "#63a04c", B: "#6b4a2b" },
  },
  frukttre: {
    rows: [
      "...gg...",
      "..gGGg..",
      ".gGRGGg.",
      "gGGGGRGg",
      "GRgGGGGG",
      ".GGGGRG.",
      "...BB...",
      "...BB...",
    ],
    palette: { G: "#3f7a3a", g: "#63a04c", B: "#6b4a2b", R: "#d8443a" },
  },
  hekk: {
    rows: [
      "........",
      ".gGGgGG.",
      "GGgGGGgG",
      "GgGGGGGG",
      "GGGGgGGG",
      "DGGDGGGD",
      "DDDDDDDD",
      "........",
    ],
    palette: { G: "#2f6b45", g: "#4b8a5c", D: "#1f4a30" },
  },
};

export function hasPixelIcon(category: PlantCategory): boolean {
  return !!PIXEL_ICONS[category];
}

function pixels(icon: PixelIcon) {
  const out: { x: number; y: number; fill: string }[] = [];
  icon.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      const fill = icon.palette[c];
      if (fill) out.push({ x, y, fill });
    }
  });
  return out;
}

/** Ikon til bruk inne i et SVG-kart. Sentrert i (x, y), `size` i kartets enheter. */
export function PixelGlyph({ category, x = 0, y = 0, size }: { category: PlantCategory; x?: number; y?: number; size: number }) {
  const icon = PIXEL_ICONS[category];
  if (!icon) return null;
  const unit = size / 8;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${unit})`} style={{ pointerEvents: "none" }} shapeRendering="crispEdges">
      {pixels(icon).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.fill} />
      ))}
    </g>
  );
}

/** Frittstående ikon til bruk i vanlig HTML. Gir `null` for kategorier uten pixel-ikon. */
export function CategoryPixelIcon({ category, className }: { category: PlantCategory; className?: string }) {
  const icon = PIXEL_ICONS[category];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 8 8" className={className} shapeRendering="crispEdges" aria-hidden>
      {pixels(icon).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.fill} />
      ))}
    </svg>
  );
}
