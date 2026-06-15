import { NextRequest, NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api-helpers";

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

  // For PDF/DOCX — we need Firebase Storage; inform the caller
  if (["pdf", "docx", "doc"].includes(ext)) {
    return NextResponse.json({
      success: false,
      requiresFirebase: true,
      error: "PDF/DOCX upload requires Firebase Storage. Configure NEXT_PUBLIC_FIREBASE_* variables or paste the content manually.",
    });
  }

  return apiError("Unsupported file type. Use TXT, CSV, PDF or DOCX.", 400);
}
