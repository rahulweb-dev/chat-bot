import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate, incrementUsage } from "@/lib/api-helpers";
import KnowledgeBase from "@/models/KnowledgeBase";
import { safeFetch } from "@/lib/safe-fetch";
import { crawlSite, extractFileText } from "@/lib/kb-ingest";
import { indexKnowledgeBase } from "@/lib/rag";

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
  const { crawl, ...body } = await request.json();

  const kb = await KnowledgeBase.create({
    ...body,
    companyId: ctx.companyId,
    createdBy: ctx.userId,
    status: "PENDING",
  });

  await incrementUsage(ctx.companyId, "knowledgeFiles");

  if (kb.fileUrl || kb.sourceUrl || kb.content) {
    processKnowledgeBase(kb._id.toString(), { crawl: !!crawl }).catch(console.error);
  }

  return apiSuccess(kb, "Knowledge base document created", 201);
}

// Turns a new document into searchable chunks: fetches a website (optionally
// the whole site), reads an uploaded PDF/DOCX/TXT, or uses pasted text, then
// chunks + embeds it (src/lib/rag.ts) for AI answers.
async function processKnowledgeBase(kbId: string, opts: { crawl?: boolean } = {}) {
  const { connectDB: db } = await import("@/lib/mongodb");
  await db();

  const kb = await KnowledgeBase.findById(kbId);
  if (!kb) return;

  try {
    await KnowledgeBase.findByIdAndUpdate(kbId, { status: "PROCESSING" });

    let content = kb.content || "";
    let description = kb.description;

    if (kb.type === "URL" && kb.sourceUrl) {
      const site = await crawlSite(kb.sourceUrl, opts.crawl ? 25 : 1);
      content = site.content;
      if (opts.crawl && !description) description = `${site.pages.length} page${site.pages.length === 1 ? "" : "s"} read from this site`;
    }

    // Files stored elsewhere (older uploads): download and read them here.
    if (!content && kb.fileUrl) {
      const r = await safeFetch(kb.fileUrl, { timeoutMs: 20000 });
      const buf = Buffer.from(await r.arrayBuffer());
      const ext = (kb.fileName || kb.fileUrl).split("?")[0].split(".").pop() || kb.type.toLowerCase();
      content = await extractFileText(buf, ext);
    }

    if (!content.trim()) {
      throw new Error(
        kb.type === "PDF"
          ? "No text found in this PDF. It may be a scanned image; paste the text with 'Write Manually' instead."
          : "No readable text found."
      );
    }

    const chunkCount = await indexKnowledgeBase(kbId, content);
    await KnowledgeBase.findByIdAndUpdate(kbId, {
      status: "READY",
      content,
      description,
      processedAt: new Date(),
      $unset: { errorMessage: 1 },
    });
    console.log(`[knowledge-base] ${kbId} ready: ${content.length} chars, ${chunkCount} chunks`);
  } catch (error) {
    await KnowledgeBase.findByIdAndUpdate(kbId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : "Processing failed",
    });
  }
}
