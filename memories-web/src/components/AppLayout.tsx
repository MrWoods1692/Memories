import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu } from "antd";
import { PictureOutlined, CloudUploadOutlined, UserOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";

const { Content, Sider } = Layout;

const menuItems: MenuProps["items"] = [
  { label: "回忆广场", key: "/gallery", icon: <PictureOutlined /> },
  { label: "上传", key: "/upload", icon: <CloudUploadOutlined /> },
  { label: "个人中心", key: "/profile", icon: <UserOutlined /> },
];

const desktopBreakpoint = 768;

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= desktopBreakpoint : false
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= desktopBreakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const currentKey = menuItems?.find((opt) => opt && location.pathname.startsWith(opt.key as string))?.key || "/gallery";

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--ant-color-bg-layout)" }} hasSider={isDesktop}>
      {isDesktop && (
        <Sider
          width={180}
          style={{
            overflow: "auto", height: "100vh", position: "fixed", left: 0, top: 0, bottom: 0,
            background: "var(--ant-color-bg-container)",
            borderRight: "1px solid var(--ant-color-border-secondary)",
            zIndex: 50,
          }}
        >
          <div style={{
            height: 56, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 18, color: "var(--ant-color-primary)",
            borderBottom: "1px solid var(--ant-color-border-secondary)",
          }}>
            Memories
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentKey as string]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: "none", marginTop: 8 }}
          />
        </Sider>
      )}
      <Layout style={{ marginLeft: isDesktop ? 180 : 0, transition: "margin-left 0.2s" }}>
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
          background: "var(--ant-color-bg-container)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid var(--ant-color-border-secondary)",
          paddingBottom: "env(safe-area-inset-bottom, 0)",
        }}>
          <Menu
            mode="horizontal"
            selectedKeys={[currentKey as string]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ justifyContent: "center", borderBottom: "none", background: "transparent" }}
          />
        </div>
      )}
    </Layout>
  );
}
