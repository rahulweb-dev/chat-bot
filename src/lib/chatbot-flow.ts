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
  "🚗 Buy a New Car",
  "🔧 Car Servicing",
  "🔄 Buy / Sell Used Car",
  "🛡️ Insurance Renewal",
  "📅 Book a Test Drive",
  "🏢 Book Showroom Visit",
  "🎁 Current Offers",
  "🔩 Accessories",
  "📝 Complaint / Feedback",
  "💬 Chat with a Live Agent",
];

const CAR_CATEGORIES = ["🚗 Hatchback", "🚙 Sedan", "🏎️ SUV / Crossover", "⚡ Electric Vehicle"];

function matchMenu(input: string, keyword: string): boolean {
  return input.toLowerCase().includes(keyword.toLowerCase());
}

function ask(flow: string, nextStep: string, col: Record<string, string>, message: string, opts: string[]): BotResponse {
  return {
    messages: [message],
    quickReplies: opts.length ? [...opts, "🔙 Main Menu"] : ["🔙 Main Menu"],
    sessionData: { flow, step: nextStep, collected: col },
    action: "NONE",
  };
}

function reset(col: Record<string, string>): SessionData {
  return { flow: "INITIAL", step: "", collected: col };
}

function isPhone(s: string): boolean {
  return /^[\+]?[\d\s\-]{9,14}$/.test(s.replace(/[\s\-]/g, ""));
}

function modelOptions(category: string): string[] {
  const c = category.toLowerCase();
  if (c.includes("hatch"))    return ["Maruti Swift", "Hyundai i20", "Tata Tiago", "WagonR", "Other"];
  if (c.includes("sedan"))    return ["Honda City", "Hyundai Verna", "Maruti Ciaz", "Other"];
  if (c.includes("suv"))      return ["Hyundai Creta", "Tata Nexon", "Maruti Brezza", "Kia Seltos", "Other"];
  if (c.includes("electric")) return ["Tata Nexon EV", "MG ZS EV", "Hyundai Ioniq 5", "Other"];
  return ["Tell us your preferred model"];
}

function priceRange(category: string): string {
  const c = (category || "").toLowerCase();
  if (c.includes("hatch"))    return "🚗 Hatchback: ₹5.5L – ₹12L\n(Swift: ₹6.5L, i20: ₹7.2L, Tiago: ₹5.5L)";
  if (c.includes("sedan"))    return "🚙 Sedan: ₹11L – ₹18L\n(City: ₹12L, Verna: ₹11.5L, Ciaz: ₹11L)";
  if (c.includes("suv"))      return "🏎️ SUV: ₹8L – ₹25L\n(Creta: ₹11L, Nexon: ₹8.5L, Seltos: ₹11L)";
  if (c.includes("electric")) return "⚡ EV: ₹14L – ₹45L\n(Nexon EV: ₹15L, ZS EV: ₹22L)";
  return "Price range: ₹5.5L – ₹45L depending on model & variant";
}

function mainMenu(): BotResponse {
  return {
    messages: ["Please select from the options below:"],
    quickReplies: MAIN_MENU,
    sessionData: { flow: "INITIAL", step: "", collected: {} },
    action: "NONE",
  };
}

function escalate(col: Record<string, string>): BotResponse {
  return {
    messages: ["💬 Connecting you to a Live Agent...\n\n🕘 Operating Hours: 9 AM – 6 PM (Mon–Sat)\n\nIf no agent is available right now, we'll call you back shortly."],
    quickReplies: ["🔙 Main Menu"],
    sessionData: reset(col),
    action: "ASSIGN_AGENT",
  };
}

