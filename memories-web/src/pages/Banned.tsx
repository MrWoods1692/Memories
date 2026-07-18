import { Button, Card, Typography, Divider, App } from "antd";
import { EyeOutlined, MailOutlined, StopOutlined, CopyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const { Title, Paragraph } = Typography;

const APPEAL_EMAIL = "mail@mrcwoods.com";

export default function BannedPage() {
  const navigate = useNavigate();
  const { clearBanned } = useAuth();
  const { isDark } = useTheme();
  const { message } = App.useApp();

  const handleGuest = () => {
    clearBanned();
    navigate("/gallery");
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(APPEAL_EMAIL);
      message.success("邮箱地址已复制");
    } catch {
      // fallback for older browsers
      message.info(`邮箱地址: ${APPEAL_EMAIL}`);
    }
  };

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isDark
      ? "linear-gradient(160deg, #1a0a0a 0%, #2d0a0a 40%, #1a0a0a 100%)"
      : "linear-gradient(160deg, #FFF0F0 0%, #FFE0E0 40%, #FFD4D4 100%)",
    padding: "20px",
    transition: "background 0.3s",
  };

  return (
    <div style={pageBg}>
      <Card
        style={{
          maxWidth: 440, width: "100%",
          borderRadius: 20,
          borderColor: isDark ? "#4a1a1a" : "#FFB8B8",
          background: isDark ? "var(--ant-color-bg-container)" : "#FFFBFB",
        }}
        styles={{ body: { padding: "36px 32px", textAlign: "center" } }}
      >
        {/* 封禁图标 */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: isDark ? "rgba(255, 77, 79, 0.15)" : "rgba(255, 77, 79, 0.08)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
          border: `3px solid ${isDark ? "#8B2020" : "#FF7875"}`,
        }}>
          <StopOutlined style={{ fontSize: 36, color: isDark ? "#FF7875" : "#F5222D" }} />
        </div>

        <Title level={2} style={{
          marginBottom: 4, fontWeight: 800,
          color: isDark ? "#FF7875" : "#F5222D",
        }}>
          账号已封禁
        </Title>

        <Paragraph style={{ marginBottom: 8, fontSize: 15, color: isDark ? "#cf9a9a" : "#8C1A1A" }}>
          您的账号因违规行为已被管理员封禁
        </Paragraph>

        <Divider style={{ margin: "16px 0", borderColor: isDark ? "#4a1a1a" : "#FFB8B8" }} />

        {/* 申诉提示 */}
        <div style={{
          background: isDark ? "rgba(255,77,79,0.08)" : "#FFF0F0",
          borderRadius: 12, padding: "16px",
          marginBottom: 20,
          border: `1px solid ${isDark ? "#4a1a1a" : "#FFD4D4"}`,
        }}>
          <MailOutlined style={{ fontSize: 20, color: isDark ? "#FF7875" : "#F5222D", marginBottom: 8 }} />
          <Paragraph style={{ marginBottom: 4, fontSize: 13 }}>
            如需申诉解封，请发送邮件至
          </Paragraph>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <a
              href={`mailto:${APPEAL_EMAIL}`}
              style={{
                fontSize: 15, fontWeight: 600,
                color: isDark ? "#FF7875" : "#F5222D",
                textDecoration: "underline",
                wordBreak: "break-all",
              }}
            >
              {APPEAL_EMAIL}
            </a>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopyEmail}
              style={{ color: isDark ? "#FF7875" : "#F5222D", fontSize: 14 }}
              title="复制邮箱"
            />
          </div>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 4, fontSize: 12 }}>
            请在邮件中附上您的 QQ 号、学生证照片和申诉理由
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 11, fontStyle: "italic" }}>
            附上学生证可加快审核处理速度
          </Paragraph>
        </div>

        {/* 广场按钮 */}
        <Button
          size="large"
          block
          icon={<EyeOutlined />}
          onClick={handleGuest}
          style={{
            height: 48, fontSize: 15, fontWeight: 500,
            borderRadius: 14,
            background: isDark ? "rgba(255,255,255,0.06)" : "#FFF",
            borderColor: isDark ? "#4a1a1a" : "#FFB8B8",
          }}
        >
          游客浏览广场
        </Button>

        <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          封禁期间仍可浏览广场图片，但无法执行上传等操作
        </Paragraph>
      </Card>
    </div>
  );
}
