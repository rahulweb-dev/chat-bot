import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Fraunces, Work_Sans } from "next/font/google";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Plan from "@/models/Plan";
import { PLAN_FEATURES, formatMoney } from "@/lib/plan-display";
import { FREE_LIMITS } from "@/lib/plan-limits";
import { ChatDemo } from "@/components/marketing/chat-demo";
import {
  Check, FileText, CalendarCheck, MessageCircle, TrendingUp, Megaphone, Users, ArrowRight, Code2, BookOpen, BellRing,
} from "lucide-react";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fraunces" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-work-sans" });

export const metadata: Metadata = {
  title: { absolute: "Convo360 · AI chat that turns website visitors into leads" },
  description:
    "An AI assistant for your website that answers from your own brochures and pages, books site visits and appointments, and sends every new lead to your WhatsApp.",
};

type PublicPlan = { _id: string; type: string; name: string; description?: string; price: { monthly: number; annually: number }; currency?: string; features?: string[]; isPopular?: boolean };

async function getPlans(): Promise<PublicPlan[]> {
  try {
    await connectDB();
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 }).lean<PublicPlan[]>();
    return plans.filter((p) => p.price?.monthly > 0).map((p) => ({ ...p, _id: String(p._id) }));
  } catch {
    return []; // the page still renders; pricing shows a contact line instead
  }
}

const FEATURES = [
  { icon: FileText, title: "Answers from your own documents", body: "Upload brochures, price lists and FAQs, or point it at your website. The AI answers only from them and shows which document each answer came from. If it doesn't know, it offers a person." },
  { icon: CalendarCheck, title: "Site visits and appointments, booked in chat", body: "Visitors pick a free slot from your business hours. You set the length, how many per slot and how far ahead. They get a calendar link and a WhatsApp reminder." },
  { icon: MessageCircle, title: "Every lead on your WhatsApp", body: "Name, number, what they asked about and where they came from, on your phone seconds after they share it. Reply before they open a competitor's site." },
  { icon: TrendingUp, title: "Know which ad brought each lead", body: "Google Ads, Facebook, Instagram, organic search or a property portal: every lead carries its source, and analytics shows which channel books visits." },
  { icon: Megaphone, title: "Starts the conversation for you", body: "Spent 20 seconds on your pricing page? The chat asks if they'd like the price list. Set different messages for different pages." },
  { icon: Users, title: "Hand over to your team", body: "Visitors can ask for a person at any time. Chats are assigned to whoever is free, with the full conversation in a shared inbox." },
];

const STEPS = [
  { icon: BookOpen, title: "Teach it your business", body: "Add your website, brochures and FAQs. It reads up to 25 pages of your site in one go." },
  { icon: Code2, title: "Paste one line of code", body: "Works on WordPress, Wix, Shopify, Webflow or any custom site. It matches your brand colors." },
  { icon: BellRing, title: "Leads come to you", body: "On WhatsApp, in your dashboard, and by email, with bookings already in the calendar." },
];

