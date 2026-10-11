"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// The hero's moving picture: a real-estate visitor asks a price, the bot answers
// from the brochure with its source, books a site visit, and the owner's phone
// gets the WhatsApp alert. Every beat is something the product actually does.
type Beat =
  | { kind: "visitor" | "bot"; text: string; source?: string }
  | { kind: "chips"; chips: string[]; picked: number }
  | { kind: "alert" };

const BEATS: Beat[] = [
  { kind: "visitor", text: "What's the price of a 3 BHK?" },
  { kind: "bot", text: "Our 3 BHK homes start at ₹1.2 Cr, with 1,850 sq ft carpet area and two covered parking spots.", source: "Price list – Tower B" },
  { kind: "chips", chips: ["📅 Book a site visit", "Floor plans", "Talk to a person"], picked: 0 },
  { kind: "bot", text: "📅 Which day works for your site visit?" },
  { kind: "chips", chips: ["Tomorrow", "Wednesday", "Thursday"], picked: 0 },
  { kind: "chips", chips: ["10:00 AM", "11:00 AM", "4:00 PM"], picked: 1 },
  { kind: "bot", text: "✅ Your site visit is booked for tomorrow at 11:00 AM. We'll remind you on WhatsApp." },
  { kind: "alert" },
];

export function ChatDemo() {
  const [shown, setShown] = useState(1);
  // Reduced motion: show the whole conversation at once, no looping.
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setShown((n) => (n >= BEATS.length + 3 ? 1 : n + 1)), shown === BEATS.length ? 3200 : 1500);
    return () => clearTimeout(t);
  }, [shown, reduced]);

  const visible = reduced ? BEATS : BEATS.slice(0, Math.min(shown, BEATS.length));
  const alertOn = visible.some((b) => b.kind === "alert");

  return (
    <div className="relative mx-auto w-full max-w-[380px]" aria-label="Example conversation: a visitor asks a price and books a site visit" role="img">
      <div className="rounded-[26px] bg-white shadow-[0_30px_70px_-30px_rgba(21,20,15,.45)] ring-1 ring-[#15140F]/10 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#4f46e5] text-white">
          <div className="w-9 h-9 rounded-full bg-white/20 grid place-items-center text-sm font-bold">N</div>
          <div className="leading-tight">
            <p className="font-semibold text-[15px]">Nexora Residences</p>
            <p className="text-xs text-white/80 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-300" />Replies instantly</p>
          </div>
        </div>
        <div className="h-[390px] bg-[#F7F6F2] px-3.5 py-4 flex flex-col justify-end gap-2.5 overflow-hidden">
          {visible.map((b, i) => {
            if (b.kind === "alert") return null;
            if (b.kind === "chips") {
              return (
                <div key={i} className="flex flex-wrap gap-1.5 demo-in">
                  {b.chips.map((c, j) => (
                    <span
                      key={c}
                      className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-full ${j === b.picked ? "bg-[#4f46e5] text-white" : "bg-white text-[#4f46e5] ring-1 ring-[#4f46e5]/25"}`}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              );
            }
            const me = b.kind === "visitor";
            return (
              <div key={i} className={`demo-in max-w-[84%] text-[13.5px] leading-snug px-3.5 py-2.5 rounded-2xl ${me ? "self-end bg-[#4f46e5] text-white rounded-br-md" : "self-start bg-white text-[#15140F] ring-1 ring-black/5 rounded-bl-md"}`}>
                {b.text}
                {b.source && <span className="block mt-1.5 text-[11.5px] text-[#716F66]">📄 Source: {b.source}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* The owner's phone: WhatsApp alert the moment the visit is booked */}
      <div
        className={`absolute -left-6 sm:-left-16 -bottom-8 w-[250px] rounded-2xl bg-[#15140F] text-white p-3.5 shadow-2xl transition-all duration-500 ${alertOn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        aria-hidden={!alertOn}
      >
        <p className="text-[11px] uppercase tracking-wider text-[#25D366] font-semibold">WhatsApp · now</p>
        <p className="text-sm font-semibold mt-1">🎯 New lead: Priya</p>
        <p className="text-xs text-white/75 mt-0.5 leading-relaxed">📞 98765 43210<br />Site visit · tomorrow 11:00 AM<br />📍 from Google Ads</p>
      </div>
    </div>
  );
}
