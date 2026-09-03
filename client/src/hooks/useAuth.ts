import { useState, useEffect, useCallback } from 'react';
import { User, DropdownOptions } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('mpz-user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('mpz-token');
  });

  // If token and cached user exist or no token at all, don't block the screen!
  const [loading, setLoading] = useState<boolean>(() => {
    const t = localStorage.getItem('mpz-token');
    const u = localStorage.getItem('mpz-user');
    if (!t) return false;
    if (t && u) return false; // Stale-while-revalidate: instant render
    return true;
  });

  const [authError, setAuthError] = useState<string | null>(null);
  const [options, setOptions] = useState<DropdownOptions>({
    colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
    branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
    years: ['I Year', 'II Year', 'III Year', 'IV Year']
  });

  // Fetch dropdown options asynchronously in background
  useEffect(() => {
    fetch(`${API_BASE}/options`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.options) {
          setOptions(data.options);
        }
      })
      .catch(() => {});
  }, []);

  // Revalidate session in background (Stale-While-Revalidate)
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
          localStorage.setItem('mpz-user', JSON.stringify(data.user));
        } else {
          localStorage.removeItem('mpz-token');
          localStorage.removeItem('mpz-user');
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const signUp = useCallback(async (
    rollNumber: string,
    mobileNumber: string,
    password: string,
    collegeName: string,
    branch: string,
    year: string
  ): Promise<boolean> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber, mobileNumber, password, collegeName, branch, year })
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        localStorage.setItem('mpz-token', data.token);
        localStorage.setItem('mpz-user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return true;
      } else {
        setAuthError(data.error || 'Failed to sign up.');
        return false;
      }
    } catch {
      setAuthError('Network error. Check backend server connection.');
      return false;
    }
  }, []);

  const signIn = useCallback(async (rollNumber: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber, password })
      });
      const data = await res.json();
      if (data.success && data.token && data.user) {
        localStorage.setItem('mpz-token', data.token);
        localStorage.setItem('mpz-user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return true;
      } else {
        setAuthError(data.error || 'Invalid credentials.');
        return false;
      }
    } catch {
      setAuthError('Network error. Check backend server connection.');
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('mpz-token');
    localStorage.removeItem('mpz-user');
    setToken(null);
    setUser(null);
  }, []);

  return {
    user,
    token,
    loading,
    authError,
    options,
    setAuthError,
    signUp,
    signIn,
    signOut
  };
}
