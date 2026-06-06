'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Always verify session server-side — closes stale-session bypass window.
    api
      .get('/users/me')
      .then(({ data }) => {
        setUser(data);
        setChecking(false);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
