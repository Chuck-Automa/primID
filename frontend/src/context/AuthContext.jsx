import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { setToken, clearToken } from '../services/tokenStore';
import api from '../services/api';

const AuthContext = createContext(null);

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);   // { id, currentTier, displayName, ... }
  const [isLoading, setIsLoading] = useState(true);

  // Called after any successful auth event (OTP confirm, OAuth, refresh restore).
  const login = useCallback((accessToken, userData) => {
    setToken(accessToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Always clear local state even if server call fails.
    }
    clearToken();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await api.delete('/api/user/me');
    clearToken();
    setUser(null);
  }, []);

  // Called after tier upgrade — refreshes user data from the server.
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/user/me');
      setUser(res.data.user);
    } catch {
      // Ignore — stale data is acceptable here; next full load will correct.
    }
  }, []);

  // On mount: attempt to restore session via the HttpOnly refresh cookie.
  // Tier 3 users have no cookie — they'll be directed to login after the 24h access token expires.
  useEffect(() => {
    axios
      .post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        setToken(res.data.accessToken);
        return api.get('/api/user/me');
      })
      .then((res) => {
        setUser(res.data.user);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
