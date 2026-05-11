import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";

type ResourceFm = Record<string, unknown> & {
  title: string;
  image?: string;
  image8bit?: string;
  imageSource?: string;
  imageLicense?: string;
};

const RESOURCES_DIR = path.join(process.cwd(), "src", "content", "resources");
const PLACEHOLDER_PATH = "/images/resources/ot-placeholder.png";
const PLACEHOLDER_8BIT_PATH = "/images/resources-8bit/ot-placeholder.png";
const PLACEHOLDER_LICENSE =
  "Placeholder graphic generated for the OT archive (not an official or site-provided asset).";

function publicFileFromUrl(url: string) {
  if (!url.startsWith("/")) return null;
  return path.join(process.cwd(), "public", url.slice(1));
}

async function pathExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function writePlaceholder() {
  const outPath = path.join(process.cwd(), "public", "images", "resources", "ot-placeholder.png");
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <rect width="640" height="400" fill="#0027b3"/>
  <rect x="40" y="120" width="560" height="160" fill="none" stroke="#ffea00" stroke-width="3"/>
  <text x="320" y="210" text-anchor="middle" fill="#d6ddff" font-family="monospace" font-size="26">OT</text>
  <text x="320" y="245" text-anchor="middle" fill="#ffea00" font-family="monospace" font-size="15">placeholder / no image</text>
</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`OK: placeholder PNG -> ${path.relative(process.cwd(), outPath)}`);
}

async function main() {
  await writePlaceholder();

  const files = (await fs.readdir(RESOURCES_DIR)).filter((f) => f.endsWith(".md"));
  let updated = 0;

  for (const file of files) {
    const full = path.join(RESOURCES_DIR, file);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    const fm = { ...(parsed.data as ResourceFm) };

    const img = typeof fm.image === "string" ? fm.image.trim() : "";
    const imgDisk = img ? publicFileFromUrl(img) : null;
    const imgOk = Boolean(imgDisk && (await pathExists(imgDisk)));

    if (!imgOk) {
      fm.image = PLACEHOLDER_PATH;
      fm.image8bit = PLACEHOLDER_8BIT_PATH;
      fm.imageLicense = PLACEHOLDER_LICENSE;
      delete fm.imageSource;
    } else {
      const leaf = (img.split("/").pop() || "").trim();
      const baseName = path.parse(leaf).name || file.replace(/\.md$/i, "");
      const expected8 = `/images/resources-8bit/${baseName}.png`;
      if (!fm.image8bit) {
        fm.image8bit = expected8;
      }
    }

    const nextRaw = matter.stringify(parsed.content, fm);
    if (nextRaw !== raw) {
      await fs.writeFile(full, nextRaw, "utf8");
      updated++;
    }
  }

  console.log(`OK: updated resource markdown files: ${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
