import type { CustomFlow } from "@/components/chatbot/flow-types";
import type { BookingConfig } from "@/lib/booking";

// One-click starting setups per industry: welcome message, menu flow, booking,
// proactive messages and starter FAQs. Everything stays editable afterwards.
// Placeholders the business should change are in [square brackets].
// No name/phone steps: the bot collects both from every visitor up front
// (identifyThenMenu in chatbot-flow.ts), so flows only ask what's specific.

export interface IndustryTemplate {
  key: string;
  name: string;
  emoji: string;
  description: string;
  welcomeMessage: string;
  customFlow: CustomFlow;
  booking: Partial<BookingConfig>;
  proactive: { enabled: boolean; message: string; urlContains: string; delaySeconds: number }[];
  faqs: { question: string; answer: string; isActive: boolean }[];
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    key: "real_estate",
    name: "Real estate",
    emoji: "🏠",
    description: "Builders, brokers and projects: price enquiries, site visits, home loans.",
    welcomeMessage: "👋 Welcome to [Project name]! I can share prices and floor plans, or book a site visit for you.",
    customFlow: {
      enabled: true,
      menuIntro: "What would you like to know?",
      flows: [
        {
          key: "pricing", label: "💰 Prices & floor plans", outcome: "CREATE_LEAD", leadType: "PRICE_ENQUIRY", leadScore: 70,
          closingMessage: "Thanks {{name}}! Our team will send the price list and floor plans for a {{config}} on WhatsApp shortly.",
          steps: [
            { question: "Which configuration are you looking for?", type: "choice", options: ["2 BHK", "3 BHK", "4 BHK", "Villa / Plot"], saveAs: "config", validate: "none" },
            { question: "What's your budget?", type: "choice", options: ["Under ₹75 L", "₹75 L – 1.5 Cr", "₹1.5 – 3 Cr", "Above ₹3 Cr"], saveAs: "budget", validate: "none" },
          ],
        },
        {
          key: "site_visit", label: "📍 Plan a site visit", outcome: "CREATE_LEAD", leadType: "SITE_VISIT", leadScore: 85,
          closingMessage: "Thanks {{name}}! We'll call you to confirm your visit.",
          steps: [],
        },
        {
          key: "loan", label: "🏦 Home loan help", outcome: "CREATE_LEAD", leadType: "HOME_LOAN", leadScore: 60,
          closingMessage: "Thanks {{name}}! Our loan desk will call you with eligible bank offers.",
          steps: [
            { question: "Are you salaried or self-employed?", type: "choice", options: ["Salaried", "Self-employed"], saveAs: "employment", validate: "none" },
          ],
        },
        { key: "human", label: "💬 Talk to a sales advisor", outcome: "ASSIGN_AGENT", closingMessage: "Connecting you to a sales advisor…", leadScore: 75, steps: [] },
      ],
    },
    booking: { enabled: true, label: "site visit", slotMinutes: 60, daysAhead: 10, capacity: 2, minNoticeHours: 3, triggerLabels: "Plan a site visit" },
    proactive: [
      { enabled: true, message: "Want the price list and floor plans? I can share them right here.", urlContains: "price", delaySeconds: 15 },
      { enabled: true, message: "Planning a site visit? I can book a slot for you in a minute.", urlContains: "", delaySeconds: 40 },
    ],
    faqs: [
      { question: "Is the project RERA registered?", answer: "Yes. RERA number: [RERA number]. You can verify it on the [State] RERA website.", isActive: true },
      { question: "When is possession?", answer: "Possession is planned for [Month Year].", isActive: true },
      { question: "Which banks offer home loans for this project?", answer: "[Bank names] have approved the project for home loans.", isActive: true },
    ],
  },
  {
    key: "clinic",
    name: "Clinic & hospital",
    emoji: "🩺",
    description: "Doctors, dental and specialty clinics: appointments, timings, fees.",
    welcomeMessage: "👋 Welcome to [Clinic name]. I can book an appointment or answer questions about timings and fees.",
    customFlow: {
      enabled: true,
      menuIntro: "How can we help you today?",
      flows: [
        {
          key: "appointment", label: "📅 Book an appointment", outcome: "CREATE_LEAD", leadType: "APPOINTMENT", leadScore: 85,
          closingMessage: "Thanks {{name}}! We'll confirm your appointment shortly.",
          steps: [
            { question: "Which department?", type: "choice", options: ["General physician", "Dental", "Skin", "Children", "Other"], saveAs: "department", validate: "none" },
          ],
        },
        {
          key: "reports", label: "🧾 Reports & prescriptions", outcome: "CREATE_TICKET", ticketSubject: "Report request: {{name}}",
          closingMessage: "Thanks {{name}}! Our front desk will send your report on WhatsApp.",
          steps: [],
        },
        { key: "emergency", label: "🚑 Emergency", outcome: "NONE", closingMessage: "For emergencies please call [emergency number] right away, or visit the nearest emergency room.", steps: [] },
        { key: "human", label: "💬 Talk to reception", outcome: "ASSIGN_AGENT", closingMessage: "Connecting you to reception…", steps: [] },
      ],
    },
    booking: { enabled: true, label: "appointment", slotMinutes: 15, daysAhead: 7, capacity: 1, minNoticeHours: 1, triggerLabels: "Book an appointment" },
    proactive: [{ enabled: true, message: "Need an appointment? I can book one for you in a minute.", urlContains: "", delaySeconds: 25 }],
    faqs: [
      { question: "What are your clinic timings?", answer: "We're open [days] from [time] to [time].", isActive: true },
      { question: "What is the consultation fee?", answer: "The consultation fee is ₹[amount].", isActive: true },
      { question: "Do you accept insurance?", answer: "We accept [insurers / cashless partners].", isActive: true },
    ],
  },
  {
    key: "salon",
    name: "Salon & spa",
    emoji: "💇",
    description: "Salons, spas and beauty studios: services, prices, slot booking.",
    welcomeMessage: "👋 Hi! Welcome to [Salon name]. Book a slot or check our services and prices.",
    customFlow: {
      enabled: true,
      menuIntro: "What can I help you with?",
      flows: [
        {
          key: "services", label: "✨ Services & prices", outcome: "CREATE_LEAD", leadType: "SERVICE_ENQUIRY", leadScore: 55,
          closingMessage: "Thanks {{name}}! We'll send you our price list for {{service}} on WhatsApp.",
          steps: [
            { question: "Which service?", type: "choice", options: ["Haircut & styling", "Hair colour", "Facial & skin", "Spa & massage", "Bridal"], saveAs: "service", validate: "none" },
          ],
        },
        { key: "book", label: "📅 Book a slot", outcome: "CREATE_LEAD", leadType: "BOOKING", leadScore: 80, closingMessage: "Thanks {{name}}!", steps: [] },
        {
          key: "bridal", label: "👰 Bridal & party packages", outcome: "CREATE_LEAD", leadType: "BRIDAL", leadScore: 85,
          closingMessage: "Thanks {{name}}! Our bridal consultant will call you.",
          steps: [{ question: "When is the event?", type: "text", options: [], saveAs: "eventDate", validate: "none" }],
        },
        { key: "human", label: "💬 Talk to us", outcome: "ASSIGN_AGENT", closingMessage: "Connecting you to our team…", steps: [] },
      ],
    },
    booking: { enabled: true, label: "salon appointment", slotMinutes: 30, daysAhead: 14, capacity: 3, minNoticeHours: 1, triggerLabels: "Book a slot" },
    proactive: [{ enabled: true, message: "Looking for a slot this week? I can book one for you now.", urlContains: "", delaySeconds: 20 }],
    faqs: [
      { question: "What are your timings?", answer: "We're open [days], [time] to [time].", isActive: true },
      { question: "Do you take walk-ins?", answer: "Yes, but booking a slot guarantees no wait.", isActive: true },
    ],
  },
  {
    key: "education",
    name: "Coaching & education",
    emoji: "🎓",
    description: "Coaching institutes, schools and courses: course info, fees, free demo class.",
    welcomeMessage: "👋 Welcome to [Institute name]! Ask me about courses and fees, or book a free demo class.",
    customFlow: {
      enabled: true,
      menuIntro: "What would you like to know?",
      flows: [
        {
          key: "courses", label: "📚 Courses & fees", outcome: "CREATE_LEAD", leadType: "COURSE_ENQUIRY", leadScore: 65,
          closingMessage: "Thanks {{name}}! A counsellor will share the {{course}} batch details and fees.",
          steps: [
            { question: "Which course are you interested in?", type: "choice", options: ["[Course 1]", "[Course 2]", "[Course 3]", "Not sure yet"], saveAs: "course", validate: "none" },
            { question: "Is this for you or for your child?", type: "choice", options: ["For me", "For my child"], saveAs: "forWhom", validate: "none" },
          ],
        },
        { key: "demo", label: "🎥 Book a free demo class", outcome: "CREATE_LEAD", leadType: "DEMO_CLASS", leadScore: 85, closingMessage: "Thanks {{name}}!", steps: [] },
        { key: "human", label: "💬 Talk to a counsellor", outcome: "ASSIGN_AGENT", closingMessage: "Connecting you to a counsellor…", steps: [] },
      ],
    },
    booking: { enabled: true, label: "demo class", slotMinutes: 60, daysAhead: 7, capacity: 10, minNoticeHours: 4, triggerLabels: "Book a free demo class" },
    proactive: [{ enabled: true, message: "Want to try a free demo class first? I can book one for you.", urlContains: "", delaySeconds: 30 }],
    faqs: [
      { question: "Do you offer online classes?", answer: "[Yes, live online batches are available / Classes are offline only].", isActive: true },
      { question: "Is there an EMI option for fees?", answer: "[Yes, EMI is available through ...].", isActive: true },
    ],
  },
  {
    key: "interiors",
    name: "Interiors & home services",
    emoji: "🛋️",
    description: "Interior designers, modular kitchens, renovation: quotes and free consultations.",
    welcomeMessage: "👋 Hi! Welcome to [Studio name]. Get an estimate or book a free design consultation.",
    customFlow: {
      enabled: true,
      menuIntro: "What are you planning?",
      flows: [
        {
          key: "estimate", label: "📐 Get an estimate", outcome: "CREATE_LEAD", leadType: "ESTIMATE", leadScore: 75,
          closingMessage: "Thanks {{name}}! Our designer will call you with a rough estimate for your {{scope}}.",
          steps: [
            { question: "What do you need?", type: "choice", options: ["Full home interiors", "Modular kitchen", "Wardrobes", "Renovation"], saveAs: "scope", validate: "none" },
            { question: "Property type?", type: "choice", options: ["1 BHK", "2 BHK", "3 BHK", "Villa / Office"], saveAs: "property", validate: "none" },
          ],
        },
        { key: "consult", label: "🗓️ Free design consultation", outcome: "CREATE_LEAD", leadType: "CONSULTATION", leadScore: 85, closingMessage: "Thanks {{name}}!", steps: [] },
        { key: "human", label: "💬 Talk to a designer", outcome: "ASSIGN_AGENT", closingMessage: "Connecting you to a designer…", steps: [] },
      ],
    },
    booking: { enabled: true, label: "design consultation", slotMinutes: 45, daysAhead: 10, capacity: 2, minNoticeHours: 4, triggerLabels: "Free design consultation" },
    proactive: [{ enabled: true, message: "Want a quick estimate for your home? Answer 3 questions here.", urlContains: "", delaySeconds: 25 }],
    faqs: [
      { question: "How long does a full home take?", answer: "Typically [X–Y] weeks after design sign-off.", isActive: true },
      { question: "Do you offer a warranty?", answer: "Yes, [X] years on [modular work / hardware].", isActive: true },
    ],
  },
];
