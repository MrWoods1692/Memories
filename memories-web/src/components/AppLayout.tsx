import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Dropdown, Layout, Menu, Tooltip, theme } from "antd";
import type { MenuProps } from "antd";
import {
  PictureOutlined, CloudUploadOutlined, UserOutlined, LoginOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, HeartOutlined,
  GlobalOutlined, InfoCircleOutlined, SunOutlined, MoonOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { App } from "antd";
import BackToTop from "./BackToTop";

const { Content, Sider } = Layout;

const desktopBreakpoint = 768;

const SIDEBAR_COLLAPSED_KEY = "memories_sidebar_collapsed";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, startLogin } = useAuth();
  const { isDark, toggleDark, accentColor } = useTheme();
  const { token } = theme.useToken();
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= desktopBreakpoint : false
  );
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"; }
    catch { return false; }
  });

  const openWebsite = () => window.open("https://mrcwoods.com", "_blank");

  // 侧边栏右键菜单
  const sidebarCtxMenu: MenuProps = {
    items: [
      { key: "collapse", icon: collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />, label: collapsed ? "展开侧边栏" : "收起侧边栏" },
      { key: "dark", icon: isDark ? <SunOutlined /> : <MoonOutlined />, label: isDark ? "切换亮色模式" : "切换暗色模式" },
      { type: "divider" },
      { key: "about", icon: <InfoCircleOutlined />, label: "关于 Memories" },
    ],
    onClick: ({ key }) => {
      if (key === "collapse") toggleCollapsed();
      else if (key === "dark") toggleDark();
      else if (key === "about") message.info("Memories - 照片分享平台");
    },
  };

  // Memories 品牌右键菜单
  const brandCtxMenu: MenuProps = {
    items: [
      { key: "website", icon: <GlobalOutlined />, label: "打开官网" },
      { key: "about", icon: <InfoCircleOutlined />, label: "关于 Memories" },
    ],
    onClick: ({ key }) => {
      if (key === "website") openWebsite();
      else if (key === "about") message.info("Memories - 照片分享平台");
    },
  };

  const { message } = App.useApp();

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next)); }
      catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= desktopBreakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const siderWidth = collapsed ? 60 : 180;

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
          width={siderWidth}
          style={{
            overflow: "hidden", height: "100vh", position: "fixed", left: 0, top: 0, bottom: 0,
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
            zIndex: 50,
            display: "flex", flexDirection: "column",
          }}
        >
          {/* 侧边栏右键菜单容器 */}
          <Dropdown menu={sidebarCtxMenu} trigger={['contextMenu']}>
            <div style={{ display: "contents" }}>
          {/* 顶部图标 + 标题 */}
          <Dropdown menu={brandCtxMenu} trigger={['contextMenu']}>
          <div style={{
            height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontWeight: 700, fontSize: collapsed ? 16 : 18, color: accentColor,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0, cursor: "context-menu",
          }}>
            <HeartOutlined style={{ fontSize: collapsed ? 18 : 20 }} />
            {!collapsed && <span>Memories</span>}
          </div>
          </Dropdown>

          {/* 菜单 */}
          <Menu
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[currentKey as string]}
            items={items}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: "none", marginTop: 8, background: "transparent", flex: 1 }}
          />

          {/* 底部：登录按钮 + 收起按钮 */}
          <div style={{
            flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 4,
            padding: collapsed ? "8px 0" : "8px 12px",
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}>
            {!isLoggedIn && !collapsed && (
              <Button type="primary" block icon={<LoginOutlined />} onClick={startLogin}
                style={{ borderRadius: 8 }}>登录 / 注册</Button>
            )}
            {!isLoggedIn && collapsed && (
              <Tooltip title="登录 / 注册" placement="right">
                <Button type="primary" icon={<LoginOutlined />} onClick={startLogin}
                  style={{ borderRadius: 8, width: "100%" }} />
              </Tooltip>
            )}
            <Tooltip title={collapsed ? "展开侧边栏" : "收起侧边栏"} placement="right">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                style={{ borderRadius: 8, width: "100%", color: "var(--ant-color-text-tertiary)" }}
              />
            </Tooltip>
          </div>
            </div>{/* end sidebar context-menu container */}
          </Dropdown>{/* end sidebar context-menu dropdown */}
        </Sider>
      )}
      <Layout style={{ marginLeft: isDesktop ? siderWidth : 0, transition: "margin-left 0.2s", background: token.colorBgLayout }}>
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
