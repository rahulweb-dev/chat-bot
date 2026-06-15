"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Loader2, Lock, CheckCircle2, ArrowLeft } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token) { setError("Invalid or missing reset token. Request a new link."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Reset failed. The link may have expired.");
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SupportFlow</h1>
          <p className="text-gray-500 text-sm mt-1">Enterprise Customer Engagement Platform</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {done ? "Password reset!" : "Set new password"}
            </CardTitle>
            <CardDescription>
              {done ? "Redirecting to sign in..." : "Enter your new password below"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {done ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">Your password has been reset successfully.</p>
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => router.push("/login")}>
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                {!token && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    Invalid or missing reset token. Please request a new password reset link.
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        {...register("password")}
                        type="password"
                        placeholder="New password (min 8 chars)"
                        className="pl-10"
                        autoComplete="new-password"
                      />
                    </div>
                    {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                  </div>
                  <div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        {...register("confirmPassword")}
                        type="password"
                        placeholder="Confirm new password"
                        className="pl-10"
                        autoComplete="new-password"
                      />
                    </div>
                    {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700"
                    disabled={loading || !token}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Reset Password
                  </Button>
                </form>
              </>
            )}
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
