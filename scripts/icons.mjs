// Genererer app-ikoner fra en SVG. Kjør: node scripts/icons.mjs
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

function svg({ size, padding, radius, bg = "#2f6b45" }) {
  const s = size;
  const inner = s - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3f8a5a"/>
      <stop offset="1" stop-color="${bg}"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${padding} ${padding}) scale(${inner / 100})">
    <!-- blad -->
    <path d="M52 86 C 30 78, 18 60, 22 34 C 44 30, 66 40, 72 62 C 74 72, 66 82, 52 86 Z" fill="#e9f4dc" opacity="0.96"/>
    <path d="M52 86 C 46 66, 42 54, 30 38" stroke="#2f6b45" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <path d="M44 66 C 50 64, 56 60, 60 54 M40 56 C 46 54, 50 50, 53 45" stroke="#2f6b45" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <!-- lite blad -->
    <path d="M60 22 C 70 18, 82 22, 84 32 C 76 36, 66 34, 60 22 Z" fill="#cfe6b8" opacity="0.95"/>
  </g>
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, padding: 24, radius: 40 },
  { file: "icon-512.png", size: 512, padding: 64, radius: 108 },
  { file: "apple-touch-icon.png", size: 180, padding: 22, radius: 0 },
  { file: "icon-maskable-512.png", size: 512, padding: 110, radius: 0 },
];

for (const t of targets) {
  const png = await sharp(Buffer.from(svg(t))).png().toBuffer();
  await writeFile(new URL(t.file, out), png);
  console.log("skrev", t.file);
}

const favicon = await sharp(Buffer.from(svg({ size: 64, padding: 8, radius: 14 }))).png().toBuffer();
await writeFile(new URL("../src/app/icon.png", import.meta.url), favicon);
console.log("skrev src/app/icon.png");
