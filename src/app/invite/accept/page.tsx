"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, Loader2, Lock } from "lucide-react";

function AcceptInviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [invite, setInvite]   = useState<{ email: string; name: string; role: string } | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pw, setPw]           = useState("");
  const [pw2, setPw2]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token provided."); setLoading(false); return; }
    fetch(`/api/agents/invite?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setInvite(d.data);
        else setError(d.error || "Invalid or expired invite link.");
      })
      .catch(() => setError("Could not validate invite."))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setError("Passwords don't match"); return; }
    if (pw.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/agents/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: pw }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (d.success) { setDone(true); setTimeout(() => router.push("/login"), 2500); }
    else setError(d.error || "Something went wrong");
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Account created!</h2>
              <p className="text-gray-500 mt-2">Redirecting to login…</p>
            </div>
          ) : error && !invite ? (
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900">Invalid invite</h2>
              <p className="text-gray-500 mt-2 text-sm">{error}</p>
            </div>
          ) : invite ? (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-7 h-7 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Set your password</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Welcome, <strong>{invite.name}</strong>! You&apos;re joining as <strong>{invite.role}</strong>.
                </p>
                <p className="text-xs text-gray-400 mt-1">{invite.email}</p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Password</label>
                  <Input type="password" placeholder="Min 8 characters" value={pw} onChange={e => setPw(e.target.value)} required minLength={8} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Confirm password</label>
                  <Input type="password" placeholder="Repeat password" value={pw2} onChange={e => setPw2(e.target.value)} required />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700 h-11">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {submitting ? "Creating account…" : "Accept Invite & Sign Up"}
                </Button>
              </form>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  );
}
