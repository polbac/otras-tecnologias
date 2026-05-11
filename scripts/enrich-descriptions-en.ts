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

function normalize(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function foldAccents(s: string) {
  return s.normalize("NFD").replace(/\p{M}+/gu, "");
}

// Not a full translator — but for our seed corpus it produces readable English
// by applying longest-match phrase replacements first.
const ES_TO_EN_PAIRS: Array<[string, string]> = [
  ["enciclopedia libre colaborativa", "A collaborative free encyclopedia"],
  ["enciclopedia colaborativa libre", "A collaborative free encyclopedia"],
  ["mapa libre del mundo", "a community-made map of the world"],
  ["infraestructura social de conocimiento compartido", "social infrastructure for shared knowledge"],
  ["infraestructura social", "social infrastructure"],
  ["datos abiertos", "open data"],
  ["software libre", "free software"],
  ["codigo abierto", "open source code"],
  ["recursos educativos abiertos", "open educational resources"],
  ["licencia libre", "free license"],
  ["licencias libres", "free licenses"],
  ["mapa libre", "free map"],
  ["voluntariado", "volunteering"],
  ["voluntarios", "volunteers"],
  ["voluntario", "volunteer"],
  ["voluntaria", "volunteer"],

  ["organizacion", "organization"],
  ["distribucion", "distribution"],
  ["cooperacion", "cooperation"],
  ["comunicacion", "communication"],
  ["investigacion", "research"],
  ["educacion", "education"],
  ["documentacion", "documentation"],
  ["implementacion", "implementation"],
  ["administracion", "administration"],
  ["configuracion", "configuration"],
  ["participacion", "participation"],
  ["representacion", "representation"],
  ["descentralizacion", "decentralization"],
  ["centralizacion", "centralization"],
  ["privacidad", "privacy"],
  ["seguridad", "security"],
  ["sustentabilidad", "sustainability"],
  ["sostenibilidad", "sustainability"],
  ["energia", "energy"],
  ["politica", "politics"],
  ["teoria", "theory"],
  ["historia", "history"],
  ["cultura", "culture"],
  ["ciencia", "science"],
  ["arte", "art"],
  ["archivo", "archive"],
  ["archivos", "archives"],
  ["debate", "debate"],
  ["comunidad", "community"],
  ["comunidades", "communities"],
  ["infraestructura", "infrastructure"],
  ["conocimiento", "knowledge"],
  ["compartido", "shared"],
  ["compartida", "shared"],
  ["colaborativa", "collaborative"],
  ["colaborativo", "collaborative"],
  ["colaboracion", "collaboration"],
  ["herramientas", "tools"],
  ["herramienta", "tool"],
  ["licencias", "licenses"],
  ["licencia", "license"],
  ["democracia", "democracy"],
  ["derechos", "rights"],
  ["derecho", "right"],
  ["autonomia", "autonomy"],
  ["gobierno", "governance"],
  ["protocolos", "protocols"],
  ["protocolo", "protocol"],
  ["estandares", "standards"],
  ["estandar", "standard"],
  ["nucleo", "kernel"],
  ["kernel", "kernel"],
  ["enciclopedia", "encyclopedia"],
  ["proyecto", "project"],
  ["proyectos", "projects"],
  ["organizaciones", "organizations"],
  ["plataforma", "platform"],
  ["plataformas", "platforms"],
  ["red", "network"],
  ["redes", "networks"],
  ["internet", "internet"],
  ["web", "web"],
  ["mapa", "map"],
  ["mapas", "maps"],
  ["datos", "data"],
  ["abiertos", "open"],
  ["abierto", "open"],
  ["abierta", "open"],
  ["publico", "public"],
  ["publica", "public"],
  ["digital", "digital"],
  ["digitales", "digital"],
  ["libre", "free"],
  ["libres", "free"],
  ["gratis", "free-of-charge"],
  ["etc", "etc."],
];

function translateEsToEn(text: string) {
  let t = text;

  // normalize common punctuation spacing
  t = t.replace(/\s*;\s*/g, "; ").replace(/\s*,\s*/g, ", ").replace(/\s*\.\s*/g, ". ").trim();

  const folded = foldAccents(t).toLowerCase();
  const tokens = folded
    .split(/[^a-z0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const spanishHints = new Set([
    "de",
    "del",
    "la",
    "las",
    "los",
    "y",
    "para",
    "por",
    "una",
    "un",
    "en",
    "con",
    "sin",
    "sobre",
    "entre",
    "como",
    "mas",
    "más",
    "tambien",
    "también",
    "ademas",
    "además",
  ]);

  const looksSpanish =
    /[áéíóúñü]/i.test(t) || tokens.some((tok) => spanishHints.has(foldAccents(tok).toLowerCase()));

  if (!looksSpanish) return t;

  // apply replacements case-insensitively on a folded key, but rewrite the original casing gently:
  // simplest approach: replace on the string with RegExp using 'gi' for Spanish tokens.
  const pairs = [...ES_TO_EN_PAIRS].sort((a, b) => b[0].length - a[0].length);
  for (const [es, en] of pairs) {
    const re = new RegExp(`\\b${es.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    t = t.replace(re, en);
  }

  // a few cleanup passes
  t = t
    .replace(/\betc\.\./g, "etc.")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();

  return t;
}

function polishEnglish(s: string) {
  let t = s;

  // common artifacts from literal token replacement
  t = t.replace(/\bencyclopedia\s+free\s+collaborative\b/gi, "A collaborative free encyclopedia");
  t = t.replace(/\bmap\s+free\b/gi, "free map");
  t = t.replace(/\bfree\s+map\s+of\b/gi, "free map of");
  t = t.replace(/\bopen\s+source\s+code\s+code\b/gi, "open-source code");
  t = t.replace(/\bfree\s+software\s+software\b/gi, "free software");
  t = t.replace(/\bcommunity\s+community\b/gi, "community");
  t = t.replace(/\s+;\s+/g, "; ");
  t = t.replace(/\s{2,}/g, " ").trim();

  // capitalize first letter if it looks like a sentence
  if (t.length && /[a-z]/.test(t[0] ?? "")) {
    t = t[0]!.toUpperCase() + t.slice(1);
  }

  return t;
}

function tagSentence(tags: string[]) {
  const pick = tags.slice(0, 6);
  if (!pick.length) return "";
  return `In the OT archive, this entry is tagged as: ${pick.join(", ")} — a shorthand for the kinds of practice and politics it connects to.`;
}

function splitDescriptionParagraphs(desc: string) {
  return desc
    // YAML folded blocks often insert indented blank lines like "\n\n  \n"
    .split(/\n(?:[ \t]*\n)+/g)
    .map((p) => normalize(p))
    .filter(Boolean);
}

function isTagBlurb(p: string) {
  return p.startsWith("In the OT archive, this entry is tagged as:");
}

function isBeyondBlurb(p: string) {
  return p.startsWith("Beyond the headline:");
}

function isFollowLinkBlurb(p: string) {
  return p.startsWith("If you follow the link,");
}

const TAG_PREFIX = "In the OT archive, this entry is tagged as:";
const BEYOND_PREFIX = "Beyond the headline:";
const FOLLOW_PREFIX = "If you follow the link,";

function extractKnownBlurbs(blob: string) {
  let rest = blob;

  const tagIdx = rest.indexOf(TAG_PREFIX);
  const beyondIdx = rest.indexOf(BEYOND_PREFIX);

  let tag = "";
  let beyond = "";
  let follow = "";

  if (tagIdx !== -1 && beyondIdx !== -1 && beyondIdx > tagIdx) {
    tag = rest.slice(tagIdx, beyondIdx).trim();
    rest = `${rest.slice(0, tagIdx).trim()} ${rest.slice(beyondIdx).trim()}`.trim();
  } else if (tagIdx !== -1) {
    tag = rest.slice(tagIdx).trim();
    rest = rest.slice(0, tagIdx).trim();
  }

  const beyondIdx2 = rest.indexOf(BEYOND_PREFIX);
  const followIdx2 = rest.indexOf(FOLLOW_PREFIX);

  if (beyondIdx2 !== -1 && followIdx2 !== -1 && followIdx2 > beyondIdx2) {
    beyond = rest.slice(beyondIdx2, followIdx2).trim();
    follow = rest.slice(followIdx2).trim();
    rest = rest.slice(0, beyondIdx2).trim();
  } else if (beyondIdx2 !== -1) {
    beyond = rest.slice(beyondIdx2).trim();
    rest = rest.slice(0, beyondIdx2).trim();
  } else if (followIdx2 !== -1) {
    follow = rest.slice(followIdx2).trim();
    rest = rest.slice(0, followIdx2).trim();
  }

  return { core: normalize(rest), tag, beyond, follow };
}

function dedupeKeepOrder(paras: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paras) {
    const key = normalize(p);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function buildEnglishBody(base: string, title: string, tags: string[]) {
  const incoming = splitDescriptionParagraphs(base);

  const cores: string[] = [];

  for (const p of incoming) {
    if (isTagBlurb(p) || isBeyondBlurb(p) || isFollowLinkBlurb(p)) continue;

    const extracted = extractKnownBlurbs(p);
    if (extracted.core) cores.push(extracted.core);
  }

  const corePolished = dedupeKeepOrder(cores).map((p) => polishEnglish(translateEsToEn(p)));
  const coreFinal = corePolished.length > 0 ? corePolished : [polishEnglish(translateEsToEn(base))];

  const tag = tagSentence(tags);
  const beyond = `Beyond the headline: ${title} is included here because it helps imagine technology as something collective — built, maintained, and argued about in public — rather than only as a private product.`;
  const follow =
    "If you follow the link, you will usually find primary documentation, community governance, or ongoing work that is hard to summarize in a single paragraph. Treat this page as a bookmark and a doorway, not a replacement for reading the source.";

  return dedupeKeepOrder([...coreFinal, tag, beyond, follow].filter(Boolean)).join("\n\n");
}

function stripLeadingHeading(md: string) {
  return md.replace(/^\s*#\s+.+$/m, "").trim();
}

function splitParagraphs(s: string) {
  return s
    .split(/\n(?:[ \t]*\n)+/g)
    .map((p) => normalize(p))
    .filter(Boolean);
}

function bodyWithoutDuplicateIntro(md: string, originalDescription: string) {
  const descParas = new Set(splitParagraphs(originalDescription).map(normalize));
  const translatedFirst = normalize(translateEsToEn(splitParagraphs(originalDescription)[0] ?? ""));
  if (translatedFirst) descParas.add(translatedFirst);

  const paras = md.split(/\n(?:[ \t]*\n)+/g).map((p) => p.trim()).filter(Boolean);
  const kept: string[] = [];

  for (const p of paras) {
    const pn = normalize(p);
    if (!pn) continue;
    if (pn.startsWith("#")) continue;
    if (descParas.has(pn)) continue;
    kept.push(p);
  }

  return kept.join("\n\n").trim();
}

async function main() {
  const files = (await fs.readdir(RESOURCES_DIR)).filter((f) => f.endsWith(".md"));
  let changed = 0;

  for (const file of files) {
    const full = path.join(RESOURCES_DIR, file);
    const raw = await fs.readFile(full, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as ResourceFm;

    const tags = (fm.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const newDesc = buildEnglishBody(fm.description, fm.title, tags);

    const oldBody = stripLeadingHeading(parsed.content ?? "");
    const cleaned = bodyWithoutDuplicateIntro(oldBody, fm.description);

    const nextBody = cleaned ? `${cleaned}\n` : "";
    const next = { ...(fm as any), description: newDesc };
    const nextRaw = matter.stringify(nextBody, next);

    if (nextRaw !== raw) {
      await fs.writeFile(full, nextRaw, "utf8");
      changed++;
    }
  }

  console.log(`OK: updated descriptions/body in files: ${changed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
