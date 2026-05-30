'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/login', data);
      const { data: user } = await api.get('/users/me');
      setUser(user);
      router.push('/dashboard');
    } catch {
      toast.error('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
          <span className="text-xl font-bold text-background">SpendWise</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
        </div>
        <div>
          <h2 className="text-4xl font-bold text-background leading-tight mb-4">
            Know exactly where<br />your money goes.<br />Every month.
          </h2>
          <p className="text-background/60 text-sm max-w-xs">
            Upload your bank statement, get AI-powered insights on subscriptions, spend leaks, and weekly savings actions — in seconds.
          </p>
        </div>
        <p className="text-background/40 text-sm">
          Analysing transactions across thousands of users · Built with Claude AI
        </p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
            <span className="text-lg font-bold text-foreground">SpendWise</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className={`h-11 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`h-11 pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-foreground text-background hover:bg-foreground/85 font-semibold"
            >
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</> : 'Sign in'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[var(--color-brand)] font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
