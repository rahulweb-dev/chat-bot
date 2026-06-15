export interface SessionData {
  flow: string;
  step: string;
  collected: Record<string, string>;
}

export interface BotResponse {
  messages: string[];
  quickReplies: string[];
  sessionData: SessionData;
  action: "NONE" | "CREATE_LEAD" | "CREATE_TICKET" | "ASSIGN_AGENT";
  leadData?: Record<string, string>;
  ticketData?: Record<string, string>;
}

export const MAIN_MENU = [
  "🚛 Find a Vehicle",
  "💰 Get On-Road Price",
  "📄 Download Brochure",
  "🚗 Book Test Drive",
  "🛠️ Service & Support",
  "🔧 Spare Parts",
  "💳 Finance & EMI",
  "📍 Find Dealer",
  "📞 Request Callback",
  "💬 Chat with Agent",
];

const VEHICLE_TYPES = [
  "🚛 Light Commercial Vehicle",
  "🚚 Intermediate Commercial Vehicle",
  "🚜 Heavy Duty Truck",
  "🚌 Bus",
  "⚡ Electric Vehicle",
];

const AL_VEHICLES = [
  "Dost+", "Bada Dost", "Partner",
  "Ecomet 912", "Guru", "Captain",
  "AVTR 4940", "Boss", "Stallion",
  "Circuit S", "Oyster", "Viking",
];

const PURPOSES = [
  "Logistics", "Cargo Delivery", "Construction",
  "Agriculture", "Passenger Transport", "School Transport", "E-commerce",
];

const PAYLOADS = ["Under 2 Ton", "2-5 Ton", "5-10 Ton", "10-20 Ton", "Above 20 Ton"];
const FUELS    = ["Diesel", "CNG", "Electric", "Not Sure"];

const PART_CATEGORIES = [
  "🔩 Engine Parts", "🔋 Battery", "🛑 Brake System",
  "🔧 Suspension", "🌀 Filters", "📦 Others",
];

const SERVICE_OPTIONS = [
  "📅 Book Service", "📋 AMC Plans",
  "🚨 Breakdown Assistance", "📊 Service Status",
];

const AGENT_CATEGORIES = [
  "🚛 New Purchase", "💰 Pricing", "💳 Finance",
  "🏭 Fleet Purchase", "🛠️ Service", "🔧 Spare Parts", "💬 Other Queries",
];

const CITIES = ["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad", "Pune", "Ahmedabad", "Kolkata", "Other"];
const DATES   = ["Today", "Tomorrow", "This Saturday", "This Sunday"];
const TIMES   = ["9 AM – 11 AM", "11 AM – 1 PM", "2 PM – 4 PM", "4 PM – 6 PM"];
const TENURES = ["12 Months", "24 Months", "36 Months", "48 Months", "60 Months"];

function match(input: string, keyword: string): boolean {
  return input.toLowerCase().includes(keyword.toLowerCase());
}

function isPhone(s: string): boolean {
  return /^[\+]?[\d\s\-]{9,14}$/.test(s.replace(/[\s\-]/g, ""));
}

function ask(flow: string, step: string, col: Record<string, string>, msg: string, opts: string[]): BotResponse {
  return {
    messages: [msg],
    quickReplies: opts.length ? [...opts, "🔙 Main Menu"] : ["🔙 Main Menu"],
    sessionData: { flow, step, collected: col },
    action: "NONE",
  };
}

function reset(col: Record<string, string>): SessionData {
  return { flow: "INITIAL", step: "", collected: col };
}

function mainMenu(): BotResponse {
  return {
    messages: ["👋 Welcome to Ashok Leyland!\n\nHow can we help you today? Please select an option:"],
    quickReplies: MAIN_MENU,
    sessionData: { flow: "INITIAL", step: "", collected: {} },
    action: "NONE",
  };
}

