import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import EmailContact from "@/models/EmailContact";
import EmailCampaign from "@/models/EmailCampaign";

interface ParsedRow {
  Name?: string;
  name?: string;
  Email?: string;
  email?: string;
  Tags?: string;
  tags?: string;
}

interface RowResult {
  row: number;
  name?: string;
  email: string;
  tags: string[];
  status: "VALID" | "INVALID";
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_ROWS = 5000;

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const campaignId = formData.get("campaignId") as string | null;
  if (!file) return apiError("No file uploaded");

  await connectDB();

  let rows: ParsedRow[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet);
  } catch {
    return apiError("Could not parse file — please upload a valid CSV or Excel file");
  }

  if (rows.length === 0) return apiError("File has no rows");
  if (rows.length > MAX_ROWS) return apiError(`File has too many rows (max ${MAX_ROWS})`);

  const results: RowResult[] = [];
  const validContactIds: string[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rawEmail = String(r.Email ?? r.email ?? "").trim().toLowerCase();
    const name = String(r.Name ?? r.name ?? "").trim() || undefined;
    const tagsRaw = String(r.Tags ?? r.tags ?? "").trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    if (!rawEmail) {
      results.push({ row: i + 2, email: rawEmail, tags, status: "INVALID", reason: "Missing email address" });
      continue;
    }
    if (!EMAIL_RE.test(rawEmail)) {
      results.push({ row: i + 2, name, email: rawEmail, tags, status: "INVALID", reason: "Invalid email format" });
      continue;
    }

    const existing = await EmailContact.findOne({ companyId: ctx.companyId, email: rawEmail });
    if (existing) {
      existing.name = name || existing.name;
      if (tags.length) existing.tags = Array.from(new Set([...existing.tags, ...tags]));
      await existing.save();
      validContactIds.push(String(existing._id));
      updatedCount++;
    } else {
      const created = await EmailContact.create({
        companyId: ctx.companyId,
        name,
        email: rawEmail,
        tags,
        optIn: true, // bulk-imported campaign audiences are treated as opted-in by the uploader
        optInAt: new Date(),
      });
      validContactIds.push(String(created._id));
      createdCount++;
    }

    results.push({ row: i + 2, name, email: rawEmail, tags, status: "VALID" });
  }

  if (campaignId && validContactIds.length > 0) {
    await EmailCampaign.findOneAndUpdate(
      { _id: campaignId, companyId: ctx.companyId },
      { $addToSet: { audienceContactIds: { $each: validContactIds } } }
    );
  }

  const validCount = results.filter((r) => r.status === "VALID").length;
  const invalidCount = results.length - validCount;

  return apiSuccess({
    total: results.length,
    validCount,
    invalidCount,
    createdCount,
    updatedCount,
    rows: results,
  });
}
