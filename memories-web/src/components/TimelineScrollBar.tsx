import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { theme } from "antd";
import { FieldTimeOutlined, CaretUpOutlined, CaretDownOutlined } from "@ant-design/icons";
import type { ImageItem } from "@/types";

export type GalleryView =
  | "grid" | "compact" | "list" | "simple"
  | "river" | "masonry" | "timeline" | "free";

interface TimelineScrollBarProps {
  images: ImageItem[];
  accentColor: string;
  isDesktop: boolean;
  viewMode: GalleryView;
  /** 时间线视图下当前激活的日期（zh-CN 格式），用于在选中的天内精细滚动 */
  timelineActiveDate?: string;
}

/** zh-CN 日期: "2026/7/19" */
function getDateStr(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN");
}

/** 排序键: YYYYMMDD */
function dateSortKey(dateStr: string): number {
  const parts = dateStr.split("/");
  return parts.length === 3
    ? parseInt(parts[0]) * 10000 + parseInt(parts[1]) * 100 + parseInt(parts[2])
    : 0;
}

/** 提取小时标签: "14时" */
function getHourLabel(ts: number): string {
  return `${new Date(ts).getHours()}时`;
}

export default function TimelineScrollBar({
  images,
  accentColor,
  isDesktop,
  viewMode,
  timelineActiveDate,
}: TimelineScrollBarProps) {
  const [activeDate, setActiveDate] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { token: themeToken } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── 日期分组 ──
  const dateGroups = useMemo(() => {
    const map = new Map<string, { count: number; ids: number[] }>();
    images.forEach((img) => {
      const d = getDateStr(img.created_at);
      const entry = map.get(d);
      if (entry) {
        entry.count++;
        entry.ids.push(img.created_at);
      } else {
        map.set(d, { count: 1, ids: [img.created_at] });
      }
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => dateSortKey(b) - dateSortKey(a));
  }, [images]);

  // ── 时间线模式：当前激活日期下的按小时分组 ──
  const hourGroupsForActiveDate = useMemo(() => {
    if (viewMode !== "timeline" || !timelineActiveDate) return [];
    const imgs = images
      .filter((img) => getDateStr(img.created_at) === timelineActiveDate)
      .sort((a, b) => a.created_at - b.created_at); // 时间升序
    const map = new Map<string, { count: number; firstId: number }>();
    imgs.forEach((img) => {
      const h = getHourLabel(img.created_at);
      const entry = map.get(h);
      if (entry) {
        entry.count++;
      } else {
        map.set(h, { count: 1, firstId: img.created_at });
      }
    });
    return Array.from(map.entries());
  }, [images, viewMode, timelineActiveDate]);

  const isTimelineMode = viewMode === "timeline";

  // ── IntersectionObserver：跟踪可见日期 ──
  useEffect(() => {
    if (!isDesktop || viewMode === "free") return;
    if (observerRef.current) observerRef.current.disconnect();

    if (isTimelineMode) {
      if (timelineActiveDate) setActiveDate(timelineActiveDate);
      return;
    }

    const dateElMap = new Map<string, Element>();
    const visibleSet = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const date = (entry.target as HTMLElement).dataset.galleryDate;
          if (!date) return;
          if (entry.isIntersecting) visibleSet.add(date);
          else visibleSet.delete(date);
        });

        if (visibleSet.size > 0) {
          let best = "";
          let bestTop = Infinity;
          visibleSet.forEach((d) => {
            const el = dateElMap.get(d);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top < bestTop) { bestTop = rect.top; best = d; }
            }
          });
          if (best) setActiveDate(best);
        }
      },
      { threshold: 0, rootMargin: "-8% 0px -60% 0px" },
    );

    dateGroups.forEach(([date]) => {
      const el = document.querySelector(`[data-gallery-date="${date}"]`);
      if (el) {
        dateElMap.set(date, el);
        observerRef.current?.observe(el);
      }
    });

    return () => observerRef.current?.disconnect();
  }, [isDesktop, viewMode, dateGroups, isTimelineMode, timelineActiveDate]);

  // ── 点击跳转 ──
  const scrollToDate = useCallback((date: string) => {
    const target = document.querySelector(`[data-gallery-date="${date}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveDate(date);
    setMobileOpen(false);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileOpen(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    setMobileOpen(false);
  }, []);

  const scrollToImage = useCallback((imgId: number) => {
    const target = document.querySelector(`[data-gallery-id="${imgId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // ── 移动端点击外部关闭 ──
  useEffect(() => {
    if (!mobileOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (
        mobilePanelRef.current?.contains(t) ||
        containerRef.current?.contains(t)
      ) return;
      setMobileOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown, { passive: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [mobileOpen]);

  // ── 自由视图：完全隐藏 ──
  if (viewMode === "free") return null;

  // ========== 侧边长条按钮 + 弹出面板（电脑端与手机端一致） ==========
  return (
      <>
        {/* 触发按钮 — 长条、两头圆 */}
        <div
          ref={containerRef}
          onClick={() => setMobileOpen((p) => !p)}
          style={{
            position: "fixed",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 996,
            width: 32,
            height: 120,
            borderRadius: 16,
            background: accentColor,
            boxShadow: `0 2px 16px ${accentColor}66`,
            border: `2px solid color-mix(in srgb, ${accentColor} 85%, #fff)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            cursor: "pointer",
            userSelect: "none",
            color: "#fff",
            transition: "transform 0.2s, box-shadow 0.2s",
            padding: "6px 0",
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = "translateY(-50%) scale(0.95)";
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = "translateY(-50%) scale(1)";
          }}
        >
            <FieldTimeOutlined style={{ fontSize: 14, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
          <span style={{
            fontSize: 7,
            opacity: 0.8,
            writingMode: "vertical-rl",
            textOrientation: "mixed",
          }}>
            日期
          </span>
        </div>

        {/* 弹出面板 */}
        <div
          ref={mobilePanelRef}
          style={{
            position: "fixed",
            right: mobileOpen ? 40 : -200,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 995,
            width: 160,
            maxHeight: "min(420px, 70vh)",
            overflowY: "auto",
            background: themeToken.colorBgContainer,
            borderRadius: "14px 0 0 14px",
            boxShadow: "-2px 0 24px rgba(0,0,0,0.18)",
            border: `1px solid ${themeToken.colorBorderSecondary}`,
            padding: "10px 6px",
            display: "flex",
            flexDirection: "column",
            gap: 1,
            transition: "right 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            pointerEvents: mobileOpen ? "auto" : "none",
            opacity: mobileOpen ? 1 : 0,
          }}
        >
          {/* 快速到顶部/底部 */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6 }}>
            <div onClick={scrollToTop} style={mobileQuickBtn(accentColor)}>
              <CaretUpOutlined /> 顶部
            </div>
            <div onClick={scrollToBottom} style={mobileQuickBtn(accentColor)}>
              <CaretDownOutlined /> 底部
            </div>
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: accentColor,
            textAlign: "center",
            marginBottom: 4,
          }}>
            <FieldTimeOutlined style={{ marginRight: 4 }} />
            {isTimelineMode && timelineActiveDate ? timelineActiveDate : "日期导航"}
          </div>

          {/* 时间线模式：按小时分组 */}
          {isTimelineMode && hourGroupsForActiveDate.length > 0 ? (
            <>
              {/* 小时分组 */}
              {hourGroupsForActiveDate.map(([hour, { count, firstId }]) => (
                <div
                  key={hour}
                  onClick={() => {
                    scrollToImage(firstId);
                    setMobileOpen(false);
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--ant-color-text)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${accentColor}0A`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontWeight: 500 }}>{hour}</span>
                  <span style={{
                    fontSize: 10,
                    color: accentColor,
                    background: `${accentColor}14`,
                    padding: "1px 6px",
                    borderRadius: 10,
                  }}>
                    {count}张
                  </span>
                </div>
              ))}
            </>
          ) : (
            /* 常规模式：日期列表 */
            dateGroups.map(([date, { count }]) => {
              const isActive = date === activeDate;
              const parts = date.split("/");
              const label = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : date;
              return (
                <div
                  key={date}
                  onClick={() => scrollToDate(date)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? accentColor : "var(--ant-color-text)",
                    background: isActive ? `${accentColor}10` : "transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{label}</span>
                  <span style={{
                    fontSize: 10,
                    color: "var(--ant-color-text-quaternary)",
                  }}>
                    {count}张
                  </span>
                </div>
              );
            })
          )}
        </div>
      </>
    );
}

/** 移动端弹出面板内快速按钮样式 */
function mobileQuickBtn(accentColor: string): React.CSSProperties {
  return {
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: "4px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 500,
    color: accentColor,
    background: `${accentColor}14`,
    border: `1px solid ${accentColor}30`,
    transition: "all 0.15s",
  };
}

/** 桌面端滚动条内小按钮样式 */
function deskQuickBtn(_accentColor: string): React.CSSProperties {
  return {
    cursor: "pointer",
    width: 28, height: 20,
    borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--ant-color-text-tertiary)",
    background: "var(--ant-color-fill-quaternary)",
    transition: "all 0.15s",
  };
}
