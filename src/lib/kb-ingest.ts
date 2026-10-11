import { safeFetch } from "@/lib/safe-fetch";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; Convo360Bot/1.0; +knowledge-base import)" };
const MAX_TOTAL_CHARS = 300_000;

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(ndash|mdash);/g, "–").replace(/&(rsquo|lsquo);/g, "'").replace(/&(ldquo|rdquo);/g, '"')
    .replace(/&hellip;/g, "…").replace(/&copy;/g, "©").replace(/&reg;/g, "®").replace(/&rupee;/g, "₹");
}

// Readable text from a page: drops scripts, styles, nav/header/footer chrome
// (menus repeated on every page would otherwise flood every chunk), and keeps
// block boundaries as newlines so chunking can split on paragraphs.
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
  const body = html
    .replace(/<head[^>]*>[\s\S]*?<\/head>/i, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return { title, text };
}

function sameSiteLinks(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
      if (!/^https?:$/.test(u.protocol)) continue;
      if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|docx?|xlsx?|css|js)$/i.test(u.pathname)) continue;
      if (/\/(wp-admin|login|signin|cart|checkout|account|tag|author|feed)\b/i.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      out.add(u.toString());
    } catch { /* bad href */ }
  }
  return [...out];
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(url, { headers: UA, timeoutMs: 12000 });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("html")) return null;
    return (await res.text()).slice(0, 2_000_000);
  } catch {
    return null;
  }
}

async function sitemapUrls(base: URL): Promise<string[]> {
  try {
    const res = await safeFetch(new URL("/sitemap.xml", base).toString(), { headers: UA, timeoutMs: 8000 });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => m[1])
      .filter((u) => { try { return new URL(u).hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "") && !u.endsWith(".xml"); } catch { return false; } });
  } catch {
    return [];
  }
}

// Reads a website: the start page, then other pages of the same site (from its
// sitemap, else from links on the start page), up to maxPages. Each page's
// text is prefixed with its title and address so answers can name the page.
export async function crawlSite(startUrl: string, maxPages = 25): Promise<{ content: string; pages: string[] }> {
  const start = new URL(startUrl);
  const firstHtml = await fetchHtml(start.toString());
  if (!firstHtml) throw new Error("Couldn't open that page. Check the address and that the site is public.");

  const queue = maxPages > 1
    ? [...new Set([...(await sitemapUrls(start)), ...sameSiteLinks(firstHtml, start)])].filter((u) => u !== start.toString())
    : [];

  const parts: string[] = [];
  const pages: string[] = [];
  let total = 0;
  const add = (url: string, html: string) => {
    const { title, text } = htmlToText(html);
    if (text.length < 80) return;
    const block = `# ${title || url}\n(${url})\n\n${text}`;
    parts.push(block.slice(0, MAX_TOTAL_CHARS - total));
    total += block.length;
    pages.push(url);
  };

  add(start.toString(), firstHtml);
  for (let i = 0; i < queue.length && pages.length < maxPages && total < MAX_TOTAL_CHARS; i += 4) {
    // 4 at a time: quick, without hammering the customer's server.
    const batch = queue.slice(i, i + 4);
    const htmls = await Promise.all(batch.map(fetchHtml));
    batch.forEach((u, j) => { if (htmls[j] && pages.length < maxPages && total < MAX_TOTAL_CHARS) add(u, htmls[j]!); });
  }
  return { content: parts.join("\n\n"), pages };
}

// Plain text from an uploaded file. PDFs need real text (scanned image-only
// PDFs come back empty and are reported as such by the caller).
export async function extractFileText(buffer: Buffer, ext: string): Promise<string> {
  const e = ext.toLowerCase();
  if (e === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      return (await parser.getText()).text.replace(/\n{3,}/g, "\n\n").trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  if (e === "docx") {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer })).value.trim();
  }
  return buffer.toString("utf8").trim();
}
