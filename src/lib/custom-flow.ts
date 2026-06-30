import type { BotResponse, SessionData } from "./chatbot-flow";

// ── Questions the bot asks for each step type ─────────────────────────────────
const STEP_QUESTIONS: Record<string, string> = {
  "Ask Budget":              "💰 What's your budget range?",
  "Ask Fuel Type":           "⛽ Which fuel type do you prefer?\n(Petrol / Diesel / CNG / Electric / Hybrid)",
  "Ask Transmission":        "⚙️ Transmission preference?\n(Manual / Automatic / AMT)",
  "Ask Usage":               "🏍️ Primary usage?\n(City Commute / Highway / Off-road / Mixed)",
  "Ask Mileage Requirement": "📊 Mileage requirement?\n(40+ kmpl / 50+ kmpl / 60+ kmpl / Not a priority)",
  "Ask Daily Running":       "📍 Daily running distance?\n(Under 40 km / 40-80 km / 80 km+)",
  "Ask Charging Preference": "🔌 Charging preference?\n(Home Charging / Public Stations / Both)",
  "Ask Business Type":       "🏭 Type of business?\n(E-commerce / Construction / Agriculture / Transport / Other)",
  "Ask Payload Requirement": "📦 Payload capacity needed?\n(Under 1T / 1-2T / 2-5T / 5-10T / 10T+)",
  "Select Brand":            "🚗 Which brand are you looking for?",
  "Select State":            "📍 Which state are you in?",
  "Select City":             "🏙️ Which city are you in?",
  "Select Dealer":           "🏢 Please enter your preferred dealer location:",
  "Enter Name":              "👤 Please enter your full name:",
  "Enter Mobile":            "📱 Please enter your mobile number:",
  "Enter Email":             "📧 Please enter your email address:",
  "Select Vehicle":          "🚗 Which vehicle are you interested in?",
  "Choose Date":             "📅 Preferred date? (e.g. 05/07/2025)",
  "Choose Time":             "🕐 Preferred time slot?\n(Morning 10-12 / Afternoon 2-4 / Evening 5-7)",
  "Enter Vehicle Price":     "💰 Vehicle price (₹)? e.g. 800000",
  "Enter Down Payment":      "💳 Down payment amount (₹)? e.g. 150000",
  "Enter Interest Rate":     "📊 Interest rate (% per annum)? e.g. 8.5",
  "Enter Loan Tenure":       "📅 Loan tenure in months? e.g. 60",
  "Select Vehicle 1":        "🚗 First vehicle to compare (type model name):",
  "Select Vehicle 2":        "🚗 Second vehicle to compare (type model name):",
};

// Only steps that need user input — pseudo-steps like "Search Database", "Show Results" etc. are excluded
const USER_INPUT_STEPS = new Set(Object.keys(STEP_QUESTIONS));

// ── Identify step constants ───────────────────────────────────────────────────
const IDENTIFY_NAME_STEP  = "IDENTIFY_NAME";
const IDENTIFY_PHONE_STEP = "IDENTIFY_PHONE";

// ── Flow JSON types ───────────────────────────────────────────────────────────
type ActionItem =
  | { step: string }
  | { options: string[] }
  | { categories: string[] }
  | { comparison: string[] }
  | { response: unknown };

export interface FlowDef {
  chatbot: {
    name?: string;
    welcomeMessage?: string;
    mainMenu: { id: string; title: string; actions: ActionItem[] }[];
    aiFlows?: { trigger: string; flow: string[] }[];
    leadCapture?: { fields: string[] };
  };
}

// ── Helpers — only steps that have mapped questions are kept ──────────────────
function getSteps(menu: FlowDef["chatbot"]["mainMenu"][0]): string[] {
  return (menu.actions.filter(a => "step" in a) as { step: string }[])
    .map(a => a.step)
    .filter(s => USER_INPUT_STEPS.has(s));
}

function getOptions(menu: FlowDef["chatbot"]["mainMenu"][0]): string[] {
  const found = menu.actions.find(a => "options" in a) as { options: string[] } | undefined;
  return found?.options ?? [];
}

function getCategories(menu: FlowDef["chatbot"]["mainMenu"][0]): string[] {
  const found = menu.actions.find(a => "categories" in a) as { categories: string[] } | undefined;
  return found?.categories ?? [];
}

function getComparison(menu: FlowDef["chatbot"]["mainMenu"][0]): string[] {
  const found = menu.actions.find(a => "comparison" in a) as { comparison: string[] } | undefined;
  return found?.comparison ?? [];
}

const BACK = "🔙 Main Menu";

