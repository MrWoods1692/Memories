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

function ProtectedRoutes() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (!isLoggedIn) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/profile" element={<ProfilePage />} />
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
              <Route path="/*" element={<ProtectedRoutes />} />
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
