"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Something went wrong");
      } else {
        setSent(true);
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
              {sent ? "Check your email" : "Forgot password?"}
            </CardTitle>
            <CardDescription>
              {sent
                ? `We sent a reset link to ${getValues("email")}`
                : "Enter your email and we'll send a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">
                  If an account exists for that email, you will receive a password reset link shortly.
                  Check your spam folder if you don&apos;t see it.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setSent(false); setError(""); }}
                >
                  Try another email
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                  <div>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        {...register("email")}
                        type="email"
                        placeholder="Enter your email"
                        className="pl-10"
                        autoComplete="email"
                      />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-700"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Send Reset Link
                  </Button>
                </form>
              </>
            )}

            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
              >
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
