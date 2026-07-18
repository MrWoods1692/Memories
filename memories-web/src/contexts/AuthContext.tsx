import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse } from "@/types";
import { clearTokens, getAccessToken, getOAuthError, oauthLogin, parseOAuthCallback } from "@/api";
import { App } from "antd";

interface AuthContextType {
  user: AuthResponse | null;
  loading: boolean;
  startLogin: () => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  startLogin: () => {},
  logout: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => {
    // 1. 先检查 URL 中是否有 OAuth 回调错误
    const oauthError = getOAuthError();
    if (oauthError) {
      message.error(oauthError);
      setLoading(false);
      return;
    }

    // 2. 检查 URL 中是否有 OAuth 回调参数
    const callbackUser = parseOAuthCallback();
    if (callbackUser) {
      setUser(callbackUser);
      setLoading(false);
      return;
    }

    // 3. 从 localStorage 恢复
    const stored = localStorage.getItem("user_info");
    const token = getAccessToken();
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        clearTokens();
      }
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startLogin = useCallback(() => {
    oauthLogin();
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, startLogin, logout, isLoggedIn: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
