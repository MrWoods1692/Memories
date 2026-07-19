import { useEffect, useState } from "react";
import { Alert, Button, Card, Result, Spin, Tag, Typography, Divider } from "antd";
import { HeartOutlined, LoginOutlined, EyeOutlined, ReloadOutlined, WifiOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { checkHealth } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import LogoIcon from "@/components/LogoIcon";

const { Title, Paragraph, Text } = Typography;

export default function LoginPage() {
  const { startLogin, isLoggedIn, oauthError, clearOAuthError } = useAuth();
  const navigate = useNavigate();
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const { isDark, accentColor } = useTheme();

  useEffect(() => {
    checkHealth()
      .then(() => setHealthOk(true))
      .catch(() => setHealthOk(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      navigate("/gallery", { replace: true });
    }
  }, [isLoggedIn, navigate]);

  const handleRetry = () => {
    setChecking(true);
    setHealthOk(null);
    checkHealth()
      .then(() => setHealthOk(true))
      .catch(() => setHealthOk(false))
      .finally(() => setChecking(false));
  };

  const handleGuest = () => {
    navigate("/gallery");
  };

  // 发起登录：清除上一次错误状态，防止重复点击
  const handleLogin = () => {
    if (loggingIn) return;
    clearOAuthError();
    setLoggingIn(true);
    startLogin();
    // 5 秒兜底恢复（正常情况下页面已跳走）
    setTimeout(() => setLoggingIn(false), 5000);
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
        <div style={{ textAlign: "center" }}>
          <WifiOutlined style={{ fontSize: 48, color: accentColor, marginBottom: 20, animation: "skeletonPulse 1.5s ease-in-out infinite" }} />
          <Spin size="large" />
          <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 14 }}>
            正在连接服务器...
          </Paragraph>
        </div>
      </div>
    );
  }

  // 服务器离线状态
  if (healthOk === false) {
    return (
      <div style={pageBg}>
        <Card
          style={{ maxWidth: 420, width: "100%", borderRadius: 20, boxShadow: `0 8px 40px rgba(0,0,0,0.1)` }}
          styles={{ body: { padding: "36px 32px", textAlign: "center" } }}
        >
          <LogoIcon size={64} style={{ marginBottom: 12, opacity: 0.6 }} />

          <Result
            status="warning"
            icon={
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "var(--ant-color-fill-quaternary)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 8,
              }}>
                <WifiOutlined style={{ fontSize: 40, color: "var(--ant-color-text-quaternary)" }} />
              </div>
            }
            title={<Text strong style={{ fontSize: 18 }}>服务器暂不可用</Text>}
            subTitle={
              <div>
                <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                  无法连接到 Memories 后端服务
                </Paragraph>
                <Tag color="error" style={{ borderRadius: 10, padding: "2px 12px", marginBottom: 8 }}>
                  🔴 连接失败
                </Tag>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  请检查网络连接，或稍后再试
                </Paragraph>
              </div>
            }
          >
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRetry}
                style={{ borderRadius: 14, height: 42, minWidth: 140 }}
              >
                重新连接
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={handleGuest}
                style={{ borderRadius: 14, height: 42, minWidth: 140 }}
              >
                离线浏览缓存
              </Button>
            </div>
          </Result>
        </Card>
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
            <Tag color="success" style={{ borderRadius: 10, padding: "2px 12px" }}>
              🟢 服务器运行中
            </Tag>
          </div>

          {/* OAuth 回调错误提示（frp 瞬断、state 过期等） */}
          {oauthError && (
            <Alert
              style={{ marginBottom: 16, borderRadius: 12, textAlign: "left" }}
              showIcon
              type={oauthError.retryable ? "warning" : "error"}
              icon={<ExclamationCircleOutlined />}
              message={oauthError.retryable ? "登录遇到问题" : "登录失败"}
              description={
                <div>
                  <Paragraph style={{ marginBottom: 4, fontSize: 13 }}>
                    {oauthError.message}
                  </Paragraph>
                  {oauthError.retryable && (
                    <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
                      请点击下方按钮重新登录；若反复失败可尝试清除浏览器缓存或使用无痕模式。
                    </Paragraph>
                  )}
                </div>
              }
              closable
              onClose={clearOAuthError}
            />
          )}

          <Button type="primary" size="large" block
            onClick={handleLogin} icon={<LoginOutlined />} loading={loggingIn}
            style={{ height: 48, fontSize: 16, fontWeight: 600, borderRadius: 14 }}>
            {loggingIn ? "正在跳转..." : "校园墙 OAuth 授权登录"}
          </Button>

          <Divider plain style={{ margin: "16px 0" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>或者</Text>
          </Divider>

          <Button size="large" block
            onClick={handleGuest} icon={<EyeOutlined />}
            style={{ height: 48, fontSize: 16, fontWeight: 500, borderRadius: 14 }}>
            游客访问广场
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
