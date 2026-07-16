import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { oauthExchange, oauthLogin, saveAuth, clearAuth, getSavedUser } from './api';
import { DEV_MODE } from './config';
import type { AuthUser } from './types';

interface AuthCtx {
  loading: boolean;
  user: AuthUser | null;
  token: string | null;
  devMode: boolean;
  login: () => void;
  devLogin: (qq: string, role: 1 | 2) => void;
  handleCallback: (code: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = getSavedUser();
    const t = localStorage.getItem('admin_token');
    if (saved && t) {
      setUser(saved);
      setToken(t);
    }
    setLoading(false);
  }, []);

  const login = () => { oauthLogin(); };

  /** 开发模式：跳过 OAuth 直接以指定身份登录 */
  const devLogin = (qq: string, role: 1 | 2) => {
    const devToken = 'dev-token-' + Date.now();
    const devUser: AuthUser = { qq, role, nickname: '开发测试' };
    saveAuth(devToken, devUser);
    setToken(devToken);
    setUser(devUser);
  };

  const handleCallback = async (code: string): Promise<boolean> => {
    const result = await oauthExchange(code);
    if (!result) return false;
    if (result.role !== 1 && result.role !== 2) return false;
    saveAuth(result.token, { qq: result.qq, role: result.role, nickname: result.nickname });
    setToken(result.token);
    setUser({ qq: result.qq, role: result.role, nickname: result.nickname });
    return true;
  };

  const logout = () => {
    clearAuth();
    setToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ loading, user, token, devMode: DEV_MODE, login, devLogin, handleCallback, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth 必须在 AuthProvider 内');
  return c;
}