function escalate(col: Record<string, string>, reason?: string): BotResponse {
  return {
    messages: [
      `💬 Connecting you to a Live Agent...\n\n${reason ? `📋 Query: ${reason}\n\n` : ""}🕘 Operating Hours: 9 AM – 6 PM (Mon–Sat)\n\nIf no agent is available right now, we'll arrange a callback shortly. ✅`,
    ],
    quickReplies: ["🔙 Main Menu"],
    sessionData: reset(col),
    action: "ASSIGN_AGENT",
  };
}

function vehicleRecommendation(type: string, purpose: string, payload: string, fuel: string): string {
  const t = type.toLowerCase();
  const p = payload.toLowerCase();
  const f = fuel.toLowerCase();
  const pur = purpose.toLowerCase();

  if (f.includes("electric") || t.includes("electric")) {
    return "⚡ Recommended Electric Vehicles:\n\n🥇 BOSS EV — 18T GVW, 150 km range\n🥈 Circuit S EV — Electric City Bus\n🥉 Dost EV — 1.5T LCV Electric\n\n✅ Zero emissions | Govt. subsidy eligible | Low running cost";
  }
  if (t.includes("bus")) {
    if (pur.includes("school")) return "🚌 Recommended School Buses:\n\n🥇 Oyster — 40 seats, ARAI certified\n🥈 Viking School — 54 seats, AC available\n\n✅ High safety | Child-friendly features";
    return "🚌 Recommended Buses:\n\n🥇 Circuit S — 72 seats, city bus\n🥈 Viking — 54 seats, intercity AC\n🥉 Oyster — 40 seats, staff bus\n\n✅ BS6 compliant | Fleet discounts available";
  }
  if (t.includes("light") || p.includes("under 2") || p.includes("2-5")) {
    if (f.includes("cng")) return "🚛 Recommended LCV (CNG):\n\n🥇 Dost+ CNG — 1.5T payload, 19.5 kmpl, ₹7.5-8.5L\n🥈 Partner CNG — 1T, city delivery, ₹6-7L\n\n✅ Lower fuel cost | CNG certified";
    return "🚛 Recommended Light Commercial Vehicles:\n\n🥇 Dost+ — 1.5T, 22 kmpl, ₹7-9L\n🥈 Bada Dost — 2T payload, ₹9-11L\n🥉 Partner — 1T, e-commerce delivery, ₹6-7.5L\n\n✅ Best-in-class mileage | Low maintenance";
  }
  if (t.includes("intermediate") || p.includes("5-10")) {
    return "🚚 Recommended Intermediate CVs:\n\n🥇 Ecomet 912 — 7.5T, 16 kmpl, ₹16-20L\n🥈 Guru — 6T multi-axle, ₹14-17L\n🥉 Captain — 9T long haul, ₹18-22L\n\n✅ High payload | Durable | Easy financing";
  }
  if (t.includes("heavy") || p.includes("10-20") || p.includes("above 20")) {
    return "🚜 Recommended Heavy Duty Trucks:\n\n🥇 AVTR 4940 — 40T GVW, 400 HP, ₹45-55L\n🥈 Boss 1623 — 16T, 230 HP, ₹20-26L\n🥉 Stallion — Multi-axle, heavy duty\n\n✅ High power | Long-haul optimized | Telematics ready";
  }
  return "🚛 Top Ashok Leyland Models:\n\n✅ Dost+ — Best LCV (₹7-9L)\n✅ Ecomet 912 — Best ICV (₹16-20L)\n✅ AVTR 4940 — Best HCV (₹45-55L)\n✅ Circuit S — Best Bus\n\nWould you like details on a specific model?";
}

function onRoadPrice(vehicle: string, variant: string, city: string): string {
  const prices: Record<string, string> = {
    "dost": "₹7.5L – ₹9.2L",
    "bada dost": "₹9.5L – ₹11.5L",
    "partner": "₹6.2L – ₹7.8L",
    "ecomet": "₹16L – ₹21L",
    "guru": "₹14L – ₹18L",
    "captain": "₹19L – ₹23L",
    "avtr": "₹45L – ₹58L",
    "boss": "₹20L – ₹27L",
    "stallion": "₹28L – ₹36L",
    "circuit": "₹25L – ₹36L",
    "oyster": "₹18L – ₹24L",
    "viking": "₹22L – ₹30L",
  };
  const key = Object.keys(prices).find(k => vehicle.toLowerCase().includes(k));
  const range = key ? prices[key] : "Contact dealer for pricing";
  return `💰 Estimated On-Road Price in ${city}:\n\n🚛 ${vehicle} (${variant})\n💵 Ex-Showroom: ${range}\n🏛️ Road Tax: ~8-10%\n🛡️ Insurance: ~₹15,000 – ₹40,000\n🔧 Handling: ~₹5,000\n\n📌 Final price varies by city & offers.\nContact our dealer for exact pricing.`;
}

