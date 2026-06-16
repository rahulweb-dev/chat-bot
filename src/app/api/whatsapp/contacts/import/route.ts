import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";

interface ParsedRow {
  Name?: string;
  name?: string;
  Phone?: string | number;
  phone?: string | number;
  City?: string;
  city?: string;
  Tags?: string;
  tags?: string;
}

interface RowResult {
  row: number;
  name?: string;
  phone: string;
  city?: string;
  tags: string[];
  status: "VALID" | "INVALID";
  reason?: string;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidPhone(digits: string): boolean {
  return digits.length >= 8 && digits.length <= 15;
}

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
    const rawPhone = String(r.Phone ?? r.phone ?? "").trim();
    const name = String(r.Name ?? r.name ?? "").trim() || undefined;
    const city = String(r.City ?? r.city ?? "").trim() || undefined;
    const tagsRaw = String(r.Tags ?? r.tags ?? "").trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const phone = normalizePhone(rawPhone);

    if (!rawPhone) {
      results.push({ row: i + 2, phone: rawPhone, city, tags, status: "INVALID", reason: "Missing phone number" });
      continue;
    }
    if (!isValidPhone(phone)) {
      results.push({ row: i + 2, name, phone: rawPhone, city, tags, status: "INVALID", reason: "Invalid phone number format" });
      continue;
    }

    const existing = await WhatsAppContact.findOne({ companyId: ctx.companyId, phone });
    if (existing) {
      existing.name = name || existing.name;
      existing.city = city || existing.city;
      if (tags.length) existing.tags = Array.from(new Set([...existing.tags, ...tags]));
      await existing.save();
      validContactIds.push(String(existing._id));
      updatedCount++;
    } else {
      const created = await WhatsAppContact.create({
        companyId: ctx.companyId,
        name,
        phone,
        city,
        tags,
        optIn: true, // bulk-imported campaign audiences are treated as opted-in by the uploader
        optInAt: new Date(),
      });
      validContactIds.push(String(created._id));
      createdCount++;
    }

    results.push({ row: i + 2, name, phone, city, tags, status: "VALID" });
  }

  if (campaignId && validContactIds.length > 0) {
    await WhatsAppCampaign.findOneAndUpdate(
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
