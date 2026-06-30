"use client";
import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Loader2, Mail, Lock, ArrowRight,
  TrendingUp, Users, Bot, Zap, CheckCircle2,
  Clock, Star, Eye, EyeOff, Check,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

/* ─── Animated counter ─── */
function CountUp({ to, prefix = "", suffix = "", duration = 1400, delay = 0 }: {
  to: number; prefix?: string; suffix?: string; duration?: number; delay?: number;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [to, duration, delay]);
  return <>{prefix}{val}{suffix}</>;
}

/* ─── Floater data ─── */
const FLOATERS = [
  { icon: Star,          label: "Satisfaction", num: 98,  suffix: "%",  color: "from-violet-500 to-purple-600",  top: "8%",    left: "-8%",   delay: 0   },
  { icon: MessageSquare, label: "Messages",     num: 12,  suffix: "M+", color: "from-cyan-500 to-blue-600",      top: "30%",   right: "-10%", delay: 0.4 },
  { icon: Bot,           label: "AI Resolved",  num: 93,  suffix: "%",  color: "from-emerald-500 to-teal-600",   bottom: "28%",left: "-9%",   delay: 0.8 },
  { icon: Clock,         label: "Avg Reply",    num: 14,  suffix: "s",  color: "from-orange-400 to-rose-500",    bottom: "10%",right: "-8%",  delay: 1.2 },
];

