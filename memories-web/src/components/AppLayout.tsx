import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Layout, Menu, theme } from "antd";
import { PictureOutlined, CloudUploadOutlined, UserOutlined, LoginOutlined, AuditOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import BackToTop from "./BackToTop";

const { Content, Sider } = Layout;

const desktopBreakpoint = 768;

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, startLogin } = useAuth();
  const { isDark } = useTheme();
  const { token } = theme.useToken();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= desktopBreakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= desktopBreakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isReviewerOrAdmin = user?.is_reviewer || user?.is_admin;
  const items: MenuProps["items"] = [
    { label: "广场", key: "/gallery", icon: <PictureOutlined /> },
    ...(isLoggedIn ? [{ label: "上传", key: "/upload", icon: <CloudUploadOutlined /> }] : []),
    ...(isReviewerOrAdmin ? [{ label: "审核", key: "/review", icon: <AuditOutlined /> }] : []),
    ...(isLoggedIn ? [{ label: "个人中心", key: "/profile", icon: <UserOutlined /> }] : []),
  ];
  const currentKey = items?.find((opt) => opt && location.pathname.startsWith(opt.key as string))?.key || "/gallery";

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }} hasSider={isDesktop}>
      {isDesktop && (
        <Sider
          width={180}
          style={{
            overflow: "auto", height: "100vh", position: "fixed", left: 0, top: 0, bottom: 0,
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            zIndex: 50,
          }}
        >
          <div style={{
            height: 56, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 18, color: token.colorPrimary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}>
            Memories
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentKey as string]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: "none", marginTop: 8, background: "transparent" }}
          />
          {!isLoggedIn && (
            <div style={{ padding: "8px 16px" }}>
              <Button type="primary" block icon={<LoginOutlined />} onClick={startLogin}
                style={{ borderRadius: 8 }}>登录 / 注册</Button>
            </div>
          )}
        </Sider>
      )}
      <Layout style={{ marginLeft: isDesktop ? 180 : 0, transition: "margin-left 0.2s", background: token.colorBgLayout }}>
        <Content style={{
          paddingBottom: isDesktop ? 24 : 64,
          paddingTop: isDesktop ? 16 : 0,
          maxWidth: 1200, margin: "0 auto", width: "100%",
        }}>
          {children}
        </Content>
      </Layout>

      {!isDesktop && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: token.colorBgContainer,
          backdropFilter: "blur(20px)",
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          paddingBottom: "env(safe-area-inset-bottom, 0)",
          display: "flex", alignItems: "center",
        }}>
          <Menu
            mode="horizontal"
            selectedKeys={[currentKey as string]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1, justifyContent: "center", borderBottom: "none", background: "transparent" }}
          />
          {!isLoggedIn && (
            <Button type="primary" size="small" icon={<LoginOutlined />}
              onClick={startLogin}
              style={{ borderRadius: 16, marginRight: 8, flexShrink: 0 }}>
              登录
            </Button>
          )}
        </div>
      )}
    </Layout>
  );
}
