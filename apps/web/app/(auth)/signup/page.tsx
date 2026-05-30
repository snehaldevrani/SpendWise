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
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ['confirm'] });
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post('/auth/signup', { email: data.email, password: data.password });
      const { data: user } = await api.get('/users/me');
      setUser(user);
      toast.success('Account created! Upload your first bank statement to get started.');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg === 'Email already registered' ? 'That email is already registered' : 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-foreground flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
          <span className="text-xl font-bold text-background">SpendWise</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
        </div>
        <div>
          <h2 className="text-4xl font-bold text-background leading-tight mb-4">
            Start saving in<br />under 2 minutes.
          </h2>
          <div className="space-y-2 text-sm text-background/70">
            {['Upload any bank CSV — no manual entry', 'AI detects subscriptions automatically', 'Get a weekly savings action plan'].map((t) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                {t}
              </div>
            ))}
          </div>
        </div>
        <p className="text-background/40 text-sm">Free to use · No credit card required</p>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <TrendingUp className="h-5 w-5 text-[var(--color-brand)]" />
            <span className="text-lg font-bold">SpendWise</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground mb-8">Free forever · No credit card</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" className={`h-11 ${errors.email ? 'border-destructive' : ''}`} {...register('email')} />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</Label>
              <div className="relative">
                <Input id="password" type={showPw ? 'text' : 'password'} placeholder="Min 8 characters" className={`h-11 pr-10 ${errors.password ? 'border-destructive' : ''}`} {...register('password')} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirm" className="text-sm font-medium mb-1.5 block">Confirm password</Label>
              <Input id="confirm" type="password" placeholder="Repeat your password" className={`h-11 ${errors.confirm ? 'border-destructive' : ''}`} {...register('confirm')} />
              {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full h-11 bg-foreground text-background hover:bg-foreground/85 font-semibold">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : 'Create account'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--color-brand)] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
