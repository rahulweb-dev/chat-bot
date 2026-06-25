"use client";
import { Suspense, useState } from "react";
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
  Clock, Star,
} from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}

/* ─── Floating stat cards ─── */
const FLOATERS = [
  { icon: Star,        label: "Customer Satisfaction", value: "98%",   color: "from-violet-500 to-purple-600",  top: "8%",   left: "-8%",  delay: 0    },
  { icon: MessageSquare, label: "Messages Processed",  value: "12M+",  color: "from-cyan-500 to-blue-600",      top: "30%",  right: "-10%", delay: 0.4 },
  { icon: Bot,         label: "AI Resolved",           value: "93%",   color: "from-emerald-500 to-teal-600",   bottom: "28%", left: "-9%", delay: 0.8 },
  { icon: Clock,       label: "Avg Reply Time",        value: "14 sec", color: "from-orange-400 to-rose-500",   bottom: "10%", right: "-8%", delay: 1.2 },
];

/* ─── Dashboard illustration ─── */
function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.8 }}
      className="relative w-full max-w-lg mx-auto"
    >
      {/* Main card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
        {/* Topbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="flex-1 mx-3 h-5 rounded-md bg-white/8 text-[10px] text-slate-500 flex items-center px-2">app.supportflow.ai/dashboard</div>
        </div>

        <div className="p-4 space-y-3">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Active Chats", value: "247", icon: MessageSquare, up: true },
              { label: "Revenue", value: "₹84K", icon: TrendingUp, up: true },
              { label: "Team Online", value: "18", icon: Users, up: false },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/8 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <s.icon className="w-3 h-3 text-slate-400" />
                  <span className={`text-[9px] font-medium ${s.up ? "text-emerald-400" : "text-slate-400"}`}>{s.up ? "↑" : "→"}</span>
                </div>
                <p className="text-white font-bold text-sm">{s.value}</p>
                <p className="text-slate-500 text-[9px]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-xl bg-white/5 border border-white/8 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-medium">Conversations</span>
              <span className="text-emerald-400 text-[10px]">+24% this week</span>
            </div>
            <div className="flex items-end gap-1 h-12">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.8 + i * 0.04, duration: 0.4 }}
                  className="flex-1 rounded-sm"
                  style={{ background: `hsl(${250 + i * 3}, 80%, ${55 + h * 0.2}%)`, opacity: 0.7 + h * 0.003 }}
                />
              ))}
            </div>
          </div>

          {/* Conversations */}
          <div className="rounded-xl bg-white/5 border border-white/8 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-medium">Live Conversations</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {[
              { name: "Priya Sharma",    msg: "I need help with my order...", time: "now",   color: "bg-violet-500" },
              { name: "Rahul Verma",     msg: "When will my refund arrive?",  time: "2m",    color: "bg-cyan-500" },
              { name: "Anjali Singh",    msg: "The app crashes on startup",   time: "5m",    color: "bg-orange-500" },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full ${c.color} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                  {c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-medium">{c.name}</p>
                  <p className="text-slate-500 text-[9px] truncate">{c.msg}</p>
                </div>
                <span className="text-slate-600 text-[9px] shrink-0">{c.time}</span>
              </div>
            ))}
          </div>

          {/* AI row */}
          <div className="rounded-xl bg-linear-to-r from-violet-500/15 to-cyan-500/15 border border-violet-500/20 p-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[10px] font-medium">AI Assistant resolved 18 tickets</p>
              <p className="text-slate-500 text-[9px]">Saved 4.2 hrs of agent time today</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Floating stat cards */}
      {FLOATERS.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{ delay: f.delay + 1, duration: 0.5, y: { duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: f.delay } }}
          className="absolute hidden xl:flex items-center gap-2 bg-white/8 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-2 shadow-xl"
          style={{ top: f.top, bottom: f.bottom, left: f.left, right: f.right }}
        >
          <div className={`w-7 h-7 rounded-xl bg-linear-to-br ${f.color} flex items-center justify-center shrink-0`}>
            <f.icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-none">{f.value}</p>
            <p className="text-slate-400 text-[9px] mt-0.5">{f.label}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Main login page ─── */
