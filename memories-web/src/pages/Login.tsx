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
  const { isDark } = useTheme();

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

  // 简洁黑白灰配色（不跟随主题 accentColor，但亮/暗模式跟随）
  const palette = isDark
    ? {
        // 深色模式：纯黑星空
        starColor: "rgba(255,255,255,0.85)",
        starDim: "rgba(255,255,255,0.35)",
        shootingStar: "rgba(255,255,255,0.9)",
        cardBg: "rgba(18,18,20,0.55)",
        cardBorder: "rgba(255,255,255,0.12)",
        cardShadow: "0 24px 64px rgba(0,0,0,0.6)",
        sheen: "rgba(255,255,255,0.18)",
        textGrad: "linear-gradient(120deg, #ffffff 0%, #a8a8a8 100%)",
        btnGrad: "rgba(255,255,255,0.06)",
        btnBorder: "rgba(255,255,255,0.92)",
        btnShadow: "0 8px 24px rgba(0,0,0,0.5)",
        btnGlow: "rgba(255,255,255,0.25)",
        btnText: "#ffffff",
        btnHoverBg: "rgba(255,255,255,0.14)",
        pageBg: "#050507",
      }
    : {
        // 浅色模式：浅灰白星空
        starColor: "rgba(40,40,45,0.7)",
        starDim: "rgba(80,80,85,0.3)",
        shootingStar: "rgba(40,40,45,0.8)",
        cardBg: "rgba(255,255,255,0.6)",
        cardBorder: "rgba(255,255,255,0.8)",
        cardShadow: "0 24px 64px rgba(120,120,130,0.22)",
        sheen: "rgba(255,255,255,0.6)",
        textGrad: "linear-gradient(120deg, #1a1a1a 0%, #6b6b6b 100%)",
        btnGrad: "#ffffff",
        btnBorder: "#111111",
        btnShadow: "0 8px 24px rgba(17,17,17,0.18)",
        btnGlow: "rgba(17,17,17,0.10)",
        btnText: "#111111",
        btnHoverBg: "#f5f5f5",
        pageBg: "linear-gradient(180deg, #f4f5f7 0%, #e9eaee 100%)",
      };

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: palette.pageBg,
    padding: "20px",
    transition: "background 0.4s ease",
    position: "relative",
    overflow: "hidden",
  };

  // 背景装饰：星空 + 流星
  const FloatingOrbs = () => {
    // 生成 60 颗随机分布的星星
    const stars = Array.from({ length: 60 }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      const rnd2 = ((seed * 7) % 233280) / 233280;
      const rnd3 = ((seed * 13) % 233280) / 233280;
      const top = rnd * 100;
      const left = rnd2 * 100;
      const size = 1 + rnd3 * 2.5;
      const delay = rnd * 5;
      const duration = 2 + rnd2 * 4;
      const dim = i % 4 === 0;
      return { top, left, size, delay, duration, dim, key: i };
    });
    return (
      <>
        {/* 星星 */}
        {stars.map((s) => (
          <div key={s.key} style={{
            position: "absolute",
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: s.dim ? palette.starDim : palette.starColor,
            boxShadow: s.dim ? "none" : `0 0 ${s.size * 2}px ${palette.starColor}`,
            animation: `memories-star-twinkle ${s.duration}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
            pointerEvents: "none",
          }} />
        ))}
        {/* 流星 1 */}
        <div style={{
          position: "absolute",
          top: "10%", right: "5%",
          width: 120, height: 1.5,
          background: `linear-gradient(90deg, transparent 0%, ${palette.shootingStar} 100%)`,
          borderRadius: 1,
          boxShadow: `0 0 6px ${palette.shootingStar}`,
          animation: "memories-shooting-star 8s ease-in infinite",
          animationDelay: "2s",
          opacity: 0,
          pointerEvents: "none",
        }} />
        {/* 流星 2 */}
        <div style={{
          position: "absolute",
          top: "25%", right: "20%",
          width: 90, height: 1,
          background: `linear-gradient(90deg, transparent 0%, ${palette.shootingStar} 100%)`,
          borderRadius: 1,
          boxShadow: `0 0 5px ${palette.shootingStar}`,
          animation: "memories-shooting-star 11s ease-in infinite",
          animationDelay: "6s",
          opacity: 0,
          pointerEvents: "none",
        }} />
        {/* 远处星云光晕 - 极淡 */}
        <div style={{
          position: "absolute", top: "20%", left: "15%",
          width: 300, height: 300, borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(180,180,200,0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "10%", right: "12%",
          width: 260, height: 260, borderRadius: "50%",
          background: isDark
            ? "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(160,160,180,0.08) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }} />
      </>
    );
  };

  // 玻璃卡片通用样式
  const glassCard: React.CSSProperties = {
    maxWidth: 440, width: "100%", borderRadius: 28,
    boxShadow: palette.cardShadow,
    backdropFilter: "blur(24px) saturate(160%)",
    WebkitBackdropFilter: "blur(24px) saturate(160%)",
    background: palette.cardBg,
    border: `1px solid ${palette.cardBorder}`,
    position: "relative", zIndex: 1,
    animation: "memories-card-in 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
    overflow: "hidden",
  };

  // 卡片顶部高光条
  const CardSheen = () => (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${palette.sheen} 50%, transparent 100%)`,
      pointerEvents: "none",
    }} />
  );

  if (checking) {
    return (
      <div style={pageBg}>
        <FloatingOrbs />
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-block",
            padding: 24, borderRadius: "50%",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
            marginBottom: 20,
            animation: "memories-logo-breathe 2s ease-in-out infinite",
            boxShadow: isDark ? "0 0 40px rgba(255,255,255,0.12)" : "0 0 40px rgba(120,120,130,0.18)",
          }}>
            <WifiOutlined style={{ fontSize: 44, color: isDark ? "#ffffff" : "#1a1a1a" }} />
          </div>
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
        <FloatingOrbs />
        <Card
          style={glassCard}
          styles={{ body: { padding: "40px 32px", textAlign: "center" } }}
        >
          <CardSheen />
          <Result
            status="warning"
            icon={
              <div style={{
                width: 84, height: 84, borderRadius: "50%",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 8,
                animation: "memories-logo-breathe 2.5s ease-in-out infinite",
                boxShadow: isDark ? "0 0 36px rgba(255,255,255,0.10)" : "0 0 36px rgba(120,120,130,0.16)",
              }}>
                <WifiOutlined style={{ fontSize: 40, color: isDark ? "#ffffff" : "#1a1a1a" }} />
              </div>
            }
            title={<Text strong style={{ fontSize: 18, color: isDark ? "#ffffff" : "#1a1a1a" }}>服务器暂不可用</Text>}
            subTitle={
              <div>
                <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                  无法连接到 Memories 后端服务
                </Paragraph>
                <Tag style={{
                  borderRadius: 12, padding: "3px 14px", marginBottom: 8, fontWeight: 500,
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.06)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.18)"}`,
                  color: isDark ? "rgba(255,255,255,0.85)" : "rgba(17,17,17,0.85)",
                }}>
                  ⚠ 连接失败
                </Tag>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  请检查网络连接，或稍后再试
                </Paragraph>
              </div>
            }
          >
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRetry}
                style={{
                  borderRadius: 14, height: 44, minWidth: 140, fontWeight: 600,
                  background: palette.btnGrad,
                  color: palette.btnText,
                  border: `2px solid ${palette.btnBorder}`,
                  boxShadow: palette.btnShadow,
                }}
              >
                重新连接
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={handleGuest}
                style={{
                  borderRadius: 14, height: 44, minWidth: 140, fontWeight: 500,
                  color: isDark ? "rgba(255,255,255,0.85)" : "rgba(17,17,17,0.85)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.18)"}`,
                }}
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
      <FloatingOrbs />
      <Card
        style={glassCard}
        styles={{ body: { padding: "44px 36px" } }}
      >
        <CardSheen />
        <div style={{ textAlign: "center" }}>
          {/* Logo 呼吸动画 + 光晕 */}
          <div style={{
            display: "inline-block",
            padding: 14, borderRadius: "50%",
            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
            marginBottom: 14,
            animation: "memories-logo-breathe 3s ease-in-out infinite",
            boxShadow: isDark ? "0 0 36px rgba(255,255,255,0.12)" : "0 0 36px rgba(120,120,130,0.18)",
            position: "relative",
          }}>
            <LogoIcon size={76} />
          </div>

          <Title level={2} style={{
            marginBottom: 4, fontWeight: 800,
            color: isDark ? "#ffffff" : "#1a1a1a",
          }}>
            Memories
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 20 }}>
            校园墙回忆 · 珍藏每一刻美好
          </Paragraph>

          {/* 服务器状态指示器 */}
          <div style={{ marginBottom: 24, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: "#52c41a",
              boxShadow: "0 0 0 4px rgba(82,196,26,0.2)",
              animation: "memories-status-pulse 2s ease-in-out infinite",
            }} />
            <Text type="secondary" style={{ fontSize: 13 }}>服务器运行中</Text>
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

          {/* 主登录按钮：黑白简约 · 黑色加粗描边 */}
          <Button size="large" block
            onClick={handleLogin} icon={<LoginOutlined />} loading={loggingIn}
            style={{
              height: 52, fontSize: 16, fontWeight: 700, borderRadius: 14,
              background: palette.btnGrad,
              color: palette.btnText,
              border: `2px solid ${palette.btnBorder}`,
              boxShadow: palette.btnShadow,
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = palette.btnHoverBg;
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 12px 28px ${palette.btnGlow}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = palette.btnGrad;
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = palette.btnShadow;
            }}
          >
            {loggingIn ? "正在跳转..." : "校园墙 OAuth 授权登录"}
          </Button>

          <Divider plain style={{ margin: "18px 0" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>或者</Text>
          </Divider>

          <Button size="large" block
            onClick={handleGuest} icon={<EyeOutlined />}
            style={{ height: 50, fontSize: 16, fontWeight: 500, borderRadius: 14 }}>
            游客访问广场
          </Button>

          <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <HeartOutlined style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(80,80,85,0.6)", fontSize: 13 }} />
            <Text type="secondary" style={{ fontSize: 13 }}>
              登录即表示同意服务协议
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
