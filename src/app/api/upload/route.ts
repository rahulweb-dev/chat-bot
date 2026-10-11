import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api-helpers";
import { extractFileText } from "@/lib/kb-ingest";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return apiError("No file provided", 400);
  if (file.size > MAX_SIZE) return apiError("File too large (max 10 MB)", 400);

  const name = file.name;
  const ext  = name.split(".").pop()?.toLowerCase() || "";

  // For text-based files: read content directly — no Firebase needed
  if (["txt", "csv", "md"].includes(ext)) {
    const content = await file.text();
    return NextResponse.json({
      success: true,
      data: {
        name,
        size: file.size,
        type: file.type,
        content,          // caller should create a MANUAL KB entry with this
        url: null,
        method: "text",
      },
    });
  }

  // PDF / DOCX: read the text here, so the knowledge base gets real content
  // instead of a placeholder (and no file storage is needed).
  if (["pdf", "docx"].includes(ext)) {
    try {
      const content = await extractFileText(Buffer.from(await file.arrayBuffer()), ext);
      if (!content) {
        return apiError(
          ext === "pdf"
            ? "No text found in this PDF. It may be a scanned image; paste the text with 'Write Manually' instead."
            : "No text found in this document.",
          422
        );
      }
      return NextResponse.json({
        success: true,
        data: { name, size: file.size, type: file.type, content, url: null, method: "extracted" },
      });
    } catch (e) {
      console.error("[upload] extract failed:", e instanceof Error ? e.message : e);
      return apiError("Couldn't read this file. If it's password-protected or damaged, paste the text with 'Write Manually'.", 422);
    }
  }
  if (ext === "doc") return apiError("Old .doc files aren't supported. Save it as .docx or PDF and upload again.", 400);

  return apiError("Unsupported file type. Use TXT, CSV, PDF or DOCX.", 400);
}
