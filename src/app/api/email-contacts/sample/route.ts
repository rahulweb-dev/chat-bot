import { NextResponse } from "next/server";

const SAMPLE_CSV = [
  "Name,Email,Tags",
  'Aarav Sharma,aarav@example.com,"vip,new-launch"',
  "Priya Patel,priya@example.com,returning-customer",
  "Rohan Mehta,rohan@example.com,vip",
].join("\n");

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=email-contacts-sample.csv",
    },
  });
}
