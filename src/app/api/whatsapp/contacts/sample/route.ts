import { NextResponse } from "next/server";

const SAMPLE_CSV = [
  "Name,Phone,City,Tags",
  'Aarav Sharma,919876543210,Mumbai,"vip,new-launch"',
  "Priya Patel,919876543211,Delhi,returning-customer",
  "Rohan Mehta,919876543212,Bengaluru,vip",
].join("\n");

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=whatsapp-contacts-sample.csv",
    },
  });
}
