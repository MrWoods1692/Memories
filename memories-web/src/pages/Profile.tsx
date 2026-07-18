import { useEffect, useState } from "react";
import { Avatar, Button, Card, Divider, Dropdown, Popconfirm, Segmented, Slider, Space, Tag, Typography, App } from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined, LogoutOutlined, SafetyCertificateOutlined, CheckCircleOutlined,
  SunOutlined, MoonOutlined, BgColorsOutlined, FontSizeOutlined, ClearOutlined, DeleteOutlined,
  GlobalOutlined, ExportOutlined, SendOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, themePresets, fontOptions } from "@/contexts/ThemeContext";
import { useImageCache } from "@/hooks/useImageCache";

const { Title, Text } = Typography;

const fontSizes = [
  { label: "极小", value: 12 },
  { label: "小", value: 13 },
  { label: "正常", value: 14 },
  { label: "大", value: 16 },
  { label: "极大", value: 18 },
];

const roleMap: Record<number, string> = { 0: "普通用户", 1: "审核员", 2: "管理员" };

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { preset, setPreset, fontSize, setFontSize, font, setFont, isDark, toggleDark, accentColor } = useTheme();
  const { clearCache } = useImageCache();
  const { message } = App.useApp();

  if (!user) return null;

  const handleLogout = () => { logout(); message.success("已退出登录"); };

  // 右键菜单
  const pageCtxMenu: MenuProps = {
    items: [
      { key: "website", icon: <GlobalOutlined />, label: "Memories 官网" },
      { key: "campus", icon: <SendOutlined />, label: "校园墙 (gz.campux.top)" },
      { type: "divider" },
      { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true },
    ],
    onClick: ({ key }) => {
      if (key === "website") window.open("https://memories.mrcwoods.com", "_blank");
      else if (key === "campus") window.open("https://gz.campux.top", "_blank");
      else if (key === "logout") handleLogout();
    },
  };

  const themeCtxMenu: MenuProps = {
    items: themePresets.map((t) => ({
      key: t.id,
      label: t.name,
      icon: <div style={{ display: "inline-flex", gap: 2 }}>{t.colors.map((c, ci) => (
        <span key={ci} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block", border: "1px solid rgba(0,0,0,0.1)" }} />
      ))}</div>,
      style: preset.id === t.id ? { fontWeight: 600, background: "var(--ant-color-primary-bg)" } : undefined,
    })),
    onClick: ({ key }) => setPreset(themePresets.find((t) => t.id === key) || themePresets[0]),
  };

  const fontCtxMenu: MenuProps = {
    items: [
      ...fontOptions.map((f) => ({
        key: f.id,
        label: f.name,
        style: font.id === f.id ? { fontWeight: 600, color: "var(--ant-color-primary)" } : undefined,
      })),
      { type: "divider" },
      ...fontSizes.map((s) => ({
        key: `size_${s.value}`,
        label: `${s.label} (${s.value}px)`,
        style: fontSize === s.value ? { fontWeight: 600, color: "var(--ant-color-primary)" } : undefined,
      })),
    ],
    onClick: ({ key }) => {
      if (key.startsWith("size_")) setFontSize(parseInt(key.replace("size_", "")));
      else setFont(fontOptions.find((f) => f.id === key) || fontOptions[0]);
    },
  };

  const handleClearCache = () => {
    clearCache();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (cacheKeys.some((p) => key.startsWith(p))) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setCacheSize("0 B");
    message.success("本地缓存已清除");
  };

  /** 计算 localStorage 全部缓存大小 */
  const cacheKeys = ["img_cache_", "images_cache_", "upload_history"];
  const getCacheSize = (): string => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (cacheKeys.some((p) => key.startsWith(p))) {
          total += (localStorage.getItem(key) || "").length * 2;
        }
      }
      if (total === 0) return "0 B";
      if (total < 1024) return `${total} B`;
      if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
      return `${(total / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return "未知";
    }
  };

  const [cacheSize, setCacheSize] = useState(getCacheSize);

  // 每次进入页面刷新缓存大小
  useEffect(() => { setCacheSize(getCacheSize()); }, []);

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ textAlign: "center", padding: "32px 16px 20px" }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: accentColor }}>
          <UserOutlined style={{ marginRight: 6 }} />个人中心
        </Title>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        {/* 页面其余区域右键菜单 */}
        <Dropdown menu={pageCtxMenu} trigger={['contextMenu']}>
        <div style={{ display: "contents" }}>
        {/* === 用户信息 === */}
        <Card style={{ borderRadius: 16, textAlign: "center", overflow: "visible", marginBottom: 16 }}
          styles={{ body: { padding: "40px 24px 20px" } }}>
          <div style={{ marginTop: -64, marginBottom: 16 }}>
            <Avatar size={96} src={`https://q1.qlogo.cn/g?b=qq&nk=${user.qq}&s=640`}
              icon={<UserOutlined />}
              style={{ boxShadow: `0 8px 30px ${accentColor}33`, border: "3px solid var(--ant-color-bg-container)" }} />
          </div>
          <Title level={4} style={{ margin: "8px 0 4px" }}>{user.username}</Title>
          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Tag color="geekblue" style={{ borderRadius: 8 }}>{roleMap[user.role] || `角色${user.role}`}</Tag>
            {user.is_reviewer && <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 8 }}>审核权限</Tag>}
            {user.is_admin && <Tag icon={<SafetyCertificateOutlined />} color="warning" style={{ borderRadius: 8 }}>管理员</Tag>}
          </div>
        </Card>

        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "16px 20px" } }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 16px", alignItems: "center" }}>
            <Text type="secondary">QQ 号</Text>
            <Text strong>{user.qq}</Text>
            <Text type="secondary">昵称</Text>
            <Text>{user.username}</Text>
            <Text type="secondary">角色</Text>
            <Text>{roleMap[user.role] || `未知(${user.role})`}</Text>
          </div>
        </Card>

        <Divider orientation="left" plain style={{ fontSize: 13, fontWeight: 500 }}>偏好设置</Divider>

        {/* === 主题配色 === */}
        <Dropdown menu={themeCtxMenu} trigger={['contextMenu']}>
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px" } }}
          title={<><BgColorsOutlined style={{ fontSize: 15 }} /> 主题配色</>}>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            {themePresets.map((t) => (
              <div key={t.id} onClick={() => setPreset(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 12px", borderRadius: 10, cursor: "pointer",
                  background: preset.id === t.id ? "var(--ant-color-primary-bg)" : "transparent",
                  border: preset.id === t.id ? "1.5px solid var(--ant-color-primary)" : "1.5px solid transparent",
                  transition: "all 0.2s",
                }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {t.colors.map((c, ci) => (
                    <div key={ci} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
                  ))}
                </div>
                <Text style={{ flex: 1, fontSize: 13 }}>{t.name}</Text>
                {preset.id === t.id && <CheckCircleOutlined style={{ color: "var(--ant-color-primary)", fontSize: 16 }} />}
              </div>
            ))}
          </Space>
        </Card>
        </Dropdown>

        {/* === 外观模式 === */}
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px" } }}
          title={<>{isDark ? <MoonOutlined /> : <SunOutlined />} 外观模式</>}>
          <Segmented block size="small"
            value={isDark ? "dark" : "light"}
            onChange={(val) => { if ((val === "dark") !== isDark) toggleDark(); }}
            options={[
              { label: "浅色", value: "light", icon: <SunOutlined /> },
              { label: "深色", value: "dark", icon: <MoonOutlined /> },
            ]}
          />
        </Card>

        {/* === 字体选择 === */}
        <Dropdown menu={fontCtxMenu} trigger={['contextMenu']}>
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px 20px" } }}
          title={<><FontSizeOutlined style={{ fontSize: 15 }} /> 字体与字号</>}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 6, marginBottom: 10,
          }}>
            {fontOptions.map((f) => {
              const isActive = font.id === f.id;
              return (
              <div key={f.id} onClick={() => setFont(f)}
                style={{
                  padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                  textAlign: "center", fontSize: 12,
                  background: isActive ? "var(--ant-color-primary-bg)" : "var(--ant-color-fill-quaternary)",
                  border: isActive ? "2.5px solid var(--ant-color-primary)" : "2.5px solid transparent",
                  boxShadow: isActive ? "0 0 0 3px var(--ant-color-primary-bg), 0 2px 8px rgba(0,0,0,0.1)" : "none",
                  fontFamily: f.family ? `"${f.family}", sans-serif` : undefined,
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.2s",
                }}>
                {f.name}
              </div>
              );
            })}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>字号</Text>
          <div style={{ padding: "0 8px", paddingBottom: 6 }}>
            <Slider
              min={12}
              max={18}
              step={null}
              value={fontSize}
              onChange={setFontSize}
              marks={{ 12: "极小", 13: "小", 14: "正常", 16: "大", 18: "极大" }}
              tooltip={{ formatter: (v) => fontSizes.find((f) => f.value === v)?.label || v }}
              style={{ marginBottom: 0 }}
            />
          </div>
        </Card>
        </Dropdown>

        {/* === 缓存管理 === */}
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px" } }}
          title={<><ClearOutlined style={{ fontSize: 15 }} /> 缓存管理</>}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Text style={{ fontSize: 13 }}>本地缓存</Text>
              <Text strong style={{ fontSize: 14, marginLeft: 8 }}>{cacheSize}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>清除图片、列表、上传记录等缓存</Text>
            </div>
            <Popconfirm
              title="确定清除所有本地缓存？"
              onConfirm={handleClearCache}
              okText="确定" cancelText="取消">
              <Button danger size="small" icon={<DeleteOutlined />}>清除</Button>
            </Popconfirm>
          </div>
        </Card>

        {/* === 官网 === */}
        <a
          href="https://memories.mrcwoods.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <Card size="small" hoverable
            style={{
              borderRadius: 14, marginBottom: 16,
              background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`,
              border: `1px solid ${accentColor}20`,
              transition: "all 0.25s",
            }}
            styles={{ body: { padding: "16px 18px" } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <GlobalOutlined style={{ fontSize: 22, color: "#fff" }} />
              </div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 14 }}>Memories 官方网站</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>了解功能详情 · 下载客户端 · 查看更新日志</Text>
              </div>
              <ExportOutlined style={{ fontSize: 18, color: accentColor, opacity: 0.6 }} />
            </div>
          </Card>
        </a>

      </div>
      </Dropdown>

        <Divider />

        {/* === 退出登录 === */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Popconfirm
            title="确定退出登录？"
            description="退出后需要重新授权才能访问"
            onConfirm={handleLogout}
            okText="退出"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="large" icon={<LogoutOutlined />}
              style={{ width: "100%", maxWidth: 300, borderRadius: 14, height: 44 }}>
              退出登录
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
