"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Eye, EyeOff, Shield, Zap, PieChart } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email e.g. you@gmail.com")
      .refine(
        (email) => /\.[a-zA-Z]{2,}$/.test(email),
        "Enter a valid email e.g. you@gmail.com"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a digit"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

const features = [
  { icon: Shield, text: "Bank-grade encryption for your data" },
  { icon: Zap, text: "AI-powered spending insights" },
  { icon: PieChart, text: "Automatic subscription detection" },
];

function getPasswordStrength(password: string): {
  strength: "weak" | "medium" | "strong";
  percentage: number;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { strength: "weak", percentage: 33 };
  if (score <= 4) return { strength: "medium", percentage: 66 };
  return { strength: "strong", percentage: 100 };
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  });

  const password = watch("password", "");
  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  const onSubmit = async (data: SignupFormData) => {
    console.log("Signup data:", data);
    // Handle signup
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 p-12 flex-col justify-between border-r border-white/10">
        <div>
          <Link href="/" className="flex items-center gap-2 mb-16">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="text-xl font-semibold text-white">SpendWise</span>
          </Link>

          <h1 className="text-3xl font-bold text-white mb-4">
            Start your financial journey
          </h1>
          <p className="text-zinc-400 text-lg mb-12">
            Create an account to track your spending with AI
          </p>

          <div className="space-y-6">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                  <feature.icon className="h-5 w-5 text-emerald-500" />
                </div>
                <span className="text-zinc-300">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-zinc-600 text-sm">
          © 2024 SpendWise. All rights reserved.
        </p>
      </div>

      {/* Right panel - Signup form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-lg font-semibold text-white">SpendWise</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Create account</h2>
          <p className="text-zinc-400 mb-8">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-500 hover:underline">
              Log in
            </Link>
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@gmail.com"
                className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500 pr-12"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {password && (
                <div className="space-y-2">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        passwordStrength.strength === "weak" && "bg-red-500",
                        passwordStrength.strength === "medium" && "bg-amber-500",
                        passwordStrength.strength === "strong" && "bg-emerald-500"
                      )}
                      style={{ width: `${passwordStrength.percentage}%` }}
                    />
                  </div>
                  <p
                    className={cn(
                      "text-xs capitalize",
                      passwordStrength.strength === "weak" && "text-red-500",
                      passwordStrength.strength === "medium" && "text-amber-500",
                      passwordStrength.strength === "strong" && "text-emerald-500"
                    )}
                  >
                    {passwordStrength.strength} password
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-300">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 bg-zinc-900 border-white/10 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500 pr-12"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
