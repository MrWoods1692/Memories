import { useEffect, useState } from "react";
import { Button, Card, Result, Spin, Tag, Typography } from "antd";
import { HeartOutlined, LoginOutlined } from "@ant-design/icons";
import { checkHealth } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import LogoIcon from "@/components/LogoIcon";

const { Title, Paragraph, Text } = Typography;

export default function LoginPage() {
  const { startLogin } = useAuth();
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const { preset, isDark } = useTheme();
  const accentColor = preset.config.token?.colorPrimary || "#1D6E5A";

  useEffect(() => {
    checkHealth()
      .then(() => setHealthOk(true))
      .catch(() => setHealthOk(false))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = () => {
    startLogin();
  };

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: isDark
      ? "var(--ant-color-bg-layout)"
      : "linear-gradient(160deg, #F8F7F2 0%, #EAF5F0 40%, #D4EDE2 100%)",
    padding: "20px",
    transition: "background 0.3s",
  };

  if (checking) {
    return (
      <div style={pageBg}>
        <Spin size="large" tip="正在检查服务器状态...">
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <Card
        style={{ maxWidth: 420, width: "100%", borderRadius: 20, boxShadow: `0 8px 40px ${accentColor}1F` }}
        styles={{ body: { padding: "36px 32px" } }}
      >
        <div style={{ textAlign: "center" }}>
          <LogoIcon size={80} style={{ marginBottom: 12 }} />

          <Title level={2} style={{ marginBottom: 4, fontWeight: 800, color: accentColor }}>
            Memories
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            校园墙回忆 · 珍藏每一刻美好
          </Paragraph>

          <div style={{ marginBottom: 24 }}>
            <Tag color={healthOk ? "success" : "error"} style={{ borderRadius: 10, padding: "2px 12px" }}>
              {healthOk ? "🟢 服务器运行中" : "🔴 服务器离线"}
            </Tag>
          </div>

          {healthOk === false && (
            <Result status="500" title="服务器暂不可用" subTitle="请稍后重试，或联系管理员" />
          )}

          <Button type="primary" size="large" block
            disabled={!healthOk}
            onClick={handleLogin} icon={<LoginOutlined />}
            style={{ height: 48, fontSize: 16, fontWeight: 600, borderRadius: 14 }}>
            校园墙 OAuth 授权登录
          </Button>

          <div style={{ marginTop: 20 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              <HeartOutlined /> 登录即表示同意服务协议
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
