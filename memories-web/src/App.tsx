import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, App as AntdApp, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/Login";
import GalleryPage from "@/pages/Gallery";
import UploadPage from "@/pages/Upload";
import ProfilePage from "@/pages/Profile";
import ReviewPage from "@/pages/Review";

/** 需要登录才能访问的页面包裹 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <LoginPage />;
  return <>{children}</>;
}

/** 需要审核员及以上才能访问的页面包裹 */
function RequireReviewer({ children }: { children: React.ReactNode }) {
  const { user, isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <LoginPage />;
  if (!user?.is_reviewer && !user?.is_admin) return <Navigate to="/gallery" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<GalleryPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
        <Route path="/review" element={<RequireReviewer><ReviewPage /></RequireReviewer>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/gallery" replace />} />
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
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/*" element={<AppRoutes />} />
            </Routes>
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
    </ThemeProvider>
  );
}
