// Generates the app icons used by the PWA manifest, the browser tab, and the
// desktop installers, from a single SVG source so they never drift apart.
//
//     node scripts/generate-icons.mjs
//
// Re-run this only when the icon design changes; the PNGs are committed.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");

// A ledger/monogram mark: rupee-tinged "F&O" ledger card on the brand blue.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#1d4ed8"/>
  <rect x="112" y="96" width="288" height="320" rx="28" fill="#ffffff"/>
  <rect x="152" y="152" width="140" height="20" rx="10" fill="#1d4ed8"/>
  <rect x="152" y="204" width="208" height="14" rx="7" fill="#cbd5e1"/>
  <rect x="152" y="244" width="208" height="14" rx="7" fill="#cbd5e1"/>
  <rect x="152" y="284" width="130" height="14" rx="7" fill="#cbd5e1"/>
  <path d="M300 300 l34 40 l58 -84" fill="none" stroke="#067647" stroke-width="26"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const SIZES = [16, 32, 48, 64, 128, 180, 192, 256, 384, 512];

await mkdir(outDir, { recursive: true });

for (const size of SIZES) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
}

// Maskable icon: Android crops icons to a device-specific shape, so the mark
// is inset into a safe zone to avoid the corners being clipped.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1d4ed8"/>
  <g transform="translate(102 102) scale(0.6)">
    <rect x="112" y="96" width="288" height="320" rx="28" fill="#ffffff"/>
    <rect x="152" y="152" width="140" height="20" rx="10" fill="#1d4ed8"/>
    <rect x="152" y="204" width="208" height="14" rx="7" fill="#cbd5e1"/>
    <rect x="152" y="244" width="208" height="14" rx="7" fill="#cbd5e1"/>
    <rect x="152" y="284" width="130" height="14" rx="7" fill="#cbd5e1"/>
    <path d="M300 300 l34 40 l58 -84" fill="none" stroke="#067647" stroke-width="26"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(outDir, "icon-maskable-512.png"));

await writeFile(path.join(outDir, "icon.svg"), svg, "utf8");

// The desktop packager reads its icon from public/icons/icon-512.png (set as
// build.icon in package.json) rather than electron-builder's conventional
// build/ directory, which is gitignored as a build-output folder.
console.log(`Generated ${SIZES.length + 1} icons in public/icons`);
