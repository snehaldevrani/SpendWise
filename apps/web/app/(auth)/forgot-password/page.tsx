"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSent(true);
    } catch {
      // Always show success to avoid email enumeration
      setSent(true);
      toast.info('If that email is registered, you will receive a reset link.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-lg font-semibold text-white">SpendWise</span>
        </Link>

        {sent ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 mx-auto mb-5">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your inbox</h2>
            <p className="text-zinc-400 mb-6">
              If that email address is registered with SpendWise, you&apos;ll receive a password reset link within a minute. The link expires in 1 hour.
            </p>
            <Link href="/login">
              <Button variant="outline" className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 mb-6">
              <Mail className="h-6 w-6 text-emerald-500" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Forgot your password?</h2>
            <p className="text-zinc-400 mb-8">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@gmail.com"
                  className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500"
                  {...register("email")}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
              >
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <Link href="/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
