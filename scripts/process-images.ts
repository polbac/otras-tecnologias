import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const IN_DIR = path.join(process.cwd(), "public", "images", "resources");
const OUT_DIR = path.join(process.cwd(), "public", "images", "resources-8bit");

const SUPPORTED = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function outName(file: string) {
  const base = file.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
  return `${base}.png`;
}

async function processOne(file: string) {
  const inPath = path.join(IN_DIR, file);
  const outPath = path.join(OUT_DIR, outName(file));

  const img = sharp(inPath, { failOn: "none" });

  // "pixel-ish" look: downscale then upscale with nearest-neighbor
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const targetW = Math.min(640, w || 640);

  // Step 1: downscale (reduce detail)
  const down = img
    .resize({ width: Math.max(160, Math.floor(targetW / 2)), withoutEnlargement: true })
    // Step 2: quantize palette (simulate 8/16-bit vibe)
    .png({ palette: true, colors: 64, dither: 1 });

  const downBuf = await down.toBuffer();

  // Step 3: upscale with nearest neighbor (pixelated)
  await sharp(downBuf)
    .resize({
      width: targetW,
      height: h ? Math.round((targetW / (w || targetW)) * h) : undefined,
      fit: "inside",
      kernel: sharp.kernel.nearest,
      withoutEnlargement: true,
    })
    .png({ palette: true, colors: 64, dither: 0 })
    .toFile(outPath);
}

async function main() {
  const hasIn = await exists(IN_DIR);
  if (!hasIn) {
    console.log(`OK: no input dir, skipping: ${IN_DIR}`);
    console.log("Crea imagenes en public/images/resources/ y re-ejecuta: npm run images");
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = await fs.readdir(IN_DIR);
  const todo = files.filter((f: string) => SUPPORTED.has(path.extname(f).toLowerCase()));

  if (todo.length === 0) {
    console.log(`OK: no images found in: ${IN_DIR}`);
    return;
  }

  let ok = 0;
  for (const f of todo) {
    await processOne(f);
    ok++;
  }

  console.log(`OK: processed: ${ok}`);
  console.log(`OK: output dir: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

