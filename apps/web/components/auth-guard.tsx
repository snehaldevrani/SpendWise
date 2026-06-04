'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  // 'checking' = waiting for Zustand hydration + optional /users/me call
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If Zustand already has a user (persisted from localStorage), done.
    if (user) {
      setChecking(false);
      return;
    }

    // Zustand is empty — could be first load after OAuth or a page refresh
    // where localStorage was cleared. Try to hydrate from the API cookie.
    api
      .get('/users/me')
      .then(({ data }) => {
        setUser(data);
        setChecking(false);
      })
      .catch(() => {
        // No valid session at all — go to login
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
