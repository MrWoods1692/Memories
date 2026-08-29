import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse } from "@/types";
import { clearTokens, fetchBanRecord, getAccessToken, getOAuthError, oauthLogin, parseOAuthCallback, type OAuthErrorInfo } from "@/api";
import { useTheme } from "@/contexts/ThemeContext";

interface AuthContextType {
  user: AuthResponse | null;
  loading: boolean;
  startLogin: () => void;
  logout: () => void;
  isLoggedIn: boolean;
  banned: boolean;
  clearBanned: () => void;
  oauthError: OAuthErrorInfo | null;
  clearOAuthError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  startLogin: () => {},
  logout: () => {},
  isLoggedIn: false,
  banned: false,
  clearBanned: () => {},
  oauthError: null,
  clearOAuthError: () => {},
});

// 封禁状态轮询间隔：已登录用户每 10 分钟向后端核实一次是否被封禁
const BAN_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const [oauthError, setOauthError] = useState<OAuthErrorInfo | null>(null);
  const { resetTheme } = useTheme();

  useEffect(() => {
    // 1. 先检查 URL 中是否有 OAuth 回调错误
    const oauthErr = getOAuthError();
    if (oauthErr) {
      setOauthError(oauthErr);
      // 如果是封禁错误，设置 banned 标志以显示封禁页面
      if (oauthErr.code === "banned") {
        setBanned(true);
      }
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
    // 重新登录前清除上一次的错误状态
    setOauthError(null);
    oauthLogin();
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setBanned(false);
    setOauthError(null);
    resetTheme();
  }, [resetTheme]);

  const clearBanned = useCallback(() => {
    setBanned(false);
  }, []);

  const clearOAuthError = useCallback(() => {
    setOauthError(null);
  }, []);

  // 游客状态时恢复默认主题
  useEffect(() => {
    if (!user && !loading) {
      resetTheme();
    }
  }, [user, loading, resetTheme]);

  // 定期复查封禁状态：被管理员封禁后立即清除登录态并展示封禁页（含封禁原因）
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const record = await fetchBanRecord(String(user.qq));
      if (!record) return; // 未封禁或查询失败，保持当前状态
      clearTokens();
      setUser(null);
      setOauthError({
        code: "banned",
        message: record.reason || "该账号已被封禁，无法登录",
        retryable: false,
        ban_reason: record.reason || undefined,
      });
      setBanned(true);
    };
    const timer = window.setInterval(check, BAN_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        startLogin,
        logout,
        isLoggedIn: !!user,
        banned,
        clearBanned,
        oauthError,
        clearOAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
