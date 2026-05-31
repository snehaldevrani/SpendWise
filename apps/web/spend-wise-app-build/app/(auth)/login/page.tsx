"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Eye, EyeOff, Shield, Zap, PieChart } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email e.g. you@gmail.com"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const features = [
  { icon: Shield, text: "Bank-grade encryption for your data" },
  { icon: Zap, text: "AI-powered spending insights" },
  { icon: PieChart, text: "Automatic subscription detection" },
];

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    console.log("Login data:", data);
    // Handle login
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
            Welcome back
          </h1>
          <p className="text-zinc-400 text-lg mb-12">
            Log in to continue tracking your finances
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

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/20">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <span className="text-lg font-semibold text-white">SpendWise</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Log in</h2>
          <p className="text-zinc-400 mb-8">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-emerald-500 hover:underline">
              Sign up
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
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
