// This app's public address (e.g. https://app.example.com), for webhook URLs,
// install snippets and links in emails.
//
// Uses the configured value when there is one (NEXT_PUBLIC_APP_URL, else
// AUTH_URL / NEXTAUTH_URL). Without it, falls back to the address the request
// actually came in on, so a missing env var can't produce "undefined/api/...".
// Behind a proxy / load balancer, the forwarded host and protocol are used.
export function appUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured && configured !== "undefined") return configured.replace(/\/+$/, "");
  if (!request) return "";
  const h = request.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0].trim() || h.get("host");
  if (!host) return new URL(request.url).origin;
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