function dealerInfo(city: string): string {
  const dealers: Record<string, string> = {
    mumbai:    "📍 AL Motors Mumbai\n📞 022-4501-2345\n🗺️ Andheri East, Mumbai",
    delhi:     "📍 AL Motors Delhi\n📞 011-4501-6789\n🗺️ Okhla Industrial Area, Delhi",
    chennai:   "📍 AL Motors Chennai\n📞 044-4501-3456\n🗺️ Ambattur, Chennai",
    bangalore: "📍 AL Motors Bangalore\n📞 080-4501-7890\n🗺️ Peenya Industrial Area, Bangalore",
    hyderabad: "📍 AL Motors Hyderabad\n📞 040-4501-5678\n🗺️ Patancheru, Hyderabad",
    pune:      "📍 AL Motors Pune\n📞 020-4501-4567\n🗺️ Bhosari MIDC, Pune",
    ahmedabad: "📍 AL Motors Ahmedabad\n📞 079-4501-8901\n🗺️ Vatva GIDC, Ahmedabad",
    kolkata:   "📍 AL Motors Kolkata\n📞 033-4501-2345\n🗺️ Ultadanga, Kolkata",
  };
  const found = dealers[city.toLowerCase()];
  return found ?? `📍 AL Dealer in ${city}\n📞 1800-425-1177 (Toll Free)\n🗺️ Contact us for your nearest dealer`;
}

function calcEMI(priceL: number, downL: number, months: number): string {
  const principal = (priceL - downL) * 100000;
  if (principal <= 0) return "Down payment exceeds vehicle price. Please re-enter.";
  const r = 9.5 / 12 / 100;
  const emi = Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
  return `💳 EMI Calculation:\n\n🚛 Vehicle Price: ₹${priceL}L\n💵 Down Payment: ₹${downL}L\n🏦 Loan Amount: ₹${(priceL - downL)}L\n📅 Tenure: ${months} months\n📊 Interest Rate: 9.5% p.a.\n\n✅ Monthly EMI: ₹${emi.toLocaleString("en-IN")}\n\n📌 Rate may vary by credit profile & financier.`;
}

