import { useEffect, useState } from "react";
import { Avatar, Button, Card, Divider, Dropdown, Popconfirm, Progress, Slider, Tag, Typography, App } from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined, LogoutOutlined, SafetyCertificateOutlined, CheckCircleOutlined,
  SunOutlined, MoonOutlined, BgColorsOutlined, FontSizeOutlined, ClearOutlined, DeleteOutlined,
  GlobalOutlined, ExportOutlined, SendOutlined, IdcardOutlined, CrownOutlined, CopyOutlined,
  UnorderedListOutlined, CloudUploadOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, themePresets, fontOptions } from "@/contexts/ThemeContext";
import { useImageCache } from "@/hooks/useImageCache";
import LogoIcon from "@/components/LogoIcon";

const { Title, Text } = Typography;

const fontSizes = [
  { label: "极小", value: 12 },
  { label: "小", value: 13 },
  { label: "正常", value: 14 },
  { label: "大", value: 16 },
  { label: "极大", value: 18 },
];

const roleMap: Record<number, string> = { 0: "普通用户", 1: "审核员", 2: "管理员" };

// 本地缓存键前缀列表（与 getCacheBreakdown 的 groups 保持一致，另含图片缓存前缀以便清除遗留项）
const cacheKeys = ["img_cache_", "images_cache_", "upload_history"];

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { preset, setPreset, fontSize, setFontSize, font, setFont, isDark, toggleDark, accentColor,
    fontLoadStatus, fontLoadProgress, fontLoadingId } = useTheme();
  const { clearCache } = useImageCache();
  const { message } = App.useApp();

  if (!user) return null;

  const handleLogout = () => { logout(); message.success("已退出登录"); };

  // 右键菜单（页面级统一菜单）
  const pageCtxMenu: MenuProps = {
    items: [
      { key: "website", icon: <GlobalOutlined />, label: "Memories 官网" },
      { key: "campus", icon: <SendOutlined />, label: "校园墙" },
      { type: "divider" },
      {
        key: "theme",
        icon: <BgColorsOutlined />,
        label: "主题配色",
        children: themePresets.map((t) => ({
          key: `theme_${t.id}`,
          label: (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 28, height: 14, borderRadius: 7, display: "inline-block",
                background: `linear-gradient(90deg, ${t.colors.join(", ")})`,
                border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0,
              }} />
              <span>{t.name}</span>
              {preset.id === t.id && <CheckCircleOutlined style={{ color: accentColor, fontSize: 13, marginLeft: "auto" }} />}
            </div>
          ),
        })),
      },
      {
        key: "font",
        icon: <FontSizeOutlined />,
        label: "字体与字号",
        children: [
          ...fontOptions.map((f) => ({
            key: `font_${f.id}`,
            label: (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: f.family ? `"${f.family}", sans-serif` : undefined }}>{f.name}</span>
                {font.id === f.id && <CheckCircleOutlined style={{ color: accentColor, fontSize: 13 }} />}
              </div>
            ),
          })),
          { type: "divider" },
          ...fontSizes.map((s) => ({
            key: `size_${s.value}`,
            label: (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>{s.label} ({s.value}px)</span>
                {fontSize === s.value && <CheckCircleOutlined style={{ color: accentColor, fontSize: 13 }} />}
              </div>
            ),
          })),
        ],
      },
      { type: "divider" },
      { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true },
    ],
    onClick: ({ key }) => {
      if (key === "website") window.open("https://memories.mrcwoods.com", "_blank");
      else if (key === "campus") window.open("https://gz.campux.top", "_blank");
      else if (key === "logout") handleLogout();
      else if (key.startsWith("theme_")) setPreset(themePresets.find((t) => `theme_${t.id}` === key) || themePresets[0]);
      else if (key.startsWith("font_")) setFont(fontOptions.find((f) => `font_${f.id}` === key) || fontOptions[0]);
      else if (key.startsWith("size_")) setFontSize(parseInt(key.replace("size_", "")));
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
    setCacheBreakdown(getCacheBreakdown());
    // 清除后从 0 动画到新值（通常为 0）
    const target = getCacheSizeBytes();
    setCacheSize("0 B");
    setCacheBytes(0);
    animateCacheSize(target);
    message.success("本地缓存已清除");
  };

  /** 计算 localStorage 全部缓存大小（字节） */
  const getCacheSizeBytes = (): number => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        if (cacheKeys.some((p) => key.startsWith(p))) {
          total += (localStorage.getItem(key) || "").length * 2;
        }
      }
      return total;
    } catch {
      return 0;
    }
  };

  /** 计算 localStorage 各类缓存大小 */
  const getCacheBreakdown = (): { key: string; label: string; bytes: number }[] => {
    const groups = [
      { prefix: "images_cache_", label: "列表缓存" },
      { prefix: "upload_history", label: "上传记录" },
    ];
    return groups.map((g) => {
      let total = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (key.startsWith(g.prefix)) total += (localStorage.getItem(key) || "").length * 2;
        }
      } catch { /* ignore */ }
      return { key: g.prefix, label: g.label, bytes: total };
    });
  };

  const formatBytes = (n: number): string => {
    if (n === 0) return "0 B";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [cacheSize, setCacheSize] = useState(() => formatBytes(getCacheSizeBytes()));
  const [cacheBytes, setCacheBytes] = useState(() => getCacheSizeBytes());
  const [cacheBreakdown, setCacheBreakdown] = useState(() => getCacheBreakdown());

  // 缓存总量 1s 数值增长动画
  const animateCacheSize = (targetBytes: number) => {
    const startBytes = 0;
    const duration = 1000;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic 缓动
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentBytes = Math.round(startBytes + (targetBytes - startBytes) * eased);
      setCacheSize(formatBytes(currentBytes));
      setCacheBytes(currentBytes);
      if (progress < 1) requestAnimationFrame(tick);
      else {
        setCacheBytes(targetBytes);
        setCacheSize(formatBytes(targetBytes));
      }
    };
    requestAnimationFrame(tick);
  };

  // 每次进入页面刷新缓存大小（带动画）
  useEffect(() => {
    const target = getCacheSizeBytes();
    setCacheBreakdown(getCacheBreakdown());
    setCacheSize("0 B");
    setCacheBytes(0);
    animateCacheSize(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <div>
        {/* === 用户信息 === */}
        <Card style={{ borderRadius: 16, textAlign: "center", overflow: "visible", marginBottom: 16, position: "relative" }}
          styles={{ body: { padding: 0 } }}>
          {/* 顶部渐变横幅 */}
          <div style={{
            height: 110,
            background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}aa 50%, ${accentColor}66 100%)`,
            borderRadius: "16px 16px 0 0",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* 装饰光晕 */}
            <div style={{ position: "absolute", top: -30, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.18)", filter: "blur(8px)" }} />
            <div style={{ position: "absolute", bottom: -40, left: 30, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.12)", filter: "blur(6px)" }} />
            {/* 装饰小圆点 */}
            <div style={{ position: "absolute", top: 18, left: 24, width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.6)" }} />
            <div style={{ position: "absolute", top: 36, left: 40, width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.4)" }} />
            <div style={{ position: "absolute", top: 24, right: 60, width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
            {/* 不规则波浪底部 - 第三层（最浅，最靠后）- 彩色渐变 */}
            <svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 40, display: "block", opacity: 0.5 }}
            >
              <defs>
                <linearGradient id="profileWave3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.25 : 0.35} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={isDark ? 0.08 : 0.15} />
                </linearGradient>
              </defs>
              <path
                d="M0,42 C40,24 80,50 130,32 C180,14 230,40 280,24 C320,12 360,22 400,10 L400,60 L0,60 Z"
                fill="url(#profileWave3)"
              />
            </svg>
            {/* 第二层波浪 - 彩色渐变 */}
            <svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 34, display: "block", opacity: 0.7 }}
            >
              <defs>
                <linearGradient id="profileWave2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.4 : 0.55} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={isDark ? 0.15 : 0.25} />
                </linearGradient>
              </defs>
              <path
                d="M0,34 C40,16 80,38 130,20 C180,6 230,30 280,16 C320,6 360,16 400,8 L400,60 L0,60 Z"
                fill="url(#profileWave2)"
              />
            </svg>
            {/* 主波浪（最前，最明显）- 彩色渐变 */}
            <svg
              viewBox="0 0 400 60"
              preserveAspectRatio="none"
              style={{ position: "absolute", left: 0, bottom: -1, width: "100%", height: 30, display: "block" }}
            >
              <defs>
                <linearGradient id="profileWaveMain" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={isDark ? 0.55 : 0.75} />
                  <stop offset="50%" stopColor={accentColor} stopOpacity={isDark ? 0.3 : 0.45} />
                  <stop offset="100%" stopColor={isDark ? "#141414" : "#ffffff"} stopOpacity={1} />
                </linearGradient>
              </defs>
              <path
                d="M0,28 C20,18 45,8 75,12 C105,16 130,30 165,22 C200,14 235,2 270,8 C305,14 335,20 365,10 C385,4 400,6 400,6 L400,60 L0,60 Z"
                fill="url(#profileWaveMain)"
              />
            </svg>
          </div>

          {/* 头像 + 信息 */}
          <div style={{ padding: "0 24px 20px", marginTop: -48 }}>
            <div style={{
              position: "relative",
              display: "inline-block",
              cursor: "default",
              transition: "transform 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}>
              {/* 旋转的彩色光环 */}
              <div style={{
                position: "absolute",
                inset: -4,
                borderRadius: "50%",
                padding: 4,
                background: `conic-gradient(from 0deg, ${accentColor}, ${accentColor}88, ${accentColor}, ${accentColor}44, ${accentColor})`,
                animation: "memories-avatar-ring 6s linear infinite",
                filter: `blur(0.5px)`,
              }} />
              {/* 静止的背景圈（遮挡光环内部，形成环形效果） */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "var(--ant-color-bg-container)",
                boxShadow: `0 8px 30px ${accentColor}55`,
              }} />
              {/* 头像本体 */}
              <Avatar size={88} src={`https://q1.qlogo.cn/g?b=qq&nk=${user.qq}&s=640`}
                icon={<UserOutlined />}
                style={{ border: "2px solid var(--ant-color-bg-container)", display: "block", position: "relative", boxShadow: `inset 0 0 12px ${accentColor}33` }} />
            </div>

            <Title level={4} style={{
              margin: "12px 0 4px",
              fontWeight: 700,
              color: accentColor,
            }}>{user.username}</Title>

            <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <Tag color="geekblue" style={{ borderRadius: 12, padding: "2px 12px", fontWeight: 500, margin: 0 }}>
                <CrownOutlined style={{ marginRight: 4 }} />{roleMap[user.role] || `角色${user.role}`}
              </Tag>
              {user.is_reviewer && (
                <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 12, padding: "2px 12px", fontWeight: 500, margin: 0 }}>审核权限</Tag>
              )}
              {user.is_admin && (
                <Tag icon={<SafetyCertificateOutlined />} color="warning" style={{ borderRadius: 12, padding: "2px 12px", fontWeight: 500, margin: 0 }}>管理员</Tag>
              )}
            </div>
          </div>
        </Card>

        <Card size="small" style={{ borderRadius: 12, marginBottom: 16, overflow: "hidden" }}
          styles={{ body: { padding: 0 } }}>
          {[
            { icon: <IdcardOutlined style={{ color: accentColor }} />, label: "QQ 号", value: String(user.qq), copyable: false },
            { icon: <UserOutlined style={{ color: accentColor }} />, label: "昵称", value: user.username },
            { icon: <CrownOutlined style={{ color: accentColor }} />, label: "角色", value: roleMap[user.role] || `未知(${user.role})` },
          ].map((row, idx, arr) => (
            <div
              key={idx}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "13px 20px",
                borderBottom: idx < arr.length - 1 ? "1px solid var(--ant-color-border-secondary)" : "none",
                transition: "background 0.2s",
                cursor: row.copyable ? "pointer" : "default",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ant-color-fill-quaternary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              onClick={() => {
                if (!row.copyable) return;
                try {
                  navigator.clipboard?.writeText(row.value);
                  message.success(`已复制${row.label}：${row.value}`);
                } catch { /* ignore */ }
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${accentColor}14`,
                fontSize: 15, flexShrink: 0,
              }}>{row.icon}</div>
              <Text type="secondary" style={{ fontSize: 13, flexShrink: 0, width: 56 }}>{row.label}</Text>
              <Text strong style={{ flex: 1, fontSize: 14 }}>{row.value}</Text>
              {row.copyable && (
                <CopyOutlined style={{ color: "var(--ant-color-text-tertiary)", fontSize: 13 }} />
              )}
            </div>
          ))}
        </Card>

        <Divider orientation="left" plain style={{ fontSize: 13, fontWeight: 500 }}>偏好设置</Divider>

        {/* === 主题配色 === */}
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px" } }}
          title={<><BgColorsOutlined style={{ fontSize: 15 }} /> 主题配色</>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {themePresets.map((t) => {
              const isActive = preset.id === t.id;
              return (
                <div key={t.id} onClick={() => setPreset(t)}
                  style={{
                    position: "relative",
                    padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                    overflow: "hidden",
                    background: isActive
                      ? `linear-gradient(135deg, ${accentColor}14 0%, ${accentColor}06 100%)`
                      : "var(--ant-color-fill-quaternary)",
                    border: isActive ? `1.5px solid ${accentColor}` : "1.5px solid transparent",
                    boxShadow: isActive
                      ? `0 4px 14px ${accentColor}22`
                      : "0 1px 3px rgba(0,0,0,0.04)",
                    transition: "transform 0.2s ease, box-shadow 0.2s, background 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                  {/* 顶部渐变预览条 */}
                  <div style={{
                    height: 24, borderRadius: 8, marginBottom: 8,
                    background: `linear-gradient(90deg, ${t.colors.join(", ")})`,
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                  }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</Text>
                      <Text type="secondary" style={{ fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.desc}</Text>
                    </div>
                    {isActive && <CheckCircleOutlined style={{ color: accentColor, fontSize: 15, flexShrink: 0 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* === 外观模式 === */}
        <Dropdown menu={{
          items: [
            { key: "toggle", icon: isDark ? <SunOutlined /> : <MoonOutlined />, label: isDark ? "切换到浅色" : "切换到深色" },
          ],
          onClick: () => toggleDark(),
        }} trigger={['contextMenu']}>
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px" } }}
          title={<>{isDark ? <MoonOutlined /> : <SunOutlined />} 外观模式</>}
          onContextMenu={(e) => e.stopPropagation()}>
          <div
            onClick={toggleDark}
            style={{
              position: "relative",
              height: 44,
              borderRadius: 22,
              cursor: "pointer",
              overflow: "hidden",
              background: isDark
                ? "linear-gradient(135deg, #1f2a44 0%, #2d3561 100%)"
                : "linear-gradient(135deg, #b3d9ff 0%, #ffe9a8 100%)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
              boxShadow: isDark
                ? "inset 0 1px 2px rgba(0,0,0,0.4)"
                : "inset 0 1px 2px rgba(255,255,255,0.6)",
              transition: "background 0.5s ease, border-color 0.3s",
              userSelect: "none",
            }}
          >
            {/* 星星 / 云朵装饰 */}
            {isDark ? (
              <>
                {/* 小星星 */}
                <span style={{ position: "absolute", top: 8, left: 18, width: 3, height: 3, borderRadius: "50%", background: "#fff", opacity: 0.8, boxShadow: "0 0 4px #fff" }} />
                <span style={{ position: "absolute", top: 14, left: 32, width: 2, height: 2, borderRadius: "50%", background: "#fff", opacity: 0.6 }} />
                <span style={{ position: "absolute", top: 28, left: 24, width: 2, height: 2, borderRadius: "50%", background: "#fff", opacity: 0.5 }} />
                <span style={{ position: "absolute", top: 22, left: 44, width: 3, height: 3, borderRadius: "50%", background: "#fff", opacity: 0.7, boxShadow: "0 0 4px #fff" }} />
                {/* 额外星星 */}
                <span style={{ position: "absolute", top: 6, left: 60, width: 2, height: 2, borderRadius: "50%", background: "#fff", opacity: 0.55 }} />
                <span style={{ position: "absolute", top: 30, left: 70, width: 2, height: 2, borderRadius: "50%", background: "#fff", opacity: 0.45, boxShadow: "0 0 3px #fff" }} />
                <span style={{ position: "absolute", top: 12, left: 86, width: 3, height: 3, borderRadius: "50%", background: "#fff", opacity: 0.65, boxShadow: "0 0 5px #fff" }} />
                {/* 闪烁星星（十字光芒） */}
                <span style={{ position: "absolute", top: 10, left: 50, width: 8, height: 1, background: "rgba(255,255,255,0.7)", borderRadius: 1, transform: "rotate(45deg)", boxShadow: "0 0 4px rgba(255,255,255,0.6)" }} />
                <span style={{ position: "absolute", top: 10, left: 50, width: 1, height: 8, background: "rgba(255,255,255,0.7)", borderRadius: 1, transform: "rotate(45deg)", boxShadow: "0 0 4px rgba(255,255,255,0.6)" }} />
                {/* 流星 */}
                <span style={{ position: "absolute", top: 4, left: 100, width: 18, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8))", borderRadius: 1, transform: "rotate(20deg)", opacity: 0.7 }} />
                {/* 银河带（淡光晕） */}
                <span style={{ position: "absolute", top: 16, left: 0, right: 0, height: 14, background: "linear-gradient(90deg, transparent 10%, rgba(120,160,255,0.08) 40%, rgba(180,140,255,0.06) 60%, transparent 90%)", filter: "blur(3px)" }} />
              </>
            ) : (
              <>
                <span style={{ position: "absolute", top: 10, right: 22, width: 18, height: 10, borderRadius: 6, background: "rgba(255,255,255,0.7)", boxShadow: "6px 2px 0 -2px rgba(255,255,255,0.6), 12px 4px 0 -3px rgba(255,255,255,0.5)" }} />
                <span style={{ position: "absolute", top: 26, right: 14, width: 12, height: 7, borderRadius: 4, background: "rgba(255,255,255,0.6)" }} />
                {/* 额外云朵 */}
                <span style={{ position: "absolute", top: 14, left: 60, width: 14, height: 8, borderRadius: 5, background: "rgba(255,255,255,0.55)", boxShadow: "5px 1px 0 -2px rgba(255,255,255,0.45)" }} />
                {/* 阳光光晕 */}
                <span style={{ position: "absolute", top: 8, left: 70, width: 16, height: 16, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,120,0.25) 0%, transparent 70%)", filter: "blur(2px)" }} />
              </>
            )}

            {/* 滑块（太阳/月亮） */}
            <div style={{
              position: "absolute",
              top: 4,
              left: isDark ? "calc(100% - 40px)" : 4,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: isDark
                ? "radial-gradient(circle at 30% 30%, #f5f3e1 0%, #e8e4c0 60%, #c9c498 100%)"
                : "radial-gradient(circle at 30% 30%, #fff7c2 0%, #ffd84d 60%, #ffb800 100%)",
              boxShadow: isDark
                ? "0 2px 10px rgba(0,0,0,0.4), inset -4px -4px 8px rgba(0,0,0,0.25)"
                : "0 2px 12px rgba(255,180,0,0.5), 0 0 20px rgba(255,200,80,0.4)",
              transition: "left 0.45s cubic-bezier(0.4, 0.0, 0.2, 1), background 0.4s, box-shadow 0.4s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}>
              {/* 月亮陨石坑 */}
              {isDark && (
                <>
                  <span style={{ position: "absolute", top: 8, left: 10, width: 5, height: 5, borderRadius: "50%", background: "rgba(0,0,0,0.12)" }} />
                  <span style={{ position: "absolute", top: 18, left: 22, width: 4, height: 4, borderRadius: "50%", background: "rgba(0,0,0,0.1)" }} />
                  <span style={{ position: "absolute", top: 22, left: 12, width: 3, height: 3, borderRadius: "50%", background: "rgba(0,0,0,0.08)" }} />
                </>
              )}
            </div>

            {/* 文字标签 */}
            <div style={{
              position: "absolute",
              top: 0, bottom: 0,
              left: isDark ? 14 : 48,
              right: isDark ? 48 : 14,
              display: "flex",
              alignItems: "center",
              justifyContent: isDark ? "flex-start" : "flex-end",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: isDark ? "rgba(255,255,255,0.92)" : "rgba(60,40,10,0.85)",
              transition: "all 0.45s cubic-bezier(0.4, 0.0, 0.2, 1)",
              zIndex: 1,
              pointerEvents: "none",
            }}>
              {isDark ? (
                <><MoonOutlined style={{ fontSize: 14 }} /> 深色</>
              ) : (
                <>浅色 <SunOutlined style={{ fontSize: 14 }} /></>
              )}
            </div>
          </div>
        </Card>
        </Dropdown>

        {/* === 字体选择 === */}
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16 }}
          styles={{ body: { padding: "14px 18px 20px" } }}
          title={<><FontSizeOutlined style={{ fontSize: 15 }} /> 字体与字号</>}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 8, marginBottom: 12,
          }}>
            {fontOptions.map((f) => {
              const isActive = font.id === f.id;
              const isLoading = fontLoadingId === f.id && fontLoadStatus === "loading";
              return (
              <div key={f.id} onClick={() => setFont(f)}
                style={{
                  position: "relative",
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  textAlign: "center", fontSize: 13,
                  background: isActive
                    ? `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`
                    : "var(--ant-color-fill-quaternary)",
                  border: isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                  boxShadow: isActive
                    ? `0 4px 14px ${accentColor}26, 0 0 0 3px ${accentColor}10`
                    : "0 1px 3px rgba(0,0,0,0.04)",
                  fontFamily: f.family ? `"${f.family}", sans-serif` : undefined,
                  fontWeight: isActive ? 600 : 400,
                  transition: "transform 0.2s ease, box-shadow 0.2s, background 0.2s, border-color 0.2s",
                  opacity: isLoading ? 0.65 : 1,
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}>
                {f.name}
                {isLoading && (
                  <span style={{
                    position: "absolute", top: 6, right: 8,
                    width: 10, height: 10, borderRadius: "50%",
                    border: "1.5px solid var(--ant-color-primary)",
                    borderTopColor: "transparent",
                    animation: "memories-font-spin 0.8s linear infinite",
                  }} />
                )}
                {/* 选中态右下角对勾 */}
                {isActive && !isLoading && (
                  <CheckCircleOutlined style={{
                    position: "absolute", bottom: 4, right: 6,
                    fontSize: 12, color: accentColor,
                  }} />
                )}
              </div>
              );
            })}
          </div>

          {/* 字体资源加载进度条 */}
          {fontLoadStatus !== "idle" && font.file && (
            <div style={{ marginBottom: 12, transition: "opacity 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {fontLoadStatus === "loading" && "正在加载字体资源…"}
                  {fontLoadStatus === "done" && "字体加载完成"}
                  {fontLoadStatus === "error" && "字体加载失败，已回退到默认加载"}
                </Text>
                {fontLoadStatus === "loading" && (
                  <Text type="secondary" style={{ fontSize: 11 }}>{fontLoadProgress}%</Text>
                )}
              </div>
              <Progress
                percent={fontLoadProgress}
                size="small"
                status={fontLoadStatus === "error" ? "exception" : fontLoadStatus === "done" ? "success" : "active"}
                showInfo={false}
                strokeColor={fontLoadStatus === "error" ? "#ff4d4f" : accentColor}
                trailColor="var(--ant-color-fill-quaternary)"
                style={{ marginBottom: 0, marginTop: 2 }}
              />
            </div>
          )}

          <Text type="secondary" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <FontSizeOutlined style={{ fontSize: 13 }} /> 字号
          </Text>
          <div style={{
            padding: "0 6px",
          }}>
            <Slider
              value={fontSize}
              min={12}
              max={18}
              step={null}
              marks={Object.fromEntries(fontSizes.map((s) => [s.value, s.label]))}
              tooltip={{ formatter: (v) => `${v}px` }}
              onChange={(v) => setFontSize(v as number)}
              style={{ marginBottom: 4 }}
              styles={{ track: { background: accentColor }, handle: { borderColor: accentColor } }}
            />
          </div>
        </Card>

        {/* === 缓存管理 === */}
        <Dropdown menu={{
          items: [
            { key: "clear", icon: <DeleteOutlined />, label: "清除所有缓存", danger: true },
          ],
          onClick: () => handleClearCache(),
        }} trigger={['contextMenu']}>
        <Card size="small" style={{ borderRadius: 12, marginBottom: 16, overflow: "hidden" }}
          styles={{ body: { padding: 0 } }}
          title={<><ClearOutlined style={{ fontSize: 15 }} /> 缓存管理</>}
          onContextMenu={(e) => e.stopPropagation()}>
          {/* 缓存总量展示 */}
          <div style={{
            padding: "16px 18px",
            background: `linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%)`,
            borderBottom: "1px solid var(--ant-color-border-secondary)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 2 }}>本地缓存总量</Text>
              <Text strong style={{
                fontSize: 24, fontWeight: 700,
                color: accentColor, lineHeight: 1.2,
              }}>{cacheSize}</Text>
            </div>
            <Popconfirm
              title="确定清除所有本地缓存？"
              description="将清除图片、列表、上传记录等缓存"
              onConfirm={handleClearCache}
              okText="清除" cancelText="取消"
              okButtonProps={{ danger: true }}>
              <Button danger size="middle" icon={<DeleteOutlined />}
                style={{
                  borderRadius: 10, fontWeight: 600,
                  background: "linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%",
                  border: "none", color: "#fff",
                  boxShadow: "0 4px 12px rgba(238,82,83,0.35)",
                }}>
                <span style={{ color: "#fff" }}>清除</span>
              </Button>
            </Popconfirm>
          </div>

          {/* 缓存分类明细 */}
          <div style={{ padding: "12px 18px" }}>
            {cacheBreakdown.map((item, idx) => {
              const isEmpty = item.bytes === 0;
              return (
                <div key={item.key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: idx < cacheBreakdown.length - 1 ? "1px dashed var(--ant-color-border-secondary)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isEmpty
                        ? "var(--ant-color-fill-quaternary)"
                        : `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
                      flexShrink: 0,
                    }}>
                      {item.key === "images_cache_"
                        ? <UnorderedListOutlined style={{ fontSize: 15, color: isEmpty ? "var(--ant-color-text-tertiary)" : accentColor }} />
                        : <CloudUploadOutlined style={{ fontSize: 15, color: isEmpty ? "var(--ant-color-text-tertiary)" : accentColor }} />}
                    </div>
                    <div>
                      <Text style={{ fontSize: 13, display: "block", lineHeight: 1.3 }}>{item.label}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {isEmpty ? "暂无缓存" : "已缓存"}
                      </Text>
                    </div>
                  </div>
                  <Text style={{
                    fontSize: 13, fontWeight: 600,
                    color: isEmpty ? "var(--ant-color-text-tertiary)" : accentColor,
                    fontVariantNumeric: "tabular-nums",
                  }}>{formatBytes(item.bytes)}</Text>
                </div>
              );
            })}
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 10, textAlign: "center" }}>
              清除列表、上传记录等本地缓存
            </Text>
          </div>
        </Card>
        </Dropdown>

        {/* === 官网 === */}
        <a
          href="https://memories.mrcwoods.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "block" }}
        >
          <Card size="small" hoverable
            style={{
              borderRadius: 16, marginBottom: 16,
              position: "relative", overflow: "hidden",
              background: `linear-gradient(135deg, ${accentColor}12 0%, ${accentColor}06 60%, transparent 100%)`,
              border: `1px solid ${accentColor}28`,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: `0 2px 8px ${accentColor}10`,
            }}
            styles={{ body: { padding: "18px 20px" } }}>
            {/* 装饰光晕 */}
            <div style={{
              position: "absolute", top: -30, right: -30,
              width: 120, height: 120, borderRadius: "50%",
              background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative" }}>
              {/* Logo 容器 */}
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, padding: 7,
                boxShadow: `0 4px 14px ${accentColor}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
                <LogoIcon size={34} style={{ width: 34, height: 34 }} />
              </div>
              {/* 文字内容 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontSize: 15, display: "block", marginBottom: 2 }}>
                  Memories 官方网站
                </Text>
                <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                  了解功能详情 · 下载客户端 · 查看更新日志
                </Text>
              </div>
              {/* 跳转箭头 */}
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${accentColor}14`,
                flexShrink: 0,
              }}>
                <ExportOutlined style={{ fontSize: 16, color: accentColor }} />
              </div>
            </div>
          </Card>
        </a>

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
      </Dropdown>
      </div>
    </div>
  );
}
