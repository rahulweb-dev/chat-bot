import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import ChatbotConfig from "@/models/ChatbotConfig";

const DEFAULT_HOURS = [
  { day: "Monday",    open: "09:00", close: "18:00", isClosed: false },
  { day: "Tuesday",   open: "09:00", close: "18:00", isClosed: false },
  { day: "Wednesday", open: "09:00", close: "18:00", isClosed: false },
  { day: "Thursday",  open: "09:00", close: "18:00", isClosed: false },
  { day: "Friday",    open: "09:00", close: "18:00", isClosed: false },
  { day: "Saturday",  open: "09:00", close: "14:00", isClosed: false },
  { day: "Sunday",    open: "09:00", close: "14:00", isClosed: true  },
];

const DEFAULT_VEHICLES = [
  { name: "Dost+",      category: "LCV", payload: "1.5T", priceRange: "₹7-9L",   description: "Best-in-class mileage, 22 kmpl, ideal for last-mile delivery", isActive: true },
  { name: "Bada Dost",  category: "LCV", payload: "2T",   priceRange: "₹9-11L",  description: "Heavy payload LCV for cargo and logistics", isActive: true },
  { name: "Partner",    category: "LCV", payload: "1T",   priceRange: "₹6-7.5L", description: "Urban e-commerce delivery vehicle", isActive: true },
  { name: "Ecomet 912", category: "ICV", payload: "7.5T", priceRange: "₹16-20L", description: "Fuel-efficient intermediate CV, 16 kmpl", isActive: true },
  { name: "AVTR 4940",  category: "HCV", payload: "40T",  priceRange: "₹45-55L", description: "400 HP flagship heavy duty truck", isActive: true },
  { name: "Boss 1623",  category: "HCV", payload: "16T",  priceRange: "₹20-26L", description: "Reliable 230 HP heavy duty truck", isActive: true },
  { name: "Circuit S",  category: "Bus", payload: "72 seats", priceRange: "₹25-35L", description: "City bus, BS6 compliant", isActive: true },
  { name: "Oyster",     category: "Bus", payload: "40 seats", priceRange: "₹18-24L", description: "Staff / school bus", isActive: true },
  { name: "Boss EV",    category: "EV",  payload: "18T",  priceRange: "₹30-40L", description: "Electric truck, 150 km range", isActive: true },
];

const DEFAULT_OFFERS = [
  { title: "Fleet Discount", description: "Up to ₹1.5L off on fleet purchase of 5+ vehicles", validUntil: "31 Dec 2025", isActive: true },
  { title: "0% EMI Scheme",  description: "No-cost EMI for 12 months on select models", validUntil: "31 Mar 2025", isActive: true },
  { title: "Exchange Bonus", description: "Extra ₹50,000 on exchange of old commercial vehicle", isActive: true },
  { title: "Free AMC",       description: "1-year free AMC on new vehicle purchase above ₹20L", isActive: true },
];

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();

  let config = await ChatbotConfig.findOne({ companyId: ctx.companyId });
  if (!config) {
    config = await ChatbotConfig.create({
      companyId: ctx.companyId,
      businessHours: DEFAULT_HOURS,
      vehicles: DEFAULT_VEHICLES,
      offers: DEFAULT_OFFERS,
      faqs: [],
    });
  }

  return apiSuccess(config);
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();

  const config = await ChatbotConfig.findOneAndUpdate(
    { companyId: ctx.companyId },
    { $set: body },
    { new: true, upsert: true }
  );

  return apiSuccess(config, "Settings saved");
}