export function processFlow(input: string, session: SessionData): BotResponse {
  const inp = input.trim();
  const s   = session;
  const col = { ...s.collected };

  if (match(inp, "Main Menu") || match(inp, "Start Over") || match(inp, "Go Back")) return mainMenu();

  // ── INITIAL ────────────────────────────────────────────────────────────────
  if (!s.flow || s.flow === "INITIAL" || !s.step) {
    if (inp === "__INIT__") return mainMenu();
    if (match(inp, "Find a Vehicle"))    return ask("FIND_VEHICLE",  "ask_type",         col, "What type of vehicle are you looking for?", VEHICLE_TYPES);
    if (match(inp, "On-Road Price"))     return ask("ON_ROAD_PRICE", "ask_vehicle",       col, "Which Ashok Leyland vehicle?", AL_VEHICLES);
    if (match(inp, "Download Brochure")) return ask("BROCHURE",      "ask_vehicle",       col, "Which vehicle brochure would you like?", AL_VEHICLES);
    if (match(inp, "Book Test Drive"))   return ask("TEST_DRIVE",    "ask_vehicle",       col, "Which vehicle for the test drive?", AL_VEHICLES);
    if (match(inp, "Service"))           return ask("SERVICE",       "ask_service_type",  col, "How can we help with service?", SERVICE_OPTIONS);
    if (match(inp, "Spare Parts"))       return ask("SPARE_PARTS",   "ask_vehicle",       col, "Which vehicle do you need parts for?", AL_VEHICLES);
    if (match(inp, "Finance"))           return ask("FINANCE_EMI",   "ask_vehicle",       col, "Which vehicle are you financing?", AL_VEHICLES);
    if (match(inp, "Find Dealer"))       return ask("FIND_DEALER",   "ask_city",          col, "📍 Which city are you in?", CITIES);
    if (match(inp, "Request Callback") || match(inp, "Callback")) return ask("CALLBACK", "ask_name", col, "Sure! May I have your name?", []);
    if (match(inp, "Chat with Agent"))   return ask("CHAT_AGENT",    "ask_category",      col, "How can our agent help you?", AGENT_CATEGORIES);
    return mainMenu();
  }

  // ── FIND VEHICLE ───────────────────────────────────────────────────────────
  if (s.flow === "FIND_VEHICLE") {
    if (s.step === "ask_type")    { col.vehicleType = inp; return ask("FIND_VEHICLE", "ask_purpose", col, "What is the usage purpose?", PURPOSES); }
    if (s.step === "ask_purpose") { col.purpose = inp;    return ask("FIND_VEHICLE", "ask_payload", col, "What payload capacity do you need?", PAYLOADS); }
    if (s.step === "ask_payload") { col.payload = inp;    return ask("FIND_VEHICLE", "ask_fuel",    col, "Preferred fuel type?", FUELS); }
    if (s.step === "ask_fuel") {
      col.fuel = inp;
      return {
        messages: [vehicleRecommendation(col.vehicleType, col.purpose, col.payload, col.fuel)],
        quickReplies: ["📄 Download Brochure", "💰 Get Quote", "🚗 Book Test Drive", "💳 Finance Options", "💬 Chat with Agent", "🔙 Main Menu"],
        sessionData: { flow: "FIND_VEHICLE", step: "after_rec", collected: col },
        action: "NONE",
      };
    }
    if (s.step === "after_rec") {
      if (match(inp, "Download Brochure")) return ask("BROCHURE", "ask_name", col, "Please share your name for the brochure:", []);
      if (match(inp, "Get Quote"))         return ask("ON_ROAD_PRICE", "ask_variant", col, "Which variant? (Base / Standard / Plus / Premium)", ["Base", "Standard", "Plus", "Premium"]);
      if (match(inp, "Book Test Drive"))   return ask("TEST_DRIVE", "ask_dealer", col, "Select your preferred dealer city:", CITIES);
      if (match(inp, "Finance"))           return ask("FINANCE_EMI", "ask_price", col, "What is the vehicle price? (in Lakhs, e.g. 9 for ₹9L)", []);
      if (match(inp, "Chat with Agent"))   return escalate(col, `Vehicle inquiry: ${col.vehicleType}`);
    }
  }

  // ── ON-ROAD PRICE ──────────────────────────────────────────────────────────
  if (s.flow === "ON_ROAD_PRICE") {
    if (s.step === "ask_vehicle") { col.vehicle = inp; return ask("ON_ROAD_PRICE", "ask_variant", col, `Which variant of ${inp}?`, ["Base", "Standard", "Plus", "Premium", "Not Sure"]); }
    if (s.step === "ask_variant") { col.variant = inp; return ask("ON_ROAD_PRICE", "ask_city",    col, "Which city? (for accurate pricing)", CITIES); }
    if (s.step === "ask_city") {
      col.city = inp;
      return {
        messages: [onRoadPrice(col.vehicle, col.variant, col.city)],
        quickReplies: ["📄 Download Brochure", "🚗 Book Test Drive", "💬 Chat with Agent", "🔙 Main Menu"],
        sessionData: { flow: "ON_ROAD_PRICE", step: "after_price", collected: col },
        action: "NONE",
      };
    }
    if (s.step === "after_price") {
      if (match(inp, "Download Brochure")) return ask("BROCHURE", "ask_name", col, "Please share your name:", []);
      if (match(inp, "Book Test Drive"))   return ask("TEST_DRIVE", "ask_dealer", col, "Select preferred dealer city:", CITIES);
      if (match(inp, "Chat with Agent"))   return escalate(col, `Pricing: ${col.vehicle}`);
    }
  }

  // ── DOWNLOAD BROCHURE ──────────────────────────────────────────────────────
  if (s.flow === "BROCHURE") {
    if (s.step === "ask_vehicle") { col.vehicle = inp; return ask("BROCHURE", "ask_name",  col, "Your name:", []); }
    if (s.step === "ask_name")    { col.name = inp;    return ask("BROCHURE", "ask_phone", col, "Your mobile number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("BROCHURE", "ask_phone", col, "⚠️ Please enter a valid 10-digit mobile number:", []);
      col.phone = inp;  return ask("BROCHURE", "ask_email", col, "Your email address:", []);
    }
    if (s.step === "ask_email") { col.email = inp; return ask("BROCHURE", "ask_city", col, "Your city:", CITIES); }
    if (s.step === "ask_city") {
      col.city = inp;
      return {
        messages: [`📄 Brochure Sent!\n\n👤 ${col.name}\n📞 ${col.phone}\n✉️ ${col.email}\n🚛 ${col.vehicle || "Ashok Leyland"}\n\n✅ Brochure sent to ${col.email}.\nOur team will reach out shortly. 🙏`],
        quickReplies: ["🚗 Book Test Drive", "💰 Get Quote", "💬 Chat with Agent", "🔙 Main Menu"],
        sessionData: reset(col),
        action: "CREATE_LEAD",
        leadData: { ...col, type: "BROCHURE_REQUEST", score: "60" },
      };
    }
  }

  // ── BOOK TEST DRIVE ────────────────────────────────────────────────────────
  if (s.flow === "TEST_DRIVE") {
    if (s.step === "ask_vehicle") { col.vehicle = inp; return ask("TEST_DRIVE", "ask_dealer", col, "Select your preferred dealer city:", CITIES); }
    if (s.step === "ask_dealer")  { col.dealerCity = inp; return ask("TEST_DRIVE", "ask_date", col, "Preferred date?", DATES); }
    if (s.step === "ask_date")    { col.date = inp;       return ask("TEST_DRIVE", "ask_time", col, "Preferred time slot?", TIMES); }
    if (s.step === "ask_time")    { col.time = inp;       return ask("TEST_DRIVE", "ask_name", col, "Your name:", []); }
    if (s.step === "ask_name")    { col.name = inp;       return ask("TEST_DRIVE", "ask_phone", col, "Your mobile number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("TEST_DRIVE", "ask_phone", col, "⚠️ Please enter a valid 10-digit mobile number:", []);
      col.phone = inp;  return ask("TEST_DRIVE", "ask_email", col, "Your email address:", []);
    }
    if (s.step === "ask_email") {
      col.email = inp;
      return {
        messages: [`🎉 Test Drive Booked!\n\n👤 ${col.name}\n📞 ${col.phone}\n✉️ ${col.email}\n🚛 ${col.vehicle}\n📍 ${col.dealerCity}\n📅 ${col.date} | ⏰ ${col.time}\n\n✅ Our team will confirm your slot within 2 hours. See you soon! 🚛`],
        quickReplies: ["💰 Get Quote", "💳 Finance Options", "🔙 Main Menu"],
        sessionData: reset(col),
        action: "CREATE_LEAD",
        leadData: { ...col, type: "TEST_DRIVE", score: "85" },
      };
    }
  }

  // ── SERVICE & SUPPORT ──────────────────────────────────────────────────────
  if (s.flow === "SERVICE") {
    if (s.step === "ask_service_type") {
      col.serviceType = inp;
      if (match(inp, "Breakdown")) {
        return {
          messages: ["🚨 Breakdown Assistance:\n\n📞 AL Helpline: 1800-425-1177 (24/7 Toll Free)\n\nPlease share your location and vehicle number with our team. Help is on the way! 🚑"],
          quickReplies: ["🔙 Main Menu"],
          sessionData: reset(col),
          action: "NONE",
        };
      }
      if (match(inp, "AMC")) {
        return {
          messages: ["📋 Annual Maintenance Contract (AMC):\n\n✅ All periodic services covered\n✅ Priority service slots\n✅ Genuine spare parts\n✅ Trained AL technicians\n\nPlease share your vehicle number and we'll send AMC packages:"],
          quickReplies: ["🔙 Main Menu"],
          sessionData: { flow: "SERVICE", step: "ask_vehicle_no", collected: col },
          action: "NONE",
        };
      }
      if (match(inp, "Status")) {
        return ask("SERVICE", "ask_vehicle_no", col, "Please enter your Vehicle Registration Number to check service status:", []);
      }
      return ask("SERVICE", "ask_vehicle_no", col, "Please enter your Vehicle Registration Number:\n(e.g. MH01AB1234)", []);
    }
    if (s.step === "ask_vehicle_no")   { col.vehicleNumber = inp.toUpperCase(); return ask("SERVICE", "ask_dealer_city", col, "Select preferred service center city:", CITIES); }
    if (s.step === "ask_dealer_city")  { col.dealerCity = inp; return ask("SERVICE", "ask_date", col, "Preferred date for service:", DATES); }
    if (s.step === "ask_date") {
      col.date = inp;
      return {
        messages: [`✅ Service Booking Confirmed!\n\n🚛 Vehicle: ${col.vehicleNumber}\n🔧 Service: ${col.serviceType}\n📍 City: ${col.dealerCity}\n📅 Date: ${col.date}\n\nOur service advisor will call to confirm the appointment. 🙏`],
        quickReplies: ["🔙 Main Menu", "💬 Chat with Agent"],
        sessionData: reset(col),
        action: "CREATE_TICKET",
        ticketData: { subject: `${col.serviceType} – ${col.vehicleNumber}`, description: `Vehicle: ${col.vehicleNumber}, Service: ${col.serviceType}, City: ${col.dealerCity}, Date: ${col.date}`, vehicleNumber: col.vehicleNumber, serviceType: col.serviceType },
        leadData: { ...col, type: "SERVICE", score: "50" },
      };
    }
  }

  // ── SPARE PARTS ────────────────────────────────────────────────────────────
  if (s.flow === "SPARE_PARTS") {
    if (s.step === "ask_vehicle")  { col.vehicle = inp;      return ask("SPARE_PARTS", "ask_category", col, "Select part category:", PART_CATEGORIES); }
    if (s.step === "ask_category") { col.partCategory = inp; return ask("SPARE_PARTS", "ask_name",     col, "Your name:", []); }
    if (s.step === "ask_name")     { col.name = inp;         return ask("SPARE_PARTS", "ask_phone",    col, "Your mobile number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("SPARE_PARTS", "ask_phone", col, "⚠️ Please enter a valid mobile number:", []);
      col.phone = inp;
      return {
        messages: [`✅ Spare Parts Enquiry Submitted!\n\n👤 ${col.name}\n📞 ${col.phone}\n🚛 ${col.vehicle}\n🔩 ${col.partCategory}\n\nOur parts team will contact you within 4 hours. 🙏`],
        quickReplies: ["🛠️ Book Service", "💬 Chat with Agent", "🔙 Main Menu"],
        sessionData: reset(col),
        action: "CREATE_LEAD",
        leadData: { ...col, type: "SPARE_PARTS", score: "55" },
      };
    }
  }

  // ── FINANCE & EMI ──────────────────────────────────────────────────────────
  if (s.flow === "FINANCE_EMI") {
    if (s.step === "ask_vehicle") { col.vehicle = inp; return ask("FINANCE_EMI", "ask_price", col, `Vehicle price of ${inp}? (in Lakhs, e.g. 9 for ₹9L)`, []); }
    if (s.step === "ask_price") {
      col.vehiclePrice = inp;
      col._price = String(parseFloat(inp.replace(/[^0-9.]/g, "")) || 0);
      return ask("FINANCE_EMI", "ask_down", col, `Down payment amount? (in Lakhs, e.g. 2 for ₹2L)\n\nVehicle: ₹${col._price}L`, []);
    }
    if (s.step === "ask_down") {
      col.downPayment = inp;
      col._down = String(parseFloat(inp.replace(/[^0-9.]/g, "")) || 0);
      return ask("FINANCE_EMI", "ask_tenure", col, "Preferred loan tenure?", TENURES);
    }
    if (s.step === "ask_tenure") {
      col.tenure = inp;
      const months = parseInt(inp) || 36;
      const price  = parseFloat(col._price  || "0");
      const down   = parseFloat(col._down   || "0");
      return {
        messages: [calcEMI(price, down, months)],
        quickReplies: ["📞 Request Callback", "💬 Talk to Finance Expert", "🚗 Book Test Drive", "🔙 Main Menu"],
        sessionData: { flow: "FINANCE_EMI", step: "after_emi", collected: col },
        action: "NONE",
      };
    }
    if (s.step === "after_emi") {
      if (match(inp, "Callback"))      return ask("CALLBACK",    "ask_name",    col, "Your name for callback:", []);
      if (match(inp, "Finance Expert") || match(inp, "Talk to")) return escalate(col, "Finance enquiry");
      if (match(inp, "Book Test Drive")) return ask("TEST_DRIVE", "ask_vehicle", col, "Which vehicle?", AL_VEHICLES);
    }
  }

  // ── FIND DEALER ────────────────────────────────────────────────────────────
  if (s.flow === "FIND_DEALER") {
    if (s.step === "ask_city") {
      col.city = inp;
      return {
        messages: [dealerInfo(inp)],
        quickReplies: ["📞 Call Dealer", "📍 Open Maps", "💬 Chat with Agent", "🔙 Main Menu"],
        sessionData: reset(col),
        action: "NONE",
      };
    }
  }

  // ── REQUEST CALLBACK ───────────────────────────────────────────────────────
  if (s.flow === "CALLBACK") {
    if (s.step === "ask_name")  { col.name = inp; return ask("CALLBACK", "ask_phone", col, "Your mobile number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("CALLBACK", "ask_phone", col, "⚠️ Please enter a valid 10-digit mobile number:", []);
      col.phone = inp;  return ask("CALLBACK", "ask_time", col, "Preferred callback time:", [...TIMES, "Anytime"]);
    }
    if (s.step === "ask_time") {
      col.preferredTime = inp;
      return {
        messages: [`✅ Callback Requested!\n\n👤 ${col.name}\n📞 ${col.phone}\n⏰ ${col.preferredTime}\n\nOur team will call you at the requested time. 🙏\nThank you for choosing Ashok Leyland! 🚛`],
        quickReplies: ["🔙 Main Menu"],
        sessionData: reset(col),
        action: "CREATE_LEAD",
        leadData: { ...col, type: "CALLBACK", score: "65" },
      };
    }
  }

  // ── CHAT WITH AGENT ────────────────────────────────────────────────────────
  if (s.flow === "CHAT_AGENT") {
    if (s.step === "ask_category") { col.category = inp; return ask("CHAT_AGENT", "ask_name",  col, "Your name:", []); }
    if (s.step === "ask_name")     { col.name = inp;     return ask("CHAT_AGENT", "ask_phone", col, "Your mobile number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("CHAT_AGENT", "ask_phone", col, "⚠️ Please enter a valid mobile number:", []);
      col.phone = inp;  return ask("CHAT_AGENT", "ask_email", col, "Your email address:", []);
    }
    if (s.step === "ask_email") { col.email = inp; return ask("CHAT_AGENT", "ask_city", col, "Your city:", CITIES); }
    if (s.step === "ask_city")  { col.city = inp;  return escalate(col, col.category); }
  }

  return {
    messages: ["I didn't quite get that. 😊\n\nPlease select an option:"],
    quickReplies: MAIN_MENU,
    sessionData: { flow: "INITIAL", step: "", collected: col },
    action: "NONE",
  };
}
