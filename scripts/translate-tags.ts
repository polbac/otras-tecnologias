import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

type ResourceFm = {
  tags?: string[];
};

const RESOURCES_DIR = path.join(process.cwd(), "src", "content", "resources");

const TAG_MAP: Record<string, string> = {
  "arte": "art",
  "archivo": "archive",
  "ayuda-mutua": "mutual-aid",
  "bibliotecas": "libraries",
  "ciencia-abierta": "open-science",
  "comic": "comics",
  "comunidad": "community",
  "comunes": "commons",
  "conocimiento": "knowledge",
  "cooperacion": "cooperation",
  "cooperativas": "cooperatives",
  "critica": "critique",
  "cuidado": "care",
  "cultura-libre": "free-culture",
  "datos-abiertos": "open-data",
  "debate": "debate",
  "democracia": "democracy",
  "derechos": "rights",
  "diseno": "design",
  "dominio-publico": "public-domain",
  "economia": "economy",
  "educacion": "education",
  "energia": "energy",
  "estandares": "standards",
  "eventos": "events",
  "guia": "guide",
  "hardware": "hardware",
  "herramientas": "tools",
  "historia": "history",
  "infraestructura": "infrastructure",
  "justicia": "justice",
  "latam": "latam",
  "licencias": "licenses",
  "linux": "linux",
  "mantenimiento": "maintenance",
  "open-web": "open-web",
  "p2p": "p2p",
  "politica": "politics",
  "privacidad": "privacy",
  "progreso": "progress",
  "protocolos": "protocols",
  "redes": "social",
  "resiliencia": "resilience",
  "seguridad": "security",
  "sustentabilidad": "sustainability",
  "teoria": "theory",
  "transparencia": "transparency",
  "autohosting": "self-hosting",
  "descentralizacion": "decentralization",
  "convivencia": "community-care",
  "derechos-digitales": "digital-rights",
  "open-source": "open-source",
  "software-libre": "free-software",
  "diy": "diy",
  "audio": "audio"
};

function normalizeTag(t: string) {
  return t.trim().toLowerCase();
}

async function main() {
  const files = (await fs.readdir(RESOURCES_DIR)).filter((f) => f.endsWith(".md"));
  let changed = 0;

  for (const file of files) {
    const full = path.join(RESOURCES_DIR, file);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as ResourceFm;
    const tags = (fm.tags ?? []).map(normalizeTag);
    if (!tags.length) continue;

    const mapped = tags.map((t) => TAG_MAP[t] ?? t);
    const uniq = Array.from(new Set(mapped)).sort((a, b) => a.localeCompare(b, "en"));

    const next = { ...(parsed.data as any), tags: uniq };
    const nextRaw = matter.stringify(parsed.content, next);
    if (nextRaw !== raw) {
      await fs.writeFile(full, nextRaw, "utf8");
      changed++;
    }
  }

  console.log(`OK: translated tags in files: ${changed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

