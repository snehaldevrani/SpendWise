'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store';

/**
 * OAuth / session-hydration callback page.
 *
 * After Google OAuth, the API sets httpOnly cookies and redirects here.
 * This page calls GET /users/me to get the user object, populates the
 * Zustand auth store, then navigates to /dashboard.
 *
 * Without this step the Zustand store would be empty even though the
 * cookie-based session is valid, and AuthGuard would bounce the user
 * back to /login.
 */
export default function CallbackPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const { data: user } = await api.get('/users/me');
        setUser(user);
        router.replace('/dashboard');
      } catch {
        // No valid session — send to login
        router.replace('/login');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );
}
