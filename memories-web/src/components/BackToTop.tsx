import { useCallback, useEffect, useState } from "react";
import { VerticalAlignTopOutlined } from "@ant-design/icons";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    setVisible(scrollTop > 300);
    setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 彩色进度环参数
  const size = 44;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  if (!visible) return null;

  return (
    <div
      className="back-to-top"
      onClick={scrollToTop}
      style={{
        position: "fixed",
        bottom: 80,
        right: 20,
        zIndex: 999,
        width: size,
        height: size,
        cursor: "pointer",
      }}
    >
      {/* 彩色渐变进度环 */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: "rotate(-90deg)",
        }}
      >
        <defs>
          <linearGradient id="btp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E76F51" />
            <stop offset="25%" stopColor="#E9C46A" />
            <stop offset="50%" stopColor="#53C49E" />
            <stop offset="75%" stopColor="#2A9D8F" />
            <stop offset="100%" stopColor="#E76F51" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#btp-grad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.15s ease-out" }}
        />
      </svg>

      {/* 按钮 */}
      <div
        style={{
          position: "absolute",
          top: strokeWidth,
          left: strokeWidth,
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: "50%",
          background: "var(--ant-color-bg-container)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        className="back-to-top-btn"
      >
        <VerticalAlignTopOutlined
          style={{
            fontSize: 18,
            color: "var(--ant-color-primary)",
            transition: "transform 0.2s",
          }}
        />
      </div>
    </div>
  );
}
