'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Always verify server-side — stale sessionStorage alone is not sufficient.
    api
      .get('/users/me')
      .then(({ data }) => {
        setUser(data);
        router.replace('/dashboard');
      })
      .catch(() => {
        setChecking(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) return null;

  return <>{children}</>;
}