function offersFlow(): BotResponse {
  return {
    messages: ["🎁 Current Offers & Benefits:\n\n💵 Cash Discount — Up to ₹50,000\n🔄 Exchange Bonus — Up to ₹30,000\n🏢 Corporate Discount — Up to ₹20,000\n❤️ Loyalty Bonus — Up to ₹15,000\n💳 Finance Benefits — 0% EMI schemes\n🎊 Festival Special — Limited time offers\n\nOffers vary by model & variant. Would you like a personalised quotation?"],
    quickReplies: ["💬 Get Personalised Quote", "📅 Book Test Drive", "🔙 Main Menu"],
    sessionData: { flow: "INITIAL", step: "", collected: {} },
    action: "NONE",
  };
}

function accessoriesFlow(): BotResponse {
  return {
    messages: ["🔩 Accessories Available:\n\n🚗 Exterior — Body kit, alloy wheels, sunroof, chrome package\n🛋️ Interior — Seat covers, floor mats, steering covers, ambient lighting\n🔒 Safety — Dash cam, parking sensors, reverse camera\n📱 Electronics — Android/Apple CarPlay, speakers, GPS\n\nWould you like our accessories brochure or speak to our team?"],
    quickReplies: ["📧 Send Brochure", "💬 Talk to Executive", "🔙 Main Menu"],
    sessionData: { flow: "INITIAL", step: "", collected: {} },
    action: "NONE",
  };
}

function modelsMenu(col: Record<string, string>): BotResponse {
  return {
    messages: ["Great choice! 🚗 Any specific model in mind?"],
    quickReplies: modelOptions(col.vehicle || ""),
    sessionData: { flow: "BUY_NEW_CAR", step: "ask_model", collected: col },
    action: "NONE",
  };
}

function showroomInfo(): BotResponse {
  return {
    messages: ["📍 Our Showrooms:\n\n1️⃣ Main Showroom\n   Road No. 12, Banjara Hills\n   📞 040-12345678\n\n2️⃣ Branch Showroom\n   Gachibowli, HITEC City\n   📞 040-87654321\n\n🕘 Open: Mon–Sat 9 AM – 7 PM\n🕘 Sunday: 10 AM – 5 PM"],
    quickReplies: ["🏢 Book a Visit", "🔙 Main Menu"],
    sessionData: { flow: "INITIAL", step: "", collected: {} },
    action: "NONE",
  };
}

function emiFlow(col: Record<string, string>): BotResponse {
  return {
    messages: ["🧾 Estimated EMI Calculator:\n\nVehicle: " + (col.category || "Selected Car") + "\n\n💰 ₹5L loan @ 8.5% for 60 months = ₹10,230/mo\n💰 ₹7L loan @ 8.5% for 60 months = ₹14,322/mo\n💰 ₹10L loan @ 8.5% for 60 months = ₹20,460/mo\n\nFor exact EMI based on your down payment, speak to our finance team."],
    quickReplies: ["💬 Talk to Finance Executive", "📅 Book Test Drive", "🔙 Main Menu"],
    sessionData: { flow: "INITIAL", step: "", collected: col },
    action: "NONE",
  };
}

function startFlow(flow: string, col: Record<string, string>, label: string): BotResponse {
  // Skip name/phone collection if already captured (e.g. from visitor form)
  if (col.name && col.phone) {
    return {
      messages: [`Great ${col.name}! 😊 Let's help you with ${label}.`],
      quickReplies: ["🔙 Main Menu"],
      sessionData: { flow, step: "after_contact", collected: col },
      action: "NONE",
    };
  }
  if (col.name && !col.phone) {
    return {
      messages: [`Hi ${col.name}! 😊 Let's help you with ${label}.\n\nCould I have your phone number?`],
      quickReplies: ["🔙 Main Menu"],
      sessionData: { flow, step: "ask_phone", collected: col },
      action: "NONE",
    };
  }
  return {
    messages: [`Great! Let's help you with ${label}. 😊\n\nCould I have your name please?`],
    quickReplies: ["🔙 Main Menu"],
    sessionData: { flow, step: "ask_name", collected: col },
    action: "NONE",
  };
}