const FAQ = [
  { q: "Do I need a developer?", a: "No. Copy one line from your dashboard into your website's header. If your site runs on WordPress or Wix, it takes about two minutes." },
  { q: "Will the AI make things up?", a: "It answers only from the documents and pages you give it, and names the source. When your content doesn't cover a question, it says so and offers to connect the visitor to your team." },
  { q: "Which languages does it speak?", a: "AI answers come back in the visitor's language, including Hindi and other Indian languages, as long as your documents contain the answer." },
  { q: "What happens when the trial ends?", a: `Nothing is deleted. Your account moves to a free tier with ${FREE_LIMITS.chats} chats a month so your website never shows a broken chat, and you can choose a plan any time.` },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "SUPER_ADMIN") redirect("/admin");
    redirect("/dashboard");
  }

  const plans = await getPlans();
  const demoKey = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <div className={`${fraunces.variable} ${workSans.variable} min-h-screen bg-[#F3F2EE] text-[#15140F]`} style={{ fontFamily: "var(--font-work-sans), system-ui, sans-serif" }}>
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#F3F2EE]/85 backdrop-blur border-b border-[#15140F]/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <Image src="/app_icon.png" alt="" width={32} height={32} className="rounded-full" priority />
            Convo360
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-[#454337]">
            <a href="#features" className="hover:text-[#15140F]">Features</a>
            <a href="#how" className="hover:text-[#15140F]">How it works</a>
            <a href="#pricing" className="hover:text-[#15140F]">Pricing</a>
            <a href="#faq" className="hover:text-[#15140F]">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm font-medium px-3 py-2 rounded-full hover:bg-[#15140F]/5">Log in</Link>
            <Link href="/register" className="text-sm font-semibold px-4 py-2 rounded-full bg-[#15140F] text-white hover:bg-[#2A281F]">Start free trial</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 lg:pt-20 grid lg:grid-cols-[1.1fr_1fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4f46e5] bg-[#4f46e5]/8 px-3 py-1.5 rounded-full">
              Website chat + WhatsApp, built for India
            </p>
            <h1 className="font-display text-[2.6rem] sm:text-6xl font-semibold leading-[1.03] tracking-tight mt-6 text-balance">
              Every visitor gets an answer. <span className="text-[#4f46e5]">Every lead</span> reaches your WhatsApp.
            </h1>
            <p className="mt-6 text-lg text-[#454337] leading-relaxed max-w-xl">
              Convo360 puts an AI assistant on your website that answers from your own brochures and pages, books site visits into
              free slots, and sends each new lead to your phone with the ad that brought them.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#4f46e5] text-white font-semibold hover:bg-[#4338ca] shadow-[0_10px_30px_-10px_rgba(79,70,229,.7)]">
                Start your 14-day free trial <ArrowRight className="w-4 h-4" />
              </Link>
              {demoKey ? (
                <span className="text-sm text-[#716F66]">or try the chat in the corner of this page</span>
              ) : (
                <a href="#how" className="px-5 py-3.5 rounded-full font-semibold text-[#15140F] ring-1 ring-[#15140F]/15 hover:bg-white">See how it works</a>
              )}
            </div>
            <p className="mt-4 text-sm text-[#716F66]">No card needed. Set up in about 10 minutes.</p>
          </div>
          <div className="pb-6 lg:pb-0">
            <ChatDemo />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-[#15140F] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance">Live on your website this afternoon</h2>
            <ol className="mt-12 grid md:grid-cols-3 gap-10">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="font-display text-6xl font-semibold text-white/15 leading-none">{i + 1}</span>
                  <div className="mt-3 flex items-center gap-2.5">
                    <s.icon className="w-5 h-5 text-[#a5b4fc]" />
                    <h3 className="text-lg font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-white/70 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight max-w-2xl text-balance">
            Built for businesses where one lead is worth a lot
          </h2>
          <p className="mt-4 text-[#454337] max-w-2xl leading-relaxed">
            Real estate, clinics, coaching, dealerships, interiors. When a single enquiry can be worth lakhs, a visitor who leaves without
            an answer is money walking out.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <div className="w-11 h-11 rounded-xl bg-white ring-1 ring-[#15140F]/8 grid place-items-center">
                  <f.icon className="w-5 h-5 text-[#4f46e5]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-snug">{f.title}</h3>
                <p className="mt-2 text-[15px] text-[#454337] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-14 text-sm text-[#716F66]">
            Also included: WhatsApp, email and RCS campaigns, tickets, a lead CRM, team departments and analytics.
          </p>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-white border-y border-[#15140F]/8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Simple pricing</h2>
            <p className="mt-3 text-[#454337]">Every plan starts with a 14-day free trial. Pay monthly or yearly by UPI, card or netbanking.</p>
            {plans.length ? (
              <div className="mt-12 grid md:grid-cols-3 gap-6 items-start">
                {plans.map((p) => {
                  const features = p.features?.length ? p.features : PLAN_FEATURES[p.type] ?? [];
                  const cur = p.currency || "INR";
                  return (
                    <div key={p._id} className={`rounded-3xl p-7 ${p.isPopular ? "bg-[#15140F] text-white ring-0 md:-translate-y-3 shadow-2xl" : "bg-[#F7F6F2] ring-1 ring-[#15140F]/8"}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{p.name}</h3>
                        {p.isPopular && <span className="text-[11px] font-bold uppercase tracking-wider bg-[#4f46e5] text-white px-2.5 py-1 rounded-full">Most popular</span>}
                      </div>
                      <p className="mt-5">
                        <span className="font-display text-4xl font-semibold tabular-nums">{formatMoney(p.price.monthly, cur)}</span>
                        <span className={p.isPopular ? "text-white/60" : "text-[#716F66]"}> /month</span>
                      </p>
                      {p.price.annually > 0 && (
                        <p className={`text-sm mt-1 ${p.isPopular ? "text-white/60" : "text-[#716F66]"}`}>or {formatMoney(p.price.annually, cur)} a year</p>
                      )}
                      <ul className="mt-6 space-y-2.5">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-[15px]">
                            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${p.isPopular ? "text-[#a5b4fc]" : "text-[#4f46e5]"}`} />{f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/register"
                        className={`mt-8 block text-center font-semibold py-3 rounded-full ${p.isPopular ? "bg-[#4f46e5] text-white hover:bg-[#4338ca]" : "bg-[#15140F] text-white hover:bg-[#2A281F]"}`}
                      >
                        Start free trial
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-8 text-[#454337]">Plans are being updated. <Link href="/register" className="underline font-medium">Start a free trial</Link> and choose one later.</p>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-[#15140F]/10 border-y border-[#15140F]/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-center justify-between cursor-pointer list-none text-lg font-medium">
                  {f.q}
                  <span className="text-[#4f46e5] text-2xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-[#454337] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <div className="rounded-[32px] bg-[#4f46e5] text-white px-8 py-14 sm:px-14 grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance">Your next lead is on your website right now.</h2>
              <p className="mt-3 text-white/80 max-w-xl">Give them an answer in seconds, and get their number on your WhatsApp.</p>
            </div>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-white text-[#15140F] font-semibold hover:bg-[#F3F2EE]">
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#15140F]/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-[#716F66]">
          <p>© {new Date().getFullYear()} Convo360</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-[#15140F]">Log in</Link>
            <Link href="/register" className="hover:text-[#15140F]">Sign up</Link>
          </div>
        </div>
      </footer>

      {/* Live demo bot: set NEXT_PUBLIC_DEMO_WIDGET_KEY to a demo company's widget key. */}
      {demoKey && (
        // One script so the config is guaranteed to exist before widget.js runs.
        <Script id="convo360-demo-widget" strategy="afterInteractive">
          {`window.SupportFlowConfig = { apiKey: ${JSON.stringify(demoKey)}, baseUrl: ${JSON.stringify(appUrl)} };
var s = document.createElement("script"); s.src = "/widget.js"; s.async = true; document.body.appendChild(s);`}
        </Script>
      )}
    </div>
  );
}
