import { connectDB } from "@/lib/mongodb";
import KnowledgeBase from "@/models/KnowledgeBase";

// Retrieval for AI answers: documents are split into overlapping chunks, each
// chunk gets a Gemini embedding, and a question is answered from the few
// chunks closest to it, instead of the first 8,000 characters of everything.
//
// Search runs in-process (cosine over the company's chunks) so it works on any
// MongoDB, no Atlas Vector Search index needed. Fine for the size of an SMB
// knowledge base (thousands of chunks); MAX_CHUNKS_PER_COMPANY caps the work.

export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const EMBED_DIMS = 768;
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_COMPANY = 4000;

// ── Chunking ──────────────────────────────────────────────────────────────────
// Paragraph- then sentence-aware, so a chunk rarely cuts a sentence in half;
// consecutive chunks overlap so an answer straddling a boundary isn't lost.
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const pieces = clean
    .split(/\n\n+/)
    .flatMap((p) => (p.length <= CHUNK_CHARS ? [p] : p.match(/[^.!?\n]+[.!?]*\s*/g) ?? [p]));

  const chunks: string[] = [];
  let cur = "";
  for (const piece of pieces) {
    if (cur && cur.length + piece.length + 1 > CHUNK_CHARS) {
      chunks.push(cur.trim());
      cur = cur.slice(-CHUNK_OVERLAP) + " ";
    }
    // A single sentence longer than a chunk: hard-split it.
    if (piece.length > CHUNK_CHARS) {
      for (let i = 0; i < piece.length; i += CHUNK_CHARS - CHUNK_OVERLAP) chunks.push(piece.slice(i, i + CHUNK_CHARS).trim());
      cur = "";
      continue;
    }
    cur += (cur.endsWith(" ") || !cur ? "" : "\n") + piece;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter((c) => c.length > 20);
}

// ── Embeddings (Gemini REST — the JS SDK can't set outputDimensionality) ───────
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embedTexts(texts: string[], taskType: TaskType): Promise<number[][] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !texts.length) return null;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType,
            outputDimensionality: EMBED_DIMS,
          })),
        }),
      }
    );
    if (!res.ok) {
      console.error("[rag] embedding failed:", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { embeddings?: { values: number[] }[] };
    if (!data.embeddings || data.embeddings.length !== batch.length) return null;
    // Truncated (non-3072) Gemini embeddings aren't unit length; normalise once
    // here so search is a plain dot product.
    out.push(...data.embeddings.map((e) => normalise(e.values)));
  }
  return out;
}

function normalise(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => Math.round((x / n) * 1e6) / 1e6); // 6 dp keeps documents small
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

// ── Indexing ──────────────────────────────────────────────────────────────────
// (Re)builds a document's chunks + embeddings from its content. Without a
// Gemini key the chunks are still stored and search falls back to keywords.
export async function indexKnowledgeBase(kbId: string, content: string): Promise<number> {
  const chunks = chunkText(content);
  const vectors = await embedTexts(chunks, "RETRIEVAL_DOCUMENT").catch(() => null);
  await KnowledgeBase.findByIdAndUpdate(kbId, {
    chunks: chunks.map((c, i) => ({ content: c, ...(vectors ? { embedding: vectors[i] } : {}) })),
  });
  cache.clear();
  return chunks.length;
}

// ── Search ────────────────────────────────────────────────────────────────────
export interface RetrievedChunk {
  text: string;
  score: number;
  sourceName: string;
  sourceUrl?: string;
  kbId: string;
}

type CachedChunk = { text: string; embedding?: number[]; sourceName: string; sourceUrl?: string; kbId: string; terms: Set<string> };
const cache = new Map<string, { at: number; chunks: CachedChunk[] }>();
const CACHE_MS = 60_000;
const backfilling = new Set<string>();

const STOP = new Set("a an and are as at be by can do does for from has have how i in is it me my of on or our please the their there this to us was we what when where which who why will with you your".split(" "));
function terms(s: string): string[] {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

async function loadChunks(companyId: string, audience: "bot" | "agent", kbIds?: string[]): Promise<CachedChunk[]> {
  const key = `${companyId}|${audience}|${(kbIds ?? []).join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.chunks;

  await connectDB();
  const filter: Record<string, unknown> = {
    companyId,
    status: "READY",
    accessibleBy: { $in: audience === "bot" ? ["ALL", "BOT_ONLY"] : ["ALL", "AGENTS"] },
  };
  if (kbIds?.length) filter._id = { $in: kbIds };
  const docs = await KnowledgeBase.find(filter)
    .select("name sourceUrl content chunks")
    .lean<{ _id: unknown; name: string; sourceUrl?: string; content?: string; chunks?: { content: string; embedding?: number[] }[] }[]>();

  const chunks: CachedChunk[] = [];
  for (const d of docs) {
    const kbId = String(d._id);
    const stored = d.chunks?.length ? d.chunks : chunkText(d.content || "").map((c) => ({ content: c, embedding: undefined }));
    // Documents indexed before embeddings existed: embed them in the background.
    if (process.env.GEMINI_API_KEY && d.content && stored.some((c) => !c.embedding?.length) && !backfilling.has(kbId)) {
      backfilling.add(kbId);
      indexKnowledgeBase(kbId, d.content).catch(() => {}).finally(() => backfilling.delete(kbId));
    }
    for (const c of stored) {
      if (chunks.length >= MAX_CHUNKS_PER_COMPANY) break;
      chunks.push({ text: c.content, embedding: c.embedding?.length ? c.embedding : undefined, sourceName: d.name, sourceUrl: d.sourceUrl, kbId, terms: new Set(terms(c.content)) });
    }
  }
  cache.set(key, { at: Date.now(), chunks });
  return chunks;
}

// Top chunks for a question. Vector similarity when embeddings exist; keyword
// overlap otherwise (no Gemini key, or documents still being backfilled).
export async function retrieve(
  companyId: string,
  query: string,
  opts: { k?: number; audience?: "bot" | "agent"; kbIds?: string[] } = {}
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? 5;
  const chunks = await loadChunks(companyId, opts.audience ?? "bot", opts.kbIds);
  if (!chunks.length) return [];

  const qv = chunks.some((c) => c.embedding) ? (await embedTexts([query], "RETRIEVAL_QUERY").catch(() => null))?.[0] : undefined;
  const qTerms = terms(query);

  const scored = chunks.map((c) => {
    if (qv && c.embedding) return { c, score: dot(qv, c.embedding) };
    // Keyword fallback, scaled to roughly the same 0..1 range.
    const hits = qTerms.filter((t) => c.terms.has(t)).length;
    return { c, score: qTerms.length ? (hits / qTerms.length) * 0.8 : 0 };
  });

  // Below this the chunk is about something else; better to say "I don't know".
  const MIN = qv ? Number(process.env.RAG_MIN_SCORE || 0.5) : 0.34;
  return scored
    .filter((s) => s.score >= MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ c, score }) => ({ text: c.text, score: Math.round(score * 1000) / 1000, sourceName: c.sourceName, sourceUrl: c.sourceUrl, kbId: c.kbId }));
}

// Context block for the prompt, with numbered sources the model can cite.
export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks.map((c, i) => `[${i + 1}] (from "${c.sourceName}")\n${c.text}`).join("\n\n---\n\n");
}

export function invalidateKnowledgeCache() {
  cache.clear();
}
