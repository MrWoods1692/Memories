import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Dropdown, Layout, Menu, Tooltip, theme } from "antd";
import type { MenuProps } from "antd";
import {
  PictureOutlined, CloudUploadOutlined, UserOutlined, LoginOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ControlOutlined,
  GlobalOutlined, InfoCircleOutlined, SunOutlined, MoonOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { App } from "antd";
import BackToTop from "./BackToTop";
import LogoIcon from "@/components/LogoIcon";

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
  // 侧边栏与移动端底部导航共用同一份菜单项（label / key / icon）
  const navItems: { key: string; label: string; icon: ReactNode }[] = [
    { key: "/gallery", label: "广场", icon: <PictureOutlined /> },
    ...(isLoggedIn ? [{ key: "/upload", label: "上传", icon: <CloudUploadOutlined /> }] : []),
    ...(isReviewerOrAdmin ? [{ key: "/review", label: "审核", icon: <AuditOutlined /> }] : []),
    ...(user?.is_admin ? [{ key: "/admin", label: "管理后台", icon: <ControlOutlined /> }] : []),
    ...(isLoggedIn ? [{ key: "/profile", label: "个人中心", icon: <UserOutlined /> }] : []),
  ];
  const items: MenuProps["items"] = navItems.map(({ key, label, icon }) => ({ key, label, icon }));
  const currentKey = navItems.find((opt) => location.pathname.startsWith(opt.key))?.key || "/gallery";

  // 非普通用户（审核员 / 管理员）移动端为「图标在上、文字在下」，普通用户保持横排
  const stackedMobileNav = isReviewerOrAdmin;
  const bottomPadding = isDesktop ? 24 : stackedMobileNav ? 76 : 64;

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
            // 顶部主题色微光，让侧边栏跟随主题配色
            backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, transparent 120px)`,
          }}
        >
          {/* 侧边栏右键菜单容器 */}
          <Dropdown menu={sidebarCtxMenu} trigger={['contextMenu']}>
            <div style={{ display: "contents" }}>
          {/* 顶部图标 + 标题 */}
          <Dropdown menu={brandCtxMenu} trigger={['contextMenu']}>
          <div
            onContextMenu={(e) => e.stopPropagation()}
            style={{
            height: 56, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontWeight: 700, fontSize: collapsed ? 16 : 18, color: accentColor,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            flexShrink: 0, cursor: "context-menu",
          }}>
            <LogoIcon size={collapsed ? 24 : 28} style={{ flexShrink: 0 }} />
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
                style={{
                  borderRadius: 10, width: "100%",
                  color: "var(--ant-color-text-tertiary)",
                  transition: "all 0.25s ease",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = accentColor;
                  e.currentTarget.style.background = `${accentColor}12`;
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--ant-color-text-tertiary)";
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              />
            </Tooltip>

            {/* 备案信息（侧边栏未收起时显示） */}
            {!collapsed && (
              <div style={{ textAlign: "center", padding: "4px 4px 0" }}>
                <a
                  href="https://beian.miit.gov.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 11,
                    color: "var(--ant-color-text-tertiary)",
                    textDecoration: "none",
                    opacity: 0.6,
                    transition: "opacity 0.2s",
                    lineHeight: 1.3,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
                >
                  桂ICP备2020008331号-1
                </a>
              </div>
            )}
          </div>
            </div>{/* end sidebar context-menu container */}
          </Dropdown>{/* end sidebar context-menu dropdown */}
        </Sider>
      )}
      <Layout style={{ marginLeft: isDesktop ? siderWidth : 0, transition: "margin-left 0.2s", background: token.colorBgLayout }}>
        <Content style={{
          paddingBottom: bottomPadding,
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
          {stackedMobileNav ? (
            /* 非普通用户：图标在上、文字在下 */
            <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "6px 8px 8px" }}>
              {navItems.map(({ key, label, icon }) => (
                <div
                  key={key}
                  onClick={() => navigate(key)}
                  style={{
                    flex: 1, maxWidth: 92,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    padding: "2px 0", cursor: "pointer",
                    color: currentKey === key ? accentColor : "var(--ant-color-text-secondary)",
                    fontSize: 11, lineHeight: 1.2, fontWeight: currentKey === key ? 600 : 400,
                    transition: "color 0.2s",
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, display: "flex" }}>{icon}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            /* 普通用户：保持原横向菜单 */
            <Menu
              mode="horizontal"
              selectedKeys={[currentKey as string]}
              items={items}
              onClick={({ key }) => navigate(key)}
              style={{ flex: 1, justifyContent: "center", borderBottom: "none", background: "transparent" }}
            />
          )}
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
