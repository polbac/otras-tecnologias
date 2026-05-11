import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

type ResourceFm = {
  title: string;
  description: string;
  authors: string[];
  link: string;
  createdAt: Date | string;
  tags: string[];
  image?: string;
  image8bit?: string;
};

const RESOURCES_DIR = path.join(process.cwd(), "src", "content", "resources");
const README_PATH = path.join(process.cwd(), "README.md");

function toISODate(d: unknown) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "string") return d.slice(0, 10);
  return "";
}

function slugFromFilename(filename: string) {
  return filename.replace(/\.md$/i, "");
}

function section(content: string) {
  const start = "<!-- OT:LIST:START -->";
  const end = "<!-- OT:LIST:END -->";
  const s = content.indexOf(start);
  const e = content.indexOf(end);
  if (s === -1 || e === -1 || e < s) return null;
  return { start, end, s, e };
}

async function readResources() {
  const files = (await fs.readdir(RESOURCES_DIR)).filter((f: string) => f.endsWith(".md"));
  const entries: Array<{ slug: string; fm: ResourceFm }> = [];

  for (const file of files) {
    const full = path.join(RESOURCES_DIR, file);
    const raw = await fs.readFile(full, "utf8");
    const { data } = matter(raw);
    const fm = data as ResourceFm;
    if (!fm?.title || !fm?.link) continue;
    entries.push({ slug: slugFromFilename(file), fm });
  }

  entries.sort((a, b) => {
    const da = new Date(a.fm.createdAt as any).getTime();
    const db = new Date(b.fm.createdAt as any).getTime();
    return db - da;
  });

  return entries;
}

function renderList(entries: Array<{ slug: string; fm: ResourceFm }>) {
  const lines: string[] = [];
  lines.push("<!-- OT:LIST:START -->");
  lines.push("");
  lines.push(`Total: **${entries.length}** recursos`);
  lines.push("");
  lines.push("| titulo | autores | fecha | tags | link |");
  lines.push("| - | - | - | - | - |");

  for (const { fm } of entries) {
    const title = fm.title.replace(/\|/g, "\\|");
    const authors = (fm.authors ?? []).join(", ").replace(/\|/g, "\\|");
    const date = toISODate(fm.createdAt);
    const tags = (fm.tags ?? []).join(", ").replace(/\|/g, "\\|");
    const link = fm.link;
    lines.push(`| ${title} | ${authors} | ${date} | ${tags} | ${link} |`);
  }

  lines.push("");
  lines.push("<!-- OT:LIST:END -->");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  await fs.mkdir(RESOURCES_DIR, { recursive: true });
  const entries = await readResources();

  const baseReadme = `# OTRAS TECNOLOGIAS (OT)

Archivo / libreria de recursos sobre tecnologia pensada desde:

- open-source
- DIY
- democracia
- paz
- arte
- progreso
- comunidad
- cooperacion
- ayuda mutua

Incluye software, ideas, libros, articulos, teoria, aplicaciones, meetups, redes, hardware, etc.

## Desarrollo

\`\`\`bash
npm install
npm run dev
\`\`\`

## Scripts

- \`npm run generate:resources\`: genera el seed inicial de recursos (no sobreescribe archivos existentes).
- \`npm run readme\`: reconstruye el listado de recursos en este README a partir de \`src/content/resources\`.
- \`npm run images\`: procesa imagenes a 8/16-bit (cuando agregues originales a \`public/images/resources\`).

## Listado OT

<!-- OT:LIST:START -->
<!-- OT:LIST:END -->
`;

  let current = "";
  try {
    current = await fs.readFile(README_PATH, "utf8");
  } catch {
    current = baseReadme;
  }

  const sec = section(current);
  const listBlock = renderList(entries);
  let next = current;

  if (!sec) {
    next = baseReadme.replace("<!-- OT:LIST:START -->\n<!-- OT:LIST:END -->", listBlock.trim());
    if (!next.includes("<!-- OT:LIST:START -->")) {
      next += "\n\n" + listBlock;
    }
  } else {
    next = current.slice(0, sec.s) + listBlock + current.slice(sec.e + sec.end.length);
  }

  await fs.writeFile(README_PATH, next.replace(/\n{3,}/g, "\n\n"), "utf8");
  console.log(`OK: README updated: ${README_PATH}`);
  console.log(`OK: resources: ${entries.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

