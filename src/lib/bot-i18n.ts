// The bot's own built-in sentences (asking name/phone, booking, navigation) in
// the widget's language. Company-written content (greeting, menu, FAQs) is
// shown as written; AI answers already follow the visitor's language.

export type BotLang = "en" | "hi";

export function botLang(v?: string): BotLang {
  return v === "hi" ? "hi" : "en";
}

const STRINGS = {
  en: {
    askName: "I'm your virtual assistant. May I know your name?",
    nameRetry: "Please enter your name (at least 2 characters):",
    askPhone: "Nice to meet you, {name}! 😊 Could you share your mobile number?",
    phoneRetry: "⚠️ That number doesn't look right. Please enter your 10-digit mobile number (for example 98765 43210):",
    thanksOnline: "Thanks, {name}! ✅ How can I help you today?",
    thanksOffline: "Thanks, {name}! ✅ Our team is offline right now, so we'll call you on {phone} as soon as we're back.\n\nMeanwhile, what would you like to know?",
    welcomeBack: "Welcome back, {name}! How can I help you today?",
    mainMenu: "🔙 Main Menu",
    talkToHuman: "💬 Talk to a Human",
    bookButton: "📅 Book a {label}",
    whichDay: "📅 Which day works for your {label}?",
    noSlots: "Sorry, there are no free {label} slots in the next {days} days. Would you like our team to call you instead?",
    pickDay: "Please pick one of these days:",
    dayFull: "That day is now fully booked. Please pick another day:",
    whatTime: "⏰ What time suits you?",
    anotherDay: "↩ Another day",
    pickTime: "Please pick one of these times:",
    slotTaken: "Sorry, someone just took that time. Please pick another:",
    bookingName: "Great choice. May I have your name for the booking?",
    bookingPhone: "Thanks, {name}! Your mobile number, so we can confirm the {label}?",
    booked: "✅ Your {label} is booked for {when}.\n\nWe'll remind you on WhatsApp before it. Need to change it? Just message us here.",
    addToCalendar: "📅 Add it to your calendar: {link}",
    today: "Today",
    tomorrow: "Tomorrow",
  },
  hi: {
    askName: "मैं आपका वर्चुअल असिस्टेंट हूँ। क्या मैं आपका नाम जान सकता हूँ?",
    nameRetry: "कृपया अपना नाम लिखें (कम से कम 2 अक्षर):",
    askPhone: "आपसे मिलकर अच्छा लगा, {name}! 😊 क्या आप अपना मोबाइल नंबर बता सकते हैं?",
    phoneRetry: "⚠️ यह नंबर सही नहीं लग रहा। कृपया अपना 10 अंकों का मोबाइल नंबर लिखें (जैसे 98765 43210):",
    thanksOnline: "धन्यवाद, {name}! ✅ बताइए, मैं आपकी क्या मदद कर सकता हूँ?",
    thanksOffline: "धन्यवाद, {name}! ✅ हमारी टीम अभी ऑफ़लाइन है, वापस आते ही हम आपको {phone} पर कॉल करेंगे।\n\nतब तक, आप क्या जानना चाहेंगे?",
    welcomeBack: "फिर से स्वागत है, {name}! बताइए, मैं आपकी क्या मदद कर सकता हूँ?",
    mainMenu: "🔙 मुख्य मेन्यू",
    talkToHuman: "💬 किसी व्यक्ति से बात करें",
    bookButton: "📅 {label} बुक करें",
    whichDay: "📅 आपके {label} के लिए कौन सा दिन ठीक रहेगा?",
    noSlots: "माफ़ कीजिए, अगले {days} दिनों में {label} के लिए कोई खाली समय नहीं है। क्या हमारी टीम आपको कॉल करे?",
    pickDay: "कृपया इनमें से एक दिन चुनें:",
    dayFull: "वह दिन अब पूरी तरह बुक हो चुका है। कृपया दूसरा दिन चुनें:",
    whatTime: "⏰ आपके लिए कौन सा समय ठीक है?",
    anotherDay: "↩ दूसरा दिन",
    pickTime: "कृपया इनमें से एक समय चुनें:",
    slotTaken: "माफ़ कीजिए, यह समय अभी किसी और ने ले लिया। कृपया दूसरा समय चुनें:",
    bookingName: "बढ़िया! बुकिंग के लिए आपका नाम क्या है?",
    bookingPhone: "धन्यवाद, {name}! {label} कन्फ़र्म करने के लिए आपका मोबाइल नंबर?",
    booked: "✅ आपका {label} {when} के लिए बुक हो गया है।\n\nहम आपको WhatsApp पर पहले याद दिला देंगे। बदलाव करना हो तो यहीं मैसेज करें।",
    addToCalendar: "📅 अपने कैलेंडर में जोड़ें: {link}",
    today: "आज",
    tomorrow: "कल",
  },
} satisfies Record<BotLang, Record<string, string>>;

export type BotStringKey = keyof typeof STRINGS.en;

export function t(lang: BotLang, key: BotStringKey, vars: Record<string, string | number> = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

// Navigation words in every supported language, so a "Main Menu" button works
// whichever language the widget is in (and typed variants too).
const MAIN_MENU_WORDS = ["main menu", "start over", "go back", "मुख्य मेन्यू", "मेन्यू", "वापस", "शुरू से"];
export function isMainMenu(input: string): boolean {
  const s = input.trim().toLowerCase();
  return MAIN_MENU_WORDS.some((w) => s.includes(w));
}

const HUMAN_WORDS = ["talk to a human", "talk to human", "किसी व्यक्ति से बात"];
export function isTalkToHuman(input: string): boolean {
  const s = input.trim().toLowerCase();
  return HUMAN_WORDS.some((w) => s.includes(w));
}
