import { useState } from "react";
import { Button, Checkbox, Modal, theme, Typography } from "antd";
import { ArrowRightOutlined, LinkOutlined } from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeContext";
import LogoIcon from "@/components/LogoIcon";

const { Title, Paragraph } = Typography;

// v2：关闭不再默认写入；只有勾选「不再提示」才持久化
const SEEN_KEY = "memories_first_visit_seen_v2";

// 老网站项目「沙塘大道第一墙」的新域名
const OLD_SITE_URL = "https://gz.campux.top";
// 老网站项目 Logo
const OLD_SITE_ICON = "https://img.cdn1.vip/i/69635b99b1e51_1768119193.webp";
// 本项目（Memories）地址
const MEMORIES_URL = "https://memories.mrcwoods.com";

/** 读取是否已经提示过，localStorage 不可用时按「未提示」处理以保证用户能看到说明 */
function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function FirstVisitModal() {
  const { isDark, accentColor } = useTheme();
  // 跟随用户在「主题」里选的字体，与页面其余部分保持一致
  const { token: { fontFamily } } = theme.useToken();
  const [open, setOpen] = useState(() => !hasSeen());
  // 未勾选时只关本次会话，刷新/下次打开仍会弹出
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const close = () => {
    if (dontShowAgain) markSeen();
    setOpen(false);
  };

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const linkCard = (
    title: string,
    desc: string,
    url: string,
    tone: "accent" | "secondary",
    // 可选：站点自身 Logo 图片地址，不传时用 LinkOutlined 图标
    iconUrl?: string
  ) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        openLink(url);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        textDecoration: "none",
        background: tone === "accent"
          ? `${accentColor}14`
          : isDark ? "rgba(255,255,255,0.05)" : "#f5f5f5",
        border: `1px solid ${tone === "accent" ? `${accentColor}55` : "var(--ant-color-border-secondary)"}`,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 6px 16px -8px ${accentColor}66`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          // 图片 Logo 用圆形裁剪，图标分支保持圆角方块
          borderRadius: iconUrl ? "50%" : 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: iconUrl
            ? "#fff"
            : tone === "accent"
              ? accentColor
              : isDark ? "rgba(255,255,255,0.10)" : "#fff",
          color: tone === "accent" ? "#fff" : isDark ? "#d0d0d0" : accentColor,
        }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={title}
            width={36}
            height={36}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <LinkOutlined style={{ fontSize: 16 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ant-color-text)" }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "var(--ant-color-text-secondary)", wordBreak: "break-all" }}>
          {desc}
        </div>
      </div>
      <ArrowRightOutlined style={{ fontSize: 12, color: "var(--ant-color-text-quaternary)", flexShrink: 0 }} />
    </a>
  );

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      maskClosable
      width={420}
      centered
      styles={{
        // 蒙层虚化：backdrop-filter 需作用于蒙层自身（mask 层），而非弹窗 content
        mask: {
          background: isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(255, 255, 255, 0.68)",
          backdropFilter: "blur(8px) saturate(120%)",
          WebkitBackdropFilter: "blur(8px) saturate(120%)",
          transition: "background-color 0.25s",
        },
        content: {
          borderRadius: 20,
          padding: "28px 24px 22px",
          overflow: "hidden",
          maxWidth: "calc(100vw - 32px)",
          // font-family 可继承，声明在 content 根节点即可覆盖弹窗内所有文字
          fontFamily,
          background: isDark ? "var(--ant-color-bg-container)" : "#ffffff",
        },
        body: { padding: 0 },
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            margin: "0 auto 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${accentColor}14`,
            border: `1px solid ${accentColor}33`,
          }}
        >
          <LogoIcon size={44} />
        </div>
        <Title level={3} style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          欢迎来到 Memories
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
          这是校园墙回忆的<span style={{ color: accentColor, fontWeight: 600 }}>新项目</span>；
          老网站项目「沙塘大道第一墙」已启用新域名，两个站点都可以正常访问。
        </Paragraph>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {linkCard("沙塘大道第一墙", `老网站项目 · ${OLD_SITE_URL}`, OLD_SITE_URL, "accent", OLD_SITE_ICON)}
        {linkCard("Memories", `本项目 · ${MEMORIES_URL}`, MEMORIES_URL, "secondary")}
      </div>

      <Button
        size="large"
        block
        onClick={close}
        style={{
          height: 46,
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        我知道了
      </Button>

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Checkbox
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          style={{ fontSize: 13, color: "var(--ant-color-text-secondary)" }}
        >
          不再提示
        </Checkbox>
      </div>
    </Modal>
  );
}