/* FIX 1 — light-mode stat pill (was dark, invisible on white bg) */
function StatPill({ icon: Icon, label, num, suffix, color, countDelay = 0 }: {
  icon: React.ElementType; label: string; num: number; suffix: string; color: string; countDelay?: number;
}) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-2xl px-3 py-2.5">
      <div className={`w-7 h-7 rounded-xl bg-linear-to-br ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <div>
        <p className="text-gray-900 text-sm font-bold leading-none">
          <CountUp to={num} suffix={suffix} delay={countDelay} />
        </p>
        <p className="text-gray-400 text-[10px] mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ─── Dashboard mockup ─── */
const DASH_STATS = [
  { label: "Active Chats", num: 247, prefix: "",  suffix: "",  icon: MessageSquare, up: true  },
  { label: "Revenue",      num: 84,  prefix: "₹", suffix: "K", icon: TrendingUp,    up: true  },
  { label: "Team Online",  num: 18,  prefix: "",  suffix: "",  icon: Users,         up: false },
];

function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8 }}
      className="relative w-full max-w-lg mx-auto flex-1 min-h-0 overflow-hidden"
    >
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 mx-3 h-5 rounded-md bg-white/8 text-[10px] text-slate-500 flex items-center px-2">
            app.supportflow.ai/dashboard
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {DASH_STATS.map((s, i) => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <s.icon className="w-3 h-3 text-slate-400" />
                  <span className={`text-[9px] font-medium ${s.up ? "text-emerald-400" : "text-slate-400"}`}>{s.up ? "↑" : "→"}</span>
                </div>
                <p className="text-white font-bold text-sm">
                  <CountUp to={s.num} prefix={s.prefix} suffix={s.suffix} delay={800 + i * 100} duration={1200} />
                </p>
                <p className="text-slate-500 text-[9px]">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-white/5 border border-white/8 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-medium">Conversations</span>
              <span className="text-emerald-400 text-[10px]">+24% this week</span>
            </div>
            <div className="flex items-end gap-1 h-12">
              {[40,65,45,80,55,90,70,85,60,95,75,100].map((h, i) => (
                <motion.div key={i} initial={{ height:0 }} animate={{ height:`${h}%` }}
                  transition={{ delay:0.8+i*0.04, duration:0.4 }}
                  className="flex-1 rounded-sm"
                  style={{ background:`hsl(${250+i*3},80%,${55+h*0.2}%)`, opacity:0.7+h*0.003 }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/8 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-medium">Live Conversations</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {[
              { name:"Priya Sharma", msg:"I need help with my order...", time:"now", color:"bg-violet-500" },
              { name:"Rahul Verma",  msg:"When will my refund arrive?",  time:"2m",  color:"bg-cyan-500"   },
              { name:"Anjali Singh", msg:"The app crashes on startup",   time:"5m",  color:"bg-orange-500" },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${c.color} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{c.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-medium">{c.name}</p>
                  <p className="text-slate-500 text-[9px] truncate">{c.msg}</p>
                </div>
                <span className="text-slate-600 text-[9px] shrink-0">{c.time}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-linear-to-r from-violet-500/15 to-cyan-500/15 border border-violet-500/20 p-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[10px] font-medium">AI resolved 18 tickets today</p>
              <p className="text-slate-500 text-[9px]">Saved 4.2 hrs of agent time</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
        </div>
      </div>
      {/* xl floating cards */}
      {FLOATERS.map((f, i) => (
        <motion.div key={i}
          initial={{ opacity:0, scale:0.8 }}
          animate={{ opacity:1, scale:1, y:[0,-8,0] }}
          transition={{ delay:f.delay+1, duration:0.5, y:{ duration:3+i*0.5, repeat:Infinity, ease:"easeInOut", delay:f.delay } }}
          className="absolute hidden xl:flex items-center gap-2 bg-[#0a0f1e]/80 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-2 shadow-xl"
          style={{ top:f.top, bottom:f.bottom, left:f.left, right:f.right } as React.CSSProperties}
        >
          <div className={`w-7 h-7 rounded-xl bg-linear-to-br ${f.color} flex items-center justify-center shrink-0`}>
            <f.icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-none">
              <CountUp to={f.num} suffix={f.suffix} delay={(f.delay+1)*1000} duration={1000} />
            </p>
            <p className="text-slate-400 text-[9px] mt-0.5">{f.label}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Login form ─── */
function LoginInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") || "/dashboard";

  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  /* FIX 5 — watch field values for valid/filled icon state */
  const { register, handleSubmit, watch, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });
  const emailVal    = watch("email",    "");
  const passwordVal = watch("password", "");
  const emailValid    = !!emailVal    && !errors.email;
  const passwordValid = !!passwordVal && !errors.password;

  const iconColor = (field: string, valid: boolean) =>
    focused === field ? "text-violet-500" : valid ? "text-emerald-500" : "text-gray-400";

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      if (!result) {
        setError("No response from server");
      } else if (result.error) {
        const known: Record<string,string> = {
          CredentialsSignin: "Invalid email or password",
          CallbackRouteError: "Invalid email or password",
        };
        setError(known[result.error] ?? `Error: ${result.error}`);
      } else {
        setSuccess(true);
        await new Promise((r) => setTimeout(r, 1300));
        router.refresh();
        router.push(callbackUrl);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ══ LEFT dark panel ══ */}
      <motion.div initial={{ opacity:0, x:-40 }} animate={{ opacity:1, x:0 }} transition={{ duration:.8 }}
        className="hidden lg:flex lg:w-[58%] xl:w-[60%] h-full flex-col justify-between px-10 xl:px-16 py-8 xl:py-10 relative overflow-hidden bg-[#020617]"
      >
        {/* bg layers */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage:"radial-gradient(circle at 20% 50%,rgba(124,58,237,.15) 0%,transparent 60%),radial-gradient(circle at 80% 20%,rgba(6,182,212,.12) 0%,transparent 55%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage:"linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)", backgroundSize:"40px 40px" }} />
        <motion.div animate={{ scale:[1,1.15,1], opacity:[.15,.25,.15] }} transition={{ duration:8, repeat:Infinity }}
          className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
        <motion.div animate={{ scale:[1,1.2,1], opacity:[.08,.18,.08] }} transition={{ duration:10, repeat:Infinity, delay:2 }}
          className="absolute -bottom-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none" />

        {/* FIX 4 — gradient fade separator on right edge */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-linear-to-b from-transparent via-white/12 to-transparent z-20 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/40">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SupportFlow</span>
        </div>

        {/* Hero */}
        <div className="flex flex-col flex-1 min-h-0 justify-center gap-6 overflow-hidden relative z-10">
          <div className="space-y-4 shrink-0">
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3 }}
              className="inline-flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 rounded-full px-4 py-1.5"
            >
              <Zap className="w-3 h-3 text-violet-400" />
              <span className="text-violet-300 text-xs font-medium tracking-wide">AI-Powered Platform</span>
            </motion.div>
            <motion.h1 initial={{ opacity:0, y:15 }} animate={{ opacity:1, y:0 }} transition={{ delay:.4 }}
              className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight"
            >
              Customer<br />Conversations,<br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-cyan-400 to-indigo-400">
                Powered by AI.
              </span>
            </motion.h1>
            <motion.p initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.5 }}
              className="text-slate-400 text-base max-w-md leading-relaxed"
            >
              Unify WhatsApp, email, and live chat. Automate with AI. Delight every customer.
            </motion.p>
          </div>
          <DashboardMockup />
        </div>

        {/* FIX 6 — testimonial card replaces trust strip */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.4 }}
          className="shrink-0 relative z-10"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-start gap-3 mb-2.5">
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">A</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-none">Arjun Mehta</p>
                <p className="text-slate-400 text-xs mt-0.5">Head of CX · Groww</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
              </div>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              "SupportFlow cut our response time by 60%. The AI handles 90% of queries automatically — our team finally focuses on what matters."
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* ══ RIGHT white panel ══ */}
      <motion.div initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} transition={{ duration:.8, delay:.1 }}
        className="flex-1 h-full flex items-center justify-center p-4 sm:p-6 lg:p-10 overflow-y-auto relative bg-white"
      >
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ backgroundImage:"radial-gradient(circle,#e2e8f0 1px,transparent 1px)", backgroundSize:"24px 24px" }} />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-100 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-sky-100 blur-[70px] pointer-events-none" />

        <div className="w-full max-w-[400px] relative z-10">

          {/* Mobile hero — FIX 1 stat pills now use light theme */}
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:.2 }}
            className="lg:hidden mb-6 text-center"
          >
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/30">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-900 font-bold text-lg">SupportFlow</span>
            </div>
            <p className="text-gray-500 text-sm mb-4">AI-powered customer engagement</p>
            <div className="grid grid-cols-2 gap-2 max-w-[280px] mx-auto">
              {FLOATERS.map((f, i) => (
                <StatPill key={f.label} icon={f.icon} label={f.label} num={f.num} suffix={f.suffix} color={f.color} countDelay={400 + i * 150} />
              ))}
            </div>
          </motion.div>

          {/* Card */}
          <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3, duration:.6 }}
            className="relative rounded-3xl border border-gray-100 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            {/* FIX 3 — top accent stripe */}
            <div className="absolute top-0 inset-x-0 h-[3px] bg-linear-to-r from-violet-500 via-purple-500 to-cyan-500" />

            <div className="p-8 pt-10">
              {/* Success overlay */}
              <AnimatePresence>
                {success && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm rounded-3xl z-20"
                  >
                    <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                      transition={{ type:"spring", stiffness:220, damping:14, delay:.1 }}
                      className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-100"
                    >
                      <Check className="w-8 h-8 text-emerald-500" />
                    </motion.div>
                    <motion.p initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35 }}
                      className="text-gray-900 font-semibold text-lg"
                    >Signing you in…</motion.p>
                    <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.5 }}
                      className="text-gray-400 text-sm mt-1"
                    >Redirecting to dashboard</motion.p>
                    <motion.div initial={{ width:0 }} animate={{ width:"55%" }}
                      transition={{ delay:.6, duration:.7, ease:"easeInOut" }}
                      className="h-1 bg-linear-to-r from-violet-500 to-cyan-500 rounded-full mt-5"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* FIX 2 — removed duplicate mobile logo that was inside card */}

              {/* Heading */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-1 text-transparent bg-clip-text bg-linear-to-r from-violet-600 to-indigo-600">
                  Welcome back
                </h2>
                <p className="text-gray-400 text-sm">Sign in to your workspace</p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity:0, y:-8, height:0 }} animate={{ opacity:1, y:0, height:"auto" }} exit={{ opacity:0, y:-8, height:0 }}
                    className="mb-5 flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-gray-700 text-sm font-medium">Email address</label>
                  <div className={`relative rounded-2xl transition-all duration-200 ${
                    errors.email ? "ring-2 ring-red-300" : focused === "email" ? "ring-2 ring-violet-400" : emailValid ? "ring-2 ring-emerald-300" : ""
                  }`}>
                    {/* FIX 5 — icon turns green when field is valid */}
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors duration-200 ${iconColor("email", emailValid)}`} />
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      autoFocus
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      className="w-full h-13 pl-11 pr-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 text-sm outline-none focus:bg-white focus:border-violet-400 transition-all"
                    />
                  </div>
                  <AnimatePresence>
                    {errors.email && (
                      <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                        className="text-red-500 text-xs pl-1"
                      >{errors.email.message}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-700 text-sm font-medium">Password</label>
                    <Link href="/forgot-password" className="text-violet-600 text-xs hover:text-violet-700 font-medium transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <div className={`relative rounded-2xl transition-all duration-200 ${
                    errors.password ? "ring-2 ring-red-300" : focused === "password" ? "ring-2 ring-violet-400" : passwordValid ? "ring-2 ring-emerald-300" : ""
                  }`}>
                    {/* FIX 5 — icon turns green when valid */}
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10 transition-colors duration-200 ${iconColor("password", passwordValid)}`} />
                    <input
                      {...register("password")}
                      type={showPw ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                      className="w-full h-13 pl-11 pr-11 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 text-sm outline-none focus:bg-white focus:border-violet-400 transition-all"
                    />
                    <button type="button" onClick={() => setShowPw((p) => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {errors.password && (
                      <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                        className="text-red-500 text-xs pl-1"
                      >{errors.password.message}</motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* FIX 7 — shimmer button */}
                <motion.button type="submit" disabled={loading || success}
                  whileHover={{ scale: loading || success ? 1 : 1.02, boxShadow: loading || success ? undefined : "0 8px 24px rgba(124,58,237,0.35)" }}
                  whileTap={{ scale: loading || success ? 1 : 0.98 }}
                  className="relative w-full h-13 rounded-2xl bg-linear-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 mt-1 shadow-md shadow-violet-500/20 disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden group transition-all"
                >
                  <span className="absolute inset-0 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-700 ease-in-out bg-linear-to-r from-transparent via-white/20 to-transparent -skew-x-12 pointer-events-none" />
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1 font-medium whitespace-nowrap">
                  or continue with
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* OAuth */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:"Google", svg:<svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> },
                  { label:"Microsoft", svg:<svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/><path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/></svg> },
                ].map((p) => (
                  <motion.button key={p.label} type="button"
                    whileHover={{ scale:1.02 }} whileTap={{ scale:.98 }}
                    className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm transition-all"
                  >
                    {p.svg}{p.label}
                  </motion.button>
                ))}
              </div>

              <p className="text-center text-gray-400 text-sm mt-6">
                No account?{" "}
                <Link href="/register" className="text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                  Create one free
                </Link>
              </p>
            </div>
          </motion.div>

          <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.9 }}
            className="text-center text-gray-400 text-xs mt-5"
          >
            By signing in you agree to our{" "}
            <span className="text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">Terms</span>
            {" & "}
            <span className="text-gray-500 hover:text-gray-700 cursor-pointer transition-colors">Privacy Policy</span>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}