function encStep(menuId: string, idx: number) { return `${menuId}:${idx}`; }
function decStep(step: string): { menuId: string; idx: number } | null {
  const [menuId, idxStr] = step.split(":");
  const idx = parseInt(idxStr ?? "", 10);
  return menuId && !isNaN(idx) ? { menuId, idx } : null;
}

// Preserves name + phone when navigating back to main menu
function menuSession(fromCollected?: Record<string, string>): SessionData {
  const id: Record<string, string> = {};
  if (fromCollected?.name)  id.name  = fromCollected.name;
  if (fromCollected?.phone) id.phone = fromCollected.phone;
  return { flow: "CUSTOM", step: "MAIN_MENU", collected: id };
}

// ── EMI Calculator ────────────────────────────────────────────────────────────
function calcEMI(collected: Record<string, string>): string {
  const price  = parseFloat(collected["Enter Vehicle Price"]?.replace(/[^0-9.]/g, "") ?? "0");
  const down   = parseFloat(collected["Enter Down Payment"]?.replace(/[^0-9.]/g, "") ?? "0");
  const rpa    = parseFloat(collected["Enter Interest Rate"]?.replace(/[^0-9.]/g, "") ?? "9") / 100 / 12;
  const months = parseInt(collected["Enter Loan Tenure"]?.replace(/[^0-9]/g, "") ?? "60", 10);
  const p = price - down;
  if (p <= 0 || months <= 0 || rpa <= 0) {
    return "❌ Please check your numbers:\n• Vehicle Price must be greater than Down Payment\n• Interest Rate and Loan Tenure must be valid numbers";
  }
  const emi   = Math.round((p * rpa * Math.pow(1 + rpa, months)) / (Math.pow(1 + rpa, months) - 1));
  const total = emi * months;
  const fmt   = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  return `📊 *EMI Result*\n\n💳 Monthly EMI: *${fmt(emi)}*\n🏦 Loan Amount: ${fmt(p)}\n💰 Total Interest: ${fmt(total - p)}\n📈 Total Payable: ${fmt(total)}\n📅 Tenure: ${months} months`;
}

// ── Summary of what was collected ─────────────────────────────────────────────
function buildSummary(collected: Record<string, string>, menuTitle: string): string {
  const lines = Object.entries(collected)
    .filter(([k, v]) => v && v !== "Preview" && k !== "name" && k !== "phone")
    .map(([k, v]) => `• ${k}: ${v}`);
  if (!lines.length) return `Great choice! Let me find the best ${menuTitle} for you.`;
  return `📋 Based on your preferences:\n${lines.join("\n")}\n\nHere are your next options:`;
}

