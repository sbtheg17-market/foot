import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const TOKEN_KEY = 'oncallfoot_token';

interface AuthUser {
  id: number;
  email: string;
  role: 'client' | 'provider' | 'admin';
  roles?: Array<'client' | 'provider' | 'admin'>;
  onboarding?: {
    client: 'complete' | null;
    provider: 'draft' | 'under_review' | 'approved' | 'rejected' | 'suspended' | null;
  };
  providerApplication?: {
    status: 'draft' | 'under_review' | 'approved' | 'rejected' | 'suspended';
  } | null;
  firstName: string;
  lastName: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let _token: string | null = null;

// Register getter once — called before every API request
setAuthTokenGetter(() => _token);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet([TOKEN_KEY, 'oncallfoot_user']).then(([[, tok], [, usr]]) => {
      if (tok) {
        _token = tok;
        setToken(tok);
      }
      if (usr) {
        try { setUser(JSON.parse(usr)); } catch { /* ignore */ }
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (tok: string, u: AuthUser) => {
    _token = tok;
    setToken(tok);
    setUser(u);
    await AsyncStorage.multiSet([[TOKEN_KEY, tok], ['oncallfoot_user', JSON.stringify(u)]]);
  }, []);

  const logout = useCallback(async () => {
    _token = null;
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, 'oncallfoot_user']);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
