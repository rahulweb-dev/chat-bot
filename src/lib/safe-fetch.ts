import dns from "node:dns/promises";
import net from "node:net";

// Blocks Server-Side Request Forgery (SSRF): fetching a URL that a user
// supplied (knowledge-base website import, title scraping, etc.) without
// restricting what it can point to lets an attacker make this server issue
// requests to internal-only targets — cloud metadata endpoints
// (169.254.169.254), localhost, or the private network — and read the
// response back through whatever the feature reflects (a scraped title, the
// stored knowledge-base content, etc.).
//
// A check on the literal hostname string alone is not enough: DNS rebinding
// means a hostname that resolves to a public IP at check-time can resolve to
// a private one at connect-time. So this resolves the hostname itself and
// validates every resolved address, and it validates again after following
// each redirect hop (a public URL can 3xx to an internal one).

const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local / cloud metadata
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateV4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" || // loopback
    lower === "::" ||
    lower.startsWith("fe80:") || // link-local
    lower.startsWith("fc") || lower.startsWith("fd") || // unique local, fc00::/7
    lower.startsWith("::ffff:") && isPrivateV4(lower.slice("::ffff:".length)) // IPv4-mapped
  );
}

function isPrivateIP(ip: string): boolean {
  return net.isIP(ip) === 6 ? isPrivateV6(ip) : isPrivateV4(ip);
}

export class UnsafeUrlError extends Error {}

// Throws UnsafeUrlError if the URL's scheme isn't http(s), or every/any
// resolved address for its hostname is private/internal. Returns nothing —
// call this right before each fetch/redirect-follow, not once up front.
async function assertSafeUrl(urlStr: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported URL scheme: ${url.protocol}`);
  }

  const hostname = url.hostname;
  // A literal IP in the URL — validate directly, no DNS involved.
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new UnsafeUrlError("URL resolves to a private/internal address");
    return;
  }
  if (hostname.toLowerCase() === "localhost") {
    throw new UnsafeUrlError("URL resolves to a private/internal address");
  }

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve host");
  }
  if (!addresses.length || addresses.some((a) => isPrivateIP(a.address))) {
    throw new UnsafeUrlError("URL resolves to a private/internal address");
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
}

// A fetch() replacement for untrusted, user-supplied URLs. Validates the URL
// (and, after each hop, the redirect target) before ever connecting.
export async function safeFetch(urlStr: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = urlStr;

  for (let hop = 0; ; hop++) {
    await assertSafeUrl(current);

    const res = await fetch(current, {
      headers: opts.headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      redirect: "manual",
    });

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    if (!isRedirect || !location) return res;

    if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects");
    current = new URL(location, current).toString();
  }
}