// ── Main processor ────────────────────────────────────────────────────────────
export function processCustomFlow(
  message: string,
  session: SessionData,
  flowDef: FlowDef,
): BotResponse {
  const chatbot = flowDef?.chatbot;
  if (!chatbot?.mainMenu?.length) {
    return {
      messages: ["Bot flow is not configured yet. Please contact support."],
      quickReplies: [],
      action: "NONE",
      sessionData: { flow: "INITIAL", step: "", collected: {} },
    };
  }

  const menuTitles = chatbot.mainMenu.map(m => m.title);
  const lower = message.toLowerCase().trim();
  const col   = (session.collected ?? {}) as Record<string, string>;

  // ── INIT ─────────────────────────────────────────────────────────────────────
  // Only fires on __INIT__, explicit BACK button press, or truly empty session
  if (message === "__INIT__" || message === BACK || !session.step) {
    const welcome = chatbot.welcomeMessage ?? `Welcome to ${chatbot.name ?? "our chatbot"}!`;

    // Already identified — go straight to menu
    if (col.name && col.phone) {
      return {
        messages: message === "__INIT__"
          ? [welcome, `Welcome back, ${col.name}! 👋 How can I help you today?`]
          : ["Back to main menu! What would you like to explore? 😊"],
        quickReplies: menuTitles,
        action: "NONE",
        sessionData: menuSession(col),
      };
    }

    // Fresh start — begin identification
    return {
      messages: message === "__INIT__"
        ? [welcome, "To help you better, could you please share your name? 👤"]
        : ["Let's start over! What is your name? 👤"],
      quickReplies: [],
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: IDENTIFY_NAME_STEP, collected: {} },
    };
  }

  // ── IDENTIFY: collect visitor name ────────────────────────────────────────────
  if (session.step === IDENTIFY_NAME_STEP) {
    if (["back", "menu", "main", "home", "cancel", "restart"].includes(lower)) {
      return {
        messages: ["No problem! What is your name? 👤"],
        quickReplies: [],
        action: "NONE",
        sessionData: { flow: "CUSTOM", step: IDENTIFY_NAME_STEP, collected: {} },
      };
    }
    return {
      messages: ["📱 Please share your phone number, to contact you in case of any queries:"],
      quickReplies: [],
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: IDENTIFY_PHONE_STEP, collected: { name: message } },
    };
  }

  // ── IDENTIFY: collect visitor phone ──────────────────────────────────────────
  if (session.step === IDENTIFY_PHONE_STEP) {
    if (["back", "menu", "main", "home", "cancel", "restart"].includes(lower)) {
      // Back to name
      return {
        messages: ["What is your name? 👤"],
        quickReplies: [],
        action: "NONE",
        sessionData: { flow: "CUSTOM", step: IDENTIFY_NAME_STEP, collected: {} },
      };
    }
    const name = col.name || "there";
    const newCollected = { ...col, phone: message };
    return {
      messages: [
        `Thanks for the details, ${name}! 👋`,
        "Please select from the below options:",
      ],
      quickReplies: menuTitles,
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: "MAIN_MENU", collected: newCollected },
    };
  }

  // ── Handle "back" typed at any point ─────────────────────────────────────────
  if (["back", "menu", "main", "home", "cancel", "restart"].includes(lower) ||
      lower === BACK.toLowerCase()) {
    return {
      messages: ["Back to main menu! What would you like to explore? 😊"],
      quickReplies: menuTitles,
      action: "NONE",
      sessionData: menuSession(col),
    };
  }

  // ── Main menu selection ───────────────────────────────────────────────────────
  if (session.step === "MAIN_MENU") {
    // Fuzzy match: exact → strip-emoji word → any keyword
    const stripEmoji = (s: string) => s.replace(/[^\w\s]/g, "").trim();
    const menu = chatbot.mainMenu.find(m => {
      const t = m.title.toLowerCase();
      if (t === lower) return true;
      const plain = stripEmoji(t);
      if (plain && lower.includes(plain)) return true;
      return plain.split(/\s+/).filter(w => w.length > 2).some(w => lower.includes(w));
    });

    if (!menu) {
      // Try AI flow keyword match
      const aiMatch = chatbot.aiFlows?.find(f =>
        f.trigger.toLowerCase().split(/\s+/).some(w => w.length > 3 && lower.includes(w))
      );
      if (aiMatch) {
        return {
          messages: [`🔍 I can help with "${aiMatch.trigger}"! Here's what I'll do:`, aiMatch.flow.join(" → ")],
          quickReplies: ["📅 Book Test Drive", BACK],
          action: "NONE",
          sessionData: menuSession(col),
        };
      }
      return {
        messages: ["I didn't quite catch that. Please choose from the menu:"],
        quickReplies: menuTitles,
        action: "NONE",
        sessionData: menuSession(col),
      };
    }

    // Menu with categories (e.g. Auto News)
    const cats = getCategories(menu);
    if (cats.length) {
      return {
        messages: [`📂 Select a ${menu.title} category:`],
        quickReplies: [...cats, BACK],
        action: "NONE",
        sessionData: { flow: "CUSTOM", step: encStep(menu.id, -1), collected: col },
      };
    }

    // Menu with user-input steps
    const steps = getSteps(menu);
    if (steps.length) {
      return {
        messages: [`Great! Let me help you find the perfect ${menu.title}.`, stepToQuestion(steps[0])],
        quickReplies: [BACK],
        action: "NONE",
        sessionData: { flow: "CUSTOM", step: encStep(menu.id, 0), collected: col },
      };
    }

    // Menu with only options (no steps, no categories)
    const opts = getOptions(menu);
    return {
      messages: [`Here are the options for *${menu.title}*:`],
      quickReplies: opts.length ? [...opts, BACK] : [BACK],
      action: "NONE",
      sessionData: menuSession(col),
    };
  }

  // ── In a category step (idx = -1, e.g. Auto News) ────────────────────────────
  const dec = decStep(session.step);
  if (!dec) {
    return {
      messages: ["Something went wrong. Returning to main menu."],
      quickReplies: menuTitles,
      action: "NONE",
      sessionData: menuSession(col),
    };
  }

  const { menuId, idx } = dec;

  if (idx === -1) {
    return {
      messages: [
        `📰 *${message} News* — Top Headlines`,
        "Here are the latest updates. Full article links will be available when live data is connected.",
      ],
      quickReplies: [BACK, "🔙 Auto News"],
      action: "NONE",
      sessionData: menuSession(col),
    };
  }

  // ── In a user-input step ──────────────────────────────────────────────────────
  const menu = chatbot.mainMenu.find(m => m.id === menuId);
  if (!menu) {
    return {
      messages: ["Menu not found. Returning to main menu."],
      quickReplies: menuTitles,
      action: "NONE",
      sessionData: menuSession(col),
    };
  }

  const steps = getSteps(menu);
  const stepKey = steps[idx] ?? `step_${idx}`;
  const newCollected: Record<string, string> = {
    ...(session.collected as Record<string, string>),
    [stepKey]: message,
  };

  // ── EMI: compute result after last input step ─────────────────────────────────
  if (menuId === "emi" && idx === steps.length - 1) {
    return {
      messages: [calcEMI(newCollected)],
      quickReplies: ["🔄 Calculate Again", BACK],
      action: "NONE",
      sessionData: menuSession(newCollected),
    };
  }

  // ── Compare: show result after collecting both vehicles ───────────────────────
  if (menuId === "compare" && idx === steps.length - 1) {
    const v1 = newCollected["Select Vehicle 1"] ?? "Vehicle 1";
    const v2 = newCollected["Select Vehicle 2"] ?? "Vehicle 2";
    const fields = getComparison(menu);
    const compFields = fields.length ? fields : ["Price", "Mileage", "Engine", "Safety", "Features"];
    return {
      messages: [
        `📊 *${v1} vs ${v2}* — Comparison`,
        `Comparing: ${compFields.join(" | ")}\n\n(Live comparison data will be fetched when the database is connected.)`,
      ],
      quickReplies: ["📅 Book Test Drive", "📍 Find Dealer", BACK],
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: "MAIN_MENU", collected: newCollected },
    };
  }

  // ── Move to next step ─────────────────────────────────────────────────────────
  const nextIdx = idx + 1;
  if (nextIdx < steps.length) {
    return {
      messages: [stepToQuestion(steps[nextIdx])],
      quickReplies: [BACK],
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: encStep(menuId, nextIdx), collected: newCollected },
    };
  }

  // ── All steps done ────────────────────────────────────────────────────────────
  const opts = getOptions(menu);
  const isTestDrive = menuId === "testDrive" || menuId === "testRide";
  const isDealers   = menuId === "dealers";

  const leadData: Record<string, string> | undefined = isTestDrive ? {
    name:    newCollected["Enter Name"]     ?? newCollected.name  ?? "Visitor",
    phone:   newCollected["Enter Mobile"]   ?? newCollected.phone ?? "",
    email:   newCollected["Enter Email"]    ?? "",
    city:    newCollected["Select City"]    ?? "",
    vehicle: newCollected["Select Vehicle"] ?? "",
    dealer:  newCollected["Select Dealer"]  ?? "",
    source:  "CHAT_WIDGET",
    type:    "TEST_DRIVE",
    score:   "80",
  } : undefined;

  if (isTestDrive) {
    return {
      messages: [
        "✅ *Test Drive Booked Successfully!*",
        `📋 Booking Summary:\n• Vehicle: ${newCollected["Select Vehicle"] ?? "—"}\n• Name: ${newCollected["Enter Name"] ?? newCollected.name ?? "—"}\n• Mobile: ${newCollected["Enter Mobile"] ?? newCollected.phone ?? "—"}\n• City: ${newCollected["Select City"] ?? "—"}\n• Date: ${newCollected["Choose Date"] ?? "—"}\n• Time: ${newCollected["Choose Time"] ?? "—"}\n\nOur team will contact you shortly to confirm.`,
      ],
      quickReplies: opts.length ? [...opts, BACK] : [BACK],
      action: "CREATE_LEAD",
      sessionData: { flow: "CUSTOM", step: "MAIN_MENU", collected: newCollected },
      leadData,
    };
  }

  if (isDealers) {
    return {
      messages: [
        `📍 *Dealer Found!*\n• Brand: ${newCollected["Select Brand"] ?? "—"}\n• City: ${newCollected["Select City"] ?? "—"}\n• Dealer: ${newCollected["Select Dealer"] ?? "—"}\n\n(Live dealer details will be shown when database is connected.)`,
      ],
      quickReplies: opts.length ? [...opts, BACK] : [BACK],
      action: "NONE",
      sessionData: { flow: "CUSTOM", step: "MAIN_MENU", collected: newCollected },
    };
  }

  return {
    messages: [buildSummary(newCollected, menu.title)],
    quickReplies: opts.length ? [...opts, BACK] : [BACK],
    action: "NONE",
    sessionData: { flow: "CUSTOM", step: "MAIN_MENU", collected: newCollected },
  };
}

function stepToQuestion(step: string): string {
  return STEP_QUESTIONS[step] ?? `Please enter: ${step}`;
}