function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      if (!result) {
        setError("No response from server");
      } else if (result.error) {
        const known: Record<string, string> = {
          CredentialsSignin: "Invalid email or password",
          CallbackRouteError: "Invalid email or password",
        };
        setError(known[result.error] ?? `Error: ${result.error}`);
      } else {
        router.refresh();
        router.push(callbackUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex overflow-hidden relative">

      {/* Global background noise + grid */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(6,182,212,0.10) 0%, transparent 55%), radial-gradient(circle at 60% 80%, rgba(79,70,229,0.08) 0%, transparent 50%)" }}
      />
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      {/* Animated blobs */}
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none z-0" />
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/15 blur-[100px] pointer-events-none z-0" />
      <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 30, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="fixed top-[40%] left-[30%] w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[80px] pointer-events-none z-0" />

      {/* ── LEFT hero panel ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-[60%] xl:w-[62%] flex-col justify-between px-12 xl:px-20 py-12 relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-600/40">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">SupportFlow</span>
        </div>

        {/* Hero text + illustration */}
        <div className="space-y-10 my-auto">
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 rounded-full px-4 py-1.5"
            >
              <Zap className="w-3 h-3 text-violet-400" />
              <span className="text-violet-300 text-xs font-medium tracking-wide">AI-Powered Platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-5xl xl:text-6xl font-black text-white leading-[1.1] tracking-tight"
            >
              Customer<br />
              Conversations,<br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-cyan-400 to-indigo-400">
                Powered by AI.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-slate-400 text-base max-w-md leading-relaxed"
            >
              Unify WhatsApp, email, and live chat. Automate with AI. Delight every customer, every time.
            </motion.p>
          </div>

          <DashboardMockup />
        </div>

        {/* Bottom trust row */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
          className="flex items-center gap-6 text-slate-600 text-xs"
        >
          {["SOC2 Ready", "99.9% Uptime", "GDPR Compliant", "24/7 Support"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />{t}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* ── RIGHT form panel ── */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.1 }}
        className="flex-1 flex items-center justify-center p-6 lg:p-10 relative z-10"
      >
        <div className="w-full max-w-[400px]">

          {/* Glass card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="rounded-[28px] border border-white/10 bg-white/[0.06] backdrop-blur-2xl p-8 shadow-2xl shadow-black/40"
          >
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-7">
              <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold">SupportFlow</span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
              <p className="text-slate-400 text-sm">Sign in to your workspace</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mb-5 flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-sm font-medium">Email address</label>
                <motion.div
                  animate={{ boxShadow: focusedField === "email" ? "0 0 0 2px rgba(124,58,237,0.5)" : "0 0 0 0px transparent" }}
                  className="relative rounded-2xl overflow-hidden"
                >
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full h-13 pl-11 pr-4 bg-white/8 border border-white/10 rounded-2xl text-white placeholder-slate-500 text-sm outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                  />
                </motion.div>
                {errors.email && <p className="text-red-400 text-xs pl-1">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 text-sm font-medium">Password</label>
                  <Link href="/forgot-password" className="text-violet-400 text-xs hover:text-violet-300 transition-colors font-medium">
                    Forgot password?
                  </Link>
                </div>
                <motion.div
                  animate={{ boxShadow: focusedField === "password" ? "0 0 0 2px rgba(124,58,237,0.5)" : "0 0 0 0px transparent" }}
                  className="relative rounded-2xl overflow-hidden"
                >
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                  <input
                    {...register("password")}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className="w-full h-13 pl-11 pr-4 bg-white/8 border border-white/10 rounded-2xl text-white placeholder-slate-500 text-sm outline-none focus:border-violet-500/60 focus:bg-white/10 transition-all"
                  />
                </motion.div>
                {errors.password && <p className="text-red-400 text-xs pl-1">{errors.password.message}</p>}
              </div>

              {/* Sign in button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02, boxShadow: loading ? undefined : "0 8px 30px rgba(124,58,237,0.45)" }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full h-13 rounded-2xl bg-linear-to-r from-violet-600 to-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 mt-2 shadow-lg shadow-violet-600/25 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4" /></>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-slate-600 text-xs">or continue with</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* OAuth buttons */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Google",
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  ),
                },
                {
                  label: "Microsoft",
                  icon: (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                      <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                      <path fill="#FFB900" d="M13 13h10v10H13z"/>
                    </svg>
                  ),
                },
              ].map((provider) => (
                <motion.button
                  key={provider.label}
                  type="button"
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-white/6 border border-white/10 text-white text-sm font-medium transition-colors hover:border-white/20"
                >
                  {provider.icon}
                  {provider.label}
                </motion.button>
              ))}
            </div>

            {/* Sign up */}
            <p className="text-center text-slate-500 text-sm mt-6">
              No account?{" "}
              <Link href="/register" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
                Create one free
              </Link>
            </p>
          </motion.div>

          {/* Below card */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-center text-slate-700 text-xs mt-6"
          >
            By signing in you agree to our{" "}
            <span className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">Terms</span>
            {" & "}
            <span className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">Privacy Policy</span>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
