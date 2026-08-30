import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, App as AntdApp, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import FirstVisitModal from "@/components/FirstVisitModal";
import LoginPage from "@/pages/Login";
import GalleryPage from "@/pages/Gallery";
import UploadPage from "@/pages/Upload";
import ProfilePage from "@/pages/Profile";
import ReviewPage from "@/pages/Review";
import AdminPage from "@/pages/Admin";
import BannedPage from "@/pages/Banned";

/** 需要登录才能访问的页面包裹 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading, banned } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (banned) return <BannedPage />;
  if (!isLoggedIn) {
    // 退出登录后跳转到根路径，让 LoginPage 全屏沉浸式渲染（不嵌套在 AppLayout 里）
    navigate("/", { replace: true });
    return null;
  }
  return <>{children}</>;
}

/** 需要审核员及以上才能访问的页面包裹 */
function RequireReviewer({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, loading, banned } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (banned) return <BannedPage />;
  if (!isLoggedIn) {
    navigate("/", { replace: true });
    return null;
  }
  if (!user?.is_reviewer && !user?.is_admin) return <Navigate to="/gallery" replace />;
  return <>{children}</>;
}

/** 需要管理员权限才能访问的页面包裹 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, loading, banned } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (banned) return <BannedPage />;
  if (!isLoggedIn) {
    navigate("/", { replace: true });
    return null;
  }
  if (!user?.is_admin) return <Navigate to="/gallery" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isLoggedIn, banned } = useAuth();
  const location = useLocation();

  if (banned) {
    return <BannedPage />;
  }

  // 登录页（根路径未登录时）全屏沉浸式渲染，不套 AppLayout
  if (location.pathname === "/" && !isLoggedIn) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to="/gallery" replace /> : <Navigate to="/" replace />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
        <Route path="/review" element={<RequireReviewer><ReviewPage /></RequireReviewer>} />
        <Route path="/admin" element={<RequireReviewer><AdminPage /></RequireReviewer>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

function ThemedApp() {
  const { antdTheme, isDark } = useTheme();
  return (
    <ConfigProvider
      theme={{
        ...antdTheme,
        algorithm: isDark ? theme.darkAlgorithm : undefined,
      }}
      locale={zhCN}
    >
      <AntdApp>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Routes>
              <Route path="/*" element={<AppRoutes />} />
            </Routes>
            {/* 首次访问提示：指向老网站项目「沙塘大道第一墙」新域名与本项目地址 */}
            <FirstVisitModal />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
      <Analytics />
    </ThemeProvider>
  );
}
