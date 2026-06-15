import { NextRequest } from "next/server";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return apiError("url required", 400);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SupportFlowBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return apiError("Could not fetch page", 400);

    const html = await res.text();

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 120) : "";

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim().slice(0, 300) : "";

    return apiSuccess({ title, description });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Fetch failed", 400);
  }
}
