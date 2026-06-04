"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { TrendingUp, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

const schema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a digit"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-zinc-900/60 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid reset link</h2>
          <p className="text-zinc-400 mb-6">This link is missing a reset token. Please request a new one.</p>
          <Link href="/forgot-password">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium">Request new link</Button>
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Reset link is invalid or has expired. Please request a new one.');
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 mx-auto mb-5">
            <CheckCircle className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
          <p className="text-zinc-400 mb-6">
            Your password has been reset successfully. All existing sessions have been signed out.
          </p>
          <Button
            onClick={() => router.push('/login')}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
          >
            Log in with new password
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-10">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-lg font-semibold text-white">SpendWise</span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/20 mb-6">
            <Lock className="h-6 w-6 text-emerald-500" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Set new password</h2>
          <p className="text-zinc-400 mb-8">
            Choose a strong password. You&apos;ll be signed out of all other devices after this.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-zinc-300">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500 pr-12"
                  {...register("newPassword")}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-300">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500 pr-12"
                  {...register("confirmPassword")}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
