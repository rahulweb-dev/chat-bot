import { NextResponse } from "next/server";

const SAMPLE_CSV = [
  "Name,Phone,Tags",
  'Aarav Sharma,919876543210,"vip,new-launch"',
  "Priya Patel,919876543211,returning-customer",
  "Rohan Mehta,919876543212,vip",
].join("\n");

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=rcs-contacts-sample.csv",
    },
  });
}