// ── Main flow engine ──────────────────────────────────────────────────────────
export function processFlow(input: string, session: SessionData): BotResponse {
  const inp = input.trim();
  const s = session;
  const col = { ...s.collected };

  if (matchMenu(inp, "Main Menu") || matchMenu(inp, "Go Back") || matchMenu(inp, "Start Over")) return mainMenu();
  if (matchMenu(inp, "Chat with a Live Agent") || matchMenu(inp, "Talk to Executive") || matchMenu(inp, "Live Agent")) return escalate(col);

  // ─ INITIAL ──────────────────────────────────────────────────────────────────
  if (!s.flow || s.flow === "INITIAL" || s.step === "") {
    if (inp === "__INIT__") return mainMenu();
    if (matchMenu(inp, "Buy a New Car"))       return startFlow("BUY_NEW_CAR", col, "Buying a New Car");
    if (matchMenu(inp, "Car Servicing"))        return startFlow("SERVICING", col, "Car Servicing");
    if (matchMenu(inp, "Buy / Sell Used Car"))  return startFlow("USED_CAR", col, "Buy/Sell Used Car");
    if (matchMenu(inp, "Insurance Renewal"))    return startFlow("INSURANCE", col, "Insurance Renewal");
    if (matchMenu(inp, "Book a Test Drive"))    return startFlow("TEST_DRIVE", col, "Test Drive Booking");
    if (matchMenu(inp, "Book Showroom Visit"))  return startFlow("SHOWROOM", col, "Showroom Visit");
    if (matchMenu(inp, "Current Offers"))       return offersFlow();
    if (matchMenu(inp, "Accessories"))          return accessoriesFlow();
    if (matchMenu(inp, "Complaint") || matchMenu(inp, "Feedback")) return startFlow("COMPLAINT", col, "Complaint / Feedback");
    return mainMenu();
  }

  // ─ BUY NEW CAR ──────────────────────────────────────────────────────────────
  if (s.flow === "BUY_NEW_CAR") {
    if (s.step === "after_contact") return { messages: [`Thanks ${col.name}! 😊 How can we help you?`], quickReplies: ["💰 Get Price Quote", "📅 Book Test Drive", "🚘 View Models", "🏙️ Find Showroom", "💬 Talk to Executive"], sessionData: { flow: "BUY_NEW_CAR", step: "sub_menu", collected: col }, action: "NONE" };
    if (s.step === "ask_name") { col.name = inp; return ask("BUY_NEW_CAR", "ask_phone", col, "Please share your phone number.\n(Include country code e.g. +91 98765 43210)", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("BUY_NEW_CAR", "ask_phone", col, "⚠️ Please enter a valid phone number (10 digits or with +91):", []);
      col.phone = inp;
      return { messages: [`Thanks ${col.name}! 😊 How can we help you?`], quickReplies: ["💰 Get Price Quote", "📅 Book Test Drive", "🚘 View Models", "🏙️ Find Showroom", "💬 Talk to Executive"], sessionData: { flow: "BUY_NEW_CAR", step: "sub_menu", collected: col }, action: "NONE" };
    }
    if (s.step === "sub_menu") {
      if (matchMenu(inp, "Get Price Quote"))   return ask("BUY_NEW_CAR", "ask_category", col, "Which category are you interested in?", ["🚗 Hatchback", "🚙 Sedan", "🏎️ SUV / Crossover", "⚡ Electric Vehicle"]);
      if (matchMenu(inp, "Book Test Drive"))   return { messages: ["Which vehicle would you like to test drive?"], quickReplies: CAR_CATEGORIES, sessionData: { flow: "TEST_DRIVE", step: "ask_vehicle", collected: col }, action: "NONE" };
      if (matchMenu(inp, "View Models"))       return modelsMenu(col);
      if (matchMenu(inp, "Find Showroom"))     return showroomInfo();
      if (matchMenu(inp, "Talk to Executive")) return escalate(col);
    }
    if (s.step === "ask_category") { col.category = inp; return ask("BUY_NEW_CAR", "ask_city", col, "Great choice! 🚗 Which city are you in? (We'll show the on-road price)", ["Hyderabad", "Bengaluru", "Mumbai", "Delhi", "Chennai", "Pune", "Other"]); }
    if (s.step === "ask_city") {
      col.city = inp;
      return { messages: [`💰 Estimated On-Road Price in ${col.city}:\n\n${priceRange(col.category)}\n\nPrices vary by variant & offers. Want exact pricing?`], quickReplies: ["📅 Book Test Drive", "🧾 EMI Details", "💬 Talk to Executive", "🔙 Main Menu"], sessionData: { flow: "BUY_NEW_CAR", step: "after_price", collected: col }, action: "NONE" };
    }
    if (s.step === "after_price") {
      if (matchMenu(inp, "EMI Details"))       return emiFlow(col);
      if (matchMenu(inp, "Book Test Drive"))   return { messages: ["Which vehicle would you like to test drive?"], quickReplies: CAR_CATEGORIES, sessionData: { flow: "TEST_DRIVE", step: "ask_vehicle", collected: col }, action: "NONE" };
      if (matchMenu(inp, "Talk to Executive")) return escalate(col);
    }
  }

  // ─ CAR SERVICING ────────────────────────────────────────────────────────────
  if (s.flow === "SERVICING") {
    if (s.step === "after_contact") return ask("SERVICING", "ask_vehicle_no", col, "Please enter your Vehicle Number:\n(e.g. TS09AB1234)", []);
    if (s.step === "ask_name") { col.name = inp; return ask("SERVICING", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("SERVICING", "ask_phone", col, "⚠️ Invalid number. Please enter a valid phone number:", []);
      col.phone = inp;
      return ask("SERVICING", "ask_vehicle_no", col, "Please enter your Vehicle Number:\n(e.g. TS09AB1234)", []);
    }
    if (s.step === "ask_vehicle_no") { col.vehicleNumber = inp.toUpperCase(); return ask("SERVICING", "ask_service_type", col, "Select service type:", ["🔩 Periodic Service", "🔧 General Repair", "🚨 Accident Repair", "✅ Warranty Service", "🔋 Battery / EV Service"]); }
    if (s.step === "ask_service_type") { col.serviceType = inp; return ask("SERVICING", "ask_preferred_date", col, "Preferred date for service?", ["Tomorrow", "This Week", "Choose Date"]); }
    if (s.step === "ask_preferred_date") {
      col.preferredDate = inp;
      return { messages: [`✅ Service Request Confirmed!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n🚗 Vehicle: ${col.vehicleNumber}\n🔧 Service: ${col.serviceType}\n📅 Date: ${col.preferredDate}\n\nOur service team will call you shortly to confirm your appointment.`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_TICKET", ticketData: { subject: `${col.serviceType} – ${col.vehicleNumber}`, description: `Name: ${col.name}, Phone: ${col.phone}, Vehicle: ${col.vehicleNumber}, Service: ${col.serviceType}, Date: ${col.preferredDate}`, vehicleNumber: col.vehicleNumber, serviceType: col.serviceType }, leadData: { ...col, type: "SERVICE", score: "50" } };
    }
  }

  // ─ USED CAR ──────────────────────────────────────────────────────────────────
  if (s.flow === "USED_CAR") {
    if (s.step === "after_contact") return ask("USED_CAR", "buy_or_sell", col, "Are you looking to:", ["💰 Buy a Used Car", "🔄 Sell / Exchange My Car"]);
    if (s.step === "ask_name") { col.name = inp; return ask("USED_CAR", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("USED_CAR", "ask_phone", col, "⚠️ Invalid number. Please re-enter:", []);
      col.phone = inp;
      return ask("USED_CAR", "buy_or_sell", col, "Are you looking to:", ["💰 Buy a Used Car", "🔄 Sell / Exchange My Car"]);
    }
    if (s.step === "buy_or_sell") {
      col.intent = matchMenu(inp, "Sell") ? "SELL" : "BUY";
      if (col.intent === "SELL") return ask("USED_CAR", "ask_vehicle_details", col, "Please share your vehicle details:\n\nFormat: Brand, Model, Year, KMs Driven\nExample: Hyundai i20, 2019, 45,000 km", []);
      return { messages: [`✅ Got it ${col.name}!\n\nOur used car expert will contact you on ${col.phone} shortly with the best available options.`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_LEAD", leadData: { ...col, type: "BUY_USED_CAR", score: "55" } };
    }
    if (s.step === "ask_vehicle_details") {
      col.vehicleDetails = inp;
      return { messages: [`✅ Exchange Request Received!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n🚗 Vehicle: ${col.vehicleDetails}\n\nOur exchange specialist will contact you with the best valuation shortly. 💰`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_LEAD", leadData: { ...col, type: "EXCHANGE", score: "70" } };
    }
  }

  // ─ INSURANCE ─────────────────────────────────────────────────────────────────
  if (s.flow === "INSURANCE") {
    if (s.step === "after_contact") return ask("INSURANCE", "ask_vehicle_no", col, "Please enter your Vehicle Number:", []);
    if (s.step === "ask_name") { col.name = inp; return ask("INSURANCE", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("INSURANCE", "ask_phone", col, "⚠️ Invalid number. Please re-enter:", []);
      col.phone = inp;
      return ask("INSURANCE", "ask_vehicle_no", col, "Please enter your Vehicle Number:", []);
    }
    if (s.step === "ask_vehicle_no") { col.vehicleNumber = inp.toUpperCase(); return ask("INSURANCE", "ask_policy_expiry", col, "When does your current policy expire?", ["This Month", "Next Month", "Already Expired", "Don't Know"]); }
    if (s.step === "ask_policy_expiry") {
      col.policyExpiry = inp;
      return { messages: [`✅ Insurance Renewal Submitted!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n🚗 Vehicle: ${col.vehicleNumber}\n📅 Expiry: ${col.policyExpiry}\n\nOur insurance executive will contact you with the best renewal plans.`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_LEAD", leadData: { ...col, type: "INSURANCE", score: "55" } };
    }
  }

  // ─ TEST DRIVE ────────────────────────────────────────────────────────────────
  if (s.flow === "TEST_DRIVE") {
    if (s.step === "after_contact") return ask("TEST_DRIVE", "ask_vehicle", col, "Which type of vehicle would you like to test drive?", CAR_CATEGORIES);
    if (s.step === "ask_name") { col.name = inp; return ask("TEST_DRIVE", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("TEST_DRIVE", "ask_phone", col, "⚠️ Invalid number. Please re-enter:", []);
      col.phone = inp;
      return ask("TEST_DRIVE", "ask_vehicle", col, "Which type of vehicle would you like to test drive?", CAR_CATEGORIES);
    }
    if (s.step === "ask_vehicle") { col.vehicle = inp; return ask("TEST_DRIVE", "ask_model", col, "Great choice! 🚗 Any specific model in mind?", modelOptions(inp)); }
    if (s.step === "ask_model") { col.model = inp; return ask("TEST_DRIVE", "ask_date", col, "Preferred date for test drive?", ["Today", "Tomorrow", "This Saturday", "This Sunday", "Choose Date"]); }
    if (s.step === "ask_date") { col.date = inp; return ask("TEST_DRIVE", "ask_time", col, "Preferred time slot?", ["🌅 9 AM – 11 AM", "☀️ 11 AM – 1 PM", "🌤️ 2 PM – 4 PM", "🌇 4 PM – 6 PM"]); }
    if (s.step === "ask_time") {
      col.time = inp;
      return { messages: [`🎉 Test Drive Booked!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n🚗 Vehicle: ${col.model || col.vehicle}\n📅 Date: ${col.date}\n⏰ Time: ${col.time}\n\nOur team will confirm your slot shortly. See you at the showroom! 🏎️`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_LEAD", leadData: { ...col, type: "TEST_DRIVE", score: "85" } };
    }
  }

  // ─ SHOWROOM VISIT ────────────────────────────────────────────────────────────
  if (s.flow === "SHOWROOM") {
    if (s.step === "after_contact") return ask("SHOWROOM", "ask_purpose", col, "What is the purpose of your visit?", ["🚗 See New Cars", "💰 Get Price Quote", "📝 Complete Booking", "🔧 Service Enquiry", "🔄 Exchange Enquiry"]);
    if (s.step === "ask_name") { col.name = inp; return ask("SHOWROOM", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("SHOWROOM", "ask_phone", col, "⚠️ Invalid number. Please re-enter:", []);
      col.phone = inp;
      return ask("SHOWROOM", "ask_purpose", col, "What is the purpose of your visit?", ["🚗 See New Cars", "💰 Get Price Quote", "📝 Complete Booking", "🔧 Service Enquiry", "🔄 Exchange Enquiry"]);
    }
    if (s.step === "ask_purpose") { col.purpose = inp; return ask("SHOWROOM", "ask_date", col, "When would you like to visit?", ["Today", "Tomorrow", "This Saturday", "This Sunday"]); }
    if (s.step === "ask_date") {
      col.date = inp;
      return { messages: [`✅ Showroom Visit Confirmed!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n🎯 Purpose: ${col.purpose}\n📅 Date: ${col.date}\n\n📍 Our team will send you the showroom address and confirm your visit shortly.`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_LEAD", leadData: { ...col, type: "SHOWROOM_VISIT", score: "70" } };
    }
  }

  // ─ COMPLAINT / FEEDBACK ──────────────────────────────────────────────────────
  if (s.flow === "COMPLAINT") {
    if (s.step === "after_contact") return ask("COMPLAINT", "ask_type", col, "Please select the type:", ["😠 Vehicle Complaint", "🔧 Service Complaint", "💰 Billing Issue", "👤 Staff Behaviour", "📦 Delivery Delay", "💬 General Feedback"]);
    if (s.step === "ask_name") { col.name = inp; return ask("COMPLAINT", "ask_phone", col, "Please share your phone number:", []); }
    if (s.step === "ask_phone") {
      if (!isPhone(inp)) return ask("COMPLAINT", "ask_phone", col, "⚠️ Invalid number. Please re-enter:", []);
      col.phone = inp;
      return ask("COMPLAINT", "ask_type", col, "Please select the type:", ["😠 Vehicle Complaint", "🔧 Service Complaint", "💰 Billing Issue", "👤 Staff Behaviour", "📦 Delivery Delay", "💬 General Feedback"]);
    }
    if (s.step === "ask_type") { col.complaintType = inp; return ask("COMPLAINT", "ask_details", col, "Please describe your concern in detail:\n(We take all feedback seriously)", []); }
    if (s.step === "ask_details") {
      col.complaintDetails = inp;
      return { messages: [`✅ Complaint Registered!\n\n👤 Name: ${col.name}\n📞 Phone: ${col.phone}\n📋 Type: ${col.complaintType}\n📝 Details: ${col.complaintDetails}\n\nOur customer care team will contact you within 24 hours. 🙏`], quickReplies: ["🔙 Main Menu", "💬 Talk to Executive"], sessionData: reset(col), action: "CREATE_TICKET", ticketData: { subject: `${col.complaintType} – ${col.name}`, description: `Name: ${col.name}, Phone: ${col.phone}, Type: ${col.complaintType}\nDetails: ${col.complaintDetails}`, vehicleNumber: "", serviceType: col.complaintType }, leadData: { ...col, type: "COMPLAINT", score: "40" } };
    }
  }

  return { messages: ["I didn't quite get that. Please select an option:"], quickReplies: MAIN_MENU, sessionData: { flow: "INITIAL", step: "", collected: col }, action: "NONE" };
}
