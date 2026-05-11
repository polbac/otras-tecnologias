import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

type ResourceFm = {
  title: string;
  description: string;
  authors: string[];
  link: string;
  createdAt: string | Date;
  tags: string[];
  image?: string;
  image8bit?: string;
  imageSource?: string;
  imageLicense?: string;
};

const RESOURCES_DIR = path.join(process.cwd(), "src", "content", "resources");
const OUT_DIR = path.join(process.cwd(), "public", "images", "resources");

const USER_AGENT = "otras-tecnologias-bot/0.1 (og:image fetcher)";

function slugFromFilename(filename: string) {
  return filename.replace(/\.md$/i, "");
}

function sniffOgImage(html: string) {
  // prefer property="og:image" but accept name="og:image"
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["'][^>]*>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function extFromContentType(ct: string | null) {
  if (!ct) return null;
  const t = ct.split(";")[0]?.trim().toLowerCase();
  if (t === "image/jpeg") return ".jpg";
  if (t === "image/png") return ".png";
  if (t === "image/webp") return ".webp";
  if (t === "image/gif") return ".gif";
  if (t === "image/avif") return ".avif";
  if (t === "image/svg+xml") return ".svg";
  return null;
}

function extFromUrl(u: URL) {
  const p = u.pathname.toLowerCase();
  for (const ext of [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".svg"]) {
    if (p.endsWith(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  }
  return null;
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}

async function fetchBinary(url: string) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const ct = res.headers.get("content-type");
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, ct };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const files = (await fs.readdir(RESOURCES_DIR)).filter((f) => f.endsWith(".md"));
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const slug = slugFromFilename(file);
    const full = path.join(RESOURCES_DIR, file);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as ResourceFm;

    // don’t overwrite manual work
    if (fm.image || fm.image8bit) {
      skipped++;
      continue;
    }

    const pageUrl = fm.link;
    if (!pageUrl) {
      skipped++;
      continue;
    }

    try {
      const html = await fetchText(pageUrl);
      const og = sniffOgImage(html);
      if (!og) {
        skipped++;
        continue;
      }

      const ogUrl = new URL(og, pageUrl).toString();
      const { buf, ct } = await fetchBinary(ogUrl);
      const ext = extFromContentType(ct) ?? extFromUrl(new URL(ogUrl)) ?? ".jpg";
      const outName = `${slug}${ext}`;
      const outPath = path.join(OUT_DIR, outName);
      await fs.writeFile(outPath, buf);

      const publicPath = `/images/resources/${outName}`;
      const public8 = `/images/resources-8bit/${slug}.png`;

      const nextData: ResourceFm = {
        ...(fm as any),
        image: publicPath,
        image8bit: public8,
        imageSource: ogUrl,
        imageLicense: "ver link fuente (og:image) / revisar licencia manualmente",
      };

      const nextRaw = matter.stringify(parsed.content, nextData);
      await fs.writeFile(full, nextRaw, "utf8");

      ok++;
      // keep it polite; avoid hammering hosts
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      failed++;
      // keep going
      console.warn(`WARN: ${slug}: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  console.log(`OK: downloaded og:image for: ${ok}`);
  console.log(`OK: skipped (already had image / no og:image): ${skipped}`);
  console.log(`OK: failed: ${failed}`);
  console.log("Siguiente paso: corre `npm run images` para generar /images/resources-8bit/*");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

