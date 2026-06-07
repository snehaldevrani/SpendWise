'use client';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Use plain axios (no interceptors) — a 401 here means "not logged in",
    // which is expected on auth pages and must NOT trigger a token refresh.
    axios
      .get(`${baseURL}/users/me`, { withCredentials: true })
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
