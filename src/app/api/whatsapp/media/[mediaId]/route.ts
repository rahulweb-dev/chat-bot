import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext } from "@/lib/api-helpers";
import { decrypt } from "@/lib/crypto";
import { fetchMedia } from "@/lib/whatsapp";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";

export async function GET(request: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return new NextResponse("Unauthorized", { status: 401 });

  await connectDB();
  const integration = await WhatsAppIntegration.findOne({ companyId: ctx.companyId });
  if (!integration) return new NextResponse("WhatsApp not connected", { status: 404 });

  const accessToken = decrypt(integration.encryptedAccessToken);
  const result = await fetchMedia(mediaId, accessToken);
  if (!result.ok || !result.data) return new NextResponse(result.error || "Failed to load media", { status: 502 });

  return new NextResponse(new Uint8Array(result.data), {
    headers: {
      "Content-Type": result.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
