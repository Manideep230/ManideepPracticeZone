import { useState, useEffect, useCallback } from 'react';
import { User, DropdownOptions } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('mpz-token');
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [options, setOptions] = useState<DropdownOptions>({
    colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University'],
    branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS'],
    years: ['I Year', 'II Year', 'III Year', 'IV Year']
  });

  // Fetch dropdown options on mount
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

  // Check active token on mount
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
        } else {
          localStorage.removeItem('mpz-token');
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
