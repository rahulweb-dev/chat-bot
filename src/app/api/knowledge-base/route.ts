import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate, incrementUsage } from "@/lib/api-helpers";
import KnowledgeBase from "@/models/KnowledgeBase";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const query: Record<string, unknown> = { companyId: ctx.companyId };
  if (status) query.status = status;
  if (type) query.type = type;

  const { skip } = paginate(page, limit);
  const [items, total] = await Promise.all([
    KnowledgeBase.find(query)
      .populate("createdBy", "name email")
      .select("-chunks -content")
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    KnowledgeBase.countDocuments(query),
  ]);

  return paginatedResponse(items, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();

  const kb = await KnowledgeBase.create({
    ...body,
    companyId: ctx.companyId,
    createdBy: ctx.userId,
    status: "PENDING",
  });

  await incrementUsage(ctx.companyId, "knowledgeFiles");

  if (kb.fileUrl || kb.sourceUrl || kb.content) {
    processKnowledgeBase(kb._id.toString()).catch(console.error);
  }

  return apiSuccess(kb, "Knowledge base document created", 201);
}

async function processKnowledgeBase(kbId: string) {
  const { connectDB: db } = await import("@/lib/mongodb");
  await db();

  const kb = await KnowledgeBase.findById(kbId);
  if (!kb) return;

  try {
    await KnowledgeBase.findByIdAndUpdate(kbId, { status: "PROCESSING" });

    let content = kb.content || "";

    if (kb.type === "URL" && kb.sourceUrl) {
      const response = await fetch(kb.sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SupportFlowBot/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      const html = await response.text();
      // Strip scripts/styles first, then all tags
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100000); // cap at 100k chars
    }

    // For TXT files hosted on Firebase — fetch and read content
    if (["TXT", "CSV"].includes(kb.type) && kb.fileUrl && !content) {
      try {
        const r = await fetch(kb.fileUrl, { signal: AbortSignal.timeout(10000) });
        content = await r.text();
      } catch {}
    }

    if (!content && kb.fileUrl) {
      // File uploaded but content not extractable (e.g. PDF without parser)
      // Mark as READY with placeholder so it's usable
      content = `[Uploaded document: ${kb.name}. File URL: ${kb.fileUrl}]`;
    }

    const chunks = chunkText(content, 500);
    await KnowledgeBase.findByIdAndUpdate(kbId, {
      status: "READY",
      content,
      chunks: chunks.map((c) => ({ content: c })),
      processedAt: new Date(),
    });
  } catch (error) {
    await KnowledgeBase.findByIdAndUpdate(kbId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Processing failed",
    });
  }
}

function chunkText(text: string, chunkSize: number): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}
