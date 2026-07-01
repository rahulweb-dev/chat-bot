import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import Company from "../models/Company";
import bcrypt from "bcryptjs";

async function check() {
  await connectDB();

  const company = await Company.findOne({ slug: "demo-company" });
  console.log("\n── Demo Company ───────────────────────────────");
  if (!company) {
    console.log("❌  NOT FOUND — run: npm run seed");
    process.exit(0);
  }
  console.log("✅  Found:", company.name, "(id:", company._id.toString() + ")");

  const users = await User.find({ companyId: company._id }).select("+password");
  console.log("\n── Users in demo company ──────────────────────");
  if (!users.length) {
    console.log("❌  No users found for this company!");
  }

  for (const u of users) {
    const hasHash = u.password?.startsWith("$2b$") || u.password?.startsWith("$2a$");
    const pwOk = u.password ? await bcrypt.compare("Demo@123456", u.password) : false;
    const pwOk2 = u.password ? await bcrypt.compare("Agent@123456", u.password) : false;
    console.log(`\n  ${u.name} <${u.email}>`);
    console.log(`  role:     ${u.role}`);
    console.log(`  isActive: ${u.isActive}`);
    console.log(`  password: ${u.password ? (hasHash ? "✅ hashed" : "❌ PLAINTEXT — login will fail!") : "❌ MISSING"}`);
    console.log(`  Demo@123456  matches: ${pwOk ? "✅" : "❌"}`);
    console.log(`  Agent@123456 matches: ${pwOk2 ? "✅" : "❌"}`);
  }

  console.log("\n── Fix ────────────────────────────────────────");
  console.log("Run this to reset demo passwords:");
  console.log("  npx ts-node src/scripts/fix-demo.ts\n");
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
