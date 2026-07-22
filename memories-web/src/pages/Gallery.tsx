import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button, Card, Descriptions, Dropdown, Empty, Image, Modal, Segmented, Spin, Tag, Tooltip, Typography, App,
} from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined, ArrowDownOutlined, BarsOutlined, BlockOutlined, BorderOutlined, CheckCircleOutlined, CheckSquareOutlined,
  CloseCircleOutlined, CopyOutlined, DownloadOutlined, DragOutlined, EyeOutlined, FieldTimeOutlined, InfoCircleOutlined, PictureOutlined,
  PlayCircleOutlined, PauseCircleOutlined, CaretRightOutlined,
  HeartOutlined, HeartFilled, UnorderedListOutlined,
} from "@ant-design/icons";
import { fetchImages, extractImageBedFilename, queryImageInfo, fetchAllCachedImages, prefetchImages } from "@/api";
import { useTheme } from "@/contexts/ThemeContext";
import ExifPanel from "@/components/ExifPanel";
import TimelineScrollBar from "@/components/TimelineScrollBar";
import type { ImageBedInfo, ImageItem } from "@/types";

const { Title, Text } = Typography;

export default function GalleryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { message } = App.useApp();
  const observerRef = useRef<HTMLDivElement | null>(null);
  const { accentColor } = useTheme();

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [imageInfo, setImageInfo] = useState<ImageBedInfo | null>(null);
  const [infoImageUrl, setInfoImageUrl] = useState<string>("");

  // 响应式断点
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 批量模式
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 幻灯播放
  const [slideshow, setSlideshow] = useState(false);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const slideshowTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideshowIndex = useRef(0);
  const isSlideshowRef = useRef(false);
  const SLIDESHOW_INTERVAL = 4000;

  // 视图模式
  type GalleryView = "grid" | "compact" | "list" | "simple" | "river" | "masonry" | "timeline" | "free";
  const [viewMode, setViewMode] = useState<GalleryView>("grid");

  // 时间线视图的当前选中日期（供 TimelineScrollBar 精细滚动使用）
  const [timelineActiveDate, setTimelineActiveDate] = useState<string>("");

  const viewOptions: { value: GalleryView; label: string; icon: React.ReactNode }[] = [
    { value: "grid", label: "网格", icon: <AppstoreOutlined /> },
    { value: "compact", label: "紧凑", icon: <PictureOutlined /> },
    { value: "list", label: "详情列表", icon: <UnorderedListOutlined /> },
    { value: "simple", label: "简洁列表", icon: <BarsOutlined /> },
    ...(isDesktop ? [{ value: "river" as GalleryView, label: "河视图", icon: <BorderOutlined /> }] : []),
    { value: "masonry", label: "瀑布流", icon: <BlockOutlined /> },
    { value: "timeline", label: "时间线", icon: <FieldTimeOutlined /> },
    { value: "free", label: "自由照片", icon: <DragOutlined /> },
  ];
  const currentView = viewOptions.find((v) => v.value === viewMode)!;

  const toggleSelect = useCallback((ts: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(ts) ? next.delete(ts) : next.add(ts);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(images.map((i) => i.created_at))), [images]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);
  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => { if (prev) setSelected(new Set()); return !prev; });
  }, []);

  // 广场背景右键菜单
  const galleryCtxMenu: MenuProps = {
    items: [
      { key: "grid", icon: <AppstoreOutlined />, label: "网格视图" },
      { key: "compact", icon: <PictureOutlined />, label: "紧凑视图" },
      { key: "list", icon: <UnorderedListOutlined />, label: "详情列表" },
      { key: "simple", icon: <BarsOutlined />, label: "简洁列表" },
      ...(isDesktop ? [{ key: "river" as const, icon: <BorderOutlined />, label: "河视图" }] : []),
      { key: "masonry", icon: <BlockOutlined />, label: "瀑布流" },
      { key: "timeline", icon: <FieldTimeOutlined />, label: "时间线" },
      { key: "free", icon: <DragOutlined />, label: "自由照片" },
      { type: "divider" as const },
      { key: "batch", icon: <CheckSquareOutlined />, label: batchMode ? "退出批量操作" : "批量操作" },
      { key: "slideshow", icon: slideshow ? <PauseCircleOutlined /> : <PlayCircleOutlined />, label: slideshow ? "停止幻灯" : "幻灯播放" },
    ],
    onClick: ({ key }) => {
      if (["grid","compact","list","simple","river","masonry","timeline","free"].includes(key)) {
        if (key === "free") setBatchMode(false);
        setViewMode(key as GalleryView);
      } else if (key === "batch") toggleBatchMode();
      else if (key === "slideshow") toggleSlideshow();
    },
  };

  // 幻灯切换动画列表
  const slideAnims = [
    "slide-fade-in",
    "slide-from-right",
    "slide-from-left",
    "slide-from-top",
    "slide-from-bottom",
    "slide-zoom-in",
    "slide-zoom-out",
    "slide-rotate-in",
  ];

  // 幻灯播放
  const slideshowImagesRef = useRef(images);

  const advanceSlide = useCallback(() => {
    const thumbnails = document.querySelectorAll(".gallery-view .ant-image-img");
    if (thumbnails.length === 0) return false;

    // 循环索引：优先使用 DOM 中实际渲染的缩略图数量
    const count = thumbnails.length;
    slideshowIndex.current = (slideshowIndex.current + 1) % count;
    const idx = slideshowIndex.current;

    // 点击对应缩略图切换
    const target = thumbnails[idx] as HTMLElement | undefined;
    if (target) {
      const anim = slideAnims[Math.floor(Math.random() * slideAnims.length)];
      const img = document.querySelector(".ant-image-preview-img") as HTMLElement;
      if (img) {
        img.style.animation = "none";
        void img.offsetHeight;
        img.style.animation = `${anim} 0.5s ease-out`;
      }
      target.click();
      setProgressKey((k) => k + 1);
      return true;
    }
    return false;
  }, []);
  const startSlideshow = useCallback(() => {
    setSlideshow(true);
    setSlideshowPaused(false);
    setProgressKey(0);
    slideshowIndex.current = 0;
    isSlideshowRef.current = true;
    document.body.classList.add("slideshow-active");
    if (images.length > 0) {
      const imgs = document.querySelectorAll(".gallery-view .ant-image-img");
      if (imgs.length > 0) (imgs[0] as HTMLElement).click();
    }
  }, [images]);

  const stopSlideshow = useCallback(() => {
    setSlideshow(false);
    setSlideshowPaused(false);
    // 延迟关闭 ref，避免退出时工具栏闪现
    setTimeout(() => { isSlideshowRef.current = false; }, 400);
    document.body.classList.remove("slideshow-active");
    if (slideshowTimer.current) {
      clearInterval(slideshowTimer.current);
      slideshowTimer.current = null;
    }
  }, []);

  const togglePause = useCallback(() => {
    setSlideshowPaused((prev) => !prev);
  }, []);

  const toggleSlideshow = useCallback(() => {
    if (slideshow) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  }, [slideshow, startSlideshow, stopSlideshow]);

  // 幻灯自动播放
  useEffect(() => {
    if (slideshow && images.length > 1 && !slideshowPaused) {
      setProgressKey((k) => k + 1);
      slideshowTimer.current = setInterval(() => {
        if (!advanceSlide()) stopSlideshow();
      }, SLIDESHOW_INTERVAL);
    }
    return () => {
      if (slideshowTimer.current) {
        clearInterval(slideshowTimer.current);
        slideshowTimer.current = null;
      }
    };
  }, [slideshow, slideshowPaused, images.length, stopSlideshow, advanceSlide]);

  // 检测预览关闭 → 自动停止幻灯
  useEffect(() => {
    if (!slideshow) return;
    const check = setInterval(() => {
      if (!document.querySelector(".ant-image-preview-mask")) {
        stopSlideshow();
      }
    }, 500);
    return () => clearInterval(check);
  }, [slideshow, stopSlideshow]);

  // 空格键快捷操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!slideshow) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slideshow, togglePause]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (slideshowTimer.current) clearInterval(slideshowTimer.current);
      document.body.classList.remove("slideshow-active");
    };
  }, []);

  // 自由视图不支持批量操作：自动退出
  useEffect(() => {
    if (viewMode === "free" && batchMode) {
      setBatchMode(false);
      setSelected(new Set());
    }
  }, [viewMode, batchMode]);

  const handleQueryInfo = useCallback(async (url: string) => {
    const filename = extractImageBedFilename(url);
    if (!filename) { message.warning("无法解析图片文件名"); return; }
    setInfoImageUrl(url);
    setInfoOpen(true); setInfoLoading(true); setImageInfo(null);
    try { setImageInfo(await queryImageInfo(filename)); }
    catch (err) { message.error(err instanceof Error ? err.message : "查询失败"); setInfoOpen(false); }
    finally { setInfoLoading(false); }
  }, [message]);

  const downloadOne = useCallback(async (url: string) => {
    try {
      const res = await fetch(url); const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = url.split("/").pop() || "image";
      a.click(); URL.revokeObjectURL(a.href);
    } catch { window.open(url, "_blank"); }
  }, []);

  const copyOne = useCallback(async (url: string) => {
    try { await navigator.clipboard.writeText(url); message.success("图片链接已复制"); }
    catch { message.warning("复制失败"); }
  }, [message]);

  // 统一预览工具条：自定义按钮 + antd 原生操作（旋转/缩放/关闭），移动端自动换行
  const makePreviewTools = useCallback((url: string) => {
    const btnStyle: React.CSSProperties = {
      color: "rgba(255,255,255,0.9)",
      fontSize: 18,
      cursor: "pointer",
      width: 36,
      height: 36,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.12)",
      backdropFilter: "blur(6px)",
      transition: "all 0.2s ease",
    };
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: 8, padding: "6px 10px",
        borderRadius: 24,
        background: "rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
      }}>
        <Tooltip title="下载图片">
          <span
            onClick={() => url && downloadOne(url)}
            style={btnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accentColor}E6`;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <DownloadOutlined />
          </span>
        </Tooltip>
        <Tooltip title="复制链接">
          <span
            onClick={() => url && copyOne(url)}
            style={btnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accentColor}E6`;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <CopyOutlined />
          </span>
        </Tooltip>
        <Tooltip title="图片信息">
          <span
            onClick={() => url && handleQueryInfo(url)}
            style={btnStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${accentColor}E6`;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "rgba(255,255,255,0.9)";
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <InfoCircleOutlined />
          </span>
        </Tooltip>
      </div>
    );
  }, [downloadOne, copyOne, handleQueryInfo, accentColor]);

  // 图片右键菜单
  const makeImgCtxMenu = useCallback((img: ImageItem): MenuProps => ({
    items: [
      { key: "preview", icon: <EyeOutlined />, label: "打开预览" },
      { key: "download", icon: <DownloadOutlined />, label: "下载图片" },
      { key: "copy", icon: <CopyOutlined />, label: "复制 URL" },
      { key: "info", icon: <InfoCircleOutlined />, label: "查看信息" },
    ],
    onClick: ({ key }) => {
      if (key === "preview") {
        const el = document.querySelector(`#card-${img.created_at} .ant-image-img`) as HTMLElement;
        el?.click();
      } else if (key === "download") downloadOne(img.url);
      else if (key === "copy") copyOne(img.url);
      else if (key === "info") handleQueryInfo(img.url);
    },
  }), [downloadOne, copyOne, handleQueryInfo]);

  const batchDownload = useCallback(async () => {
    const urls = images.filter((i) => selected.has(i.created_at)).map((i) => i.url);
    if (!urls.length) { message.warning("请先选择图片"); return; }
    message.loading({ content: `下载 ${urls.length} 张...`, key: "bd", duration: 0 });
    for (let i = 0; i < urls.length; i++) {
      await downloadOne(urls[i]);
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    message.success({ content: `已下载 ${urls.length} 张`, key: "bd" });
    setBatchMode(false); setSelected(new Set());
  }, [images, selected, downloadOne, message]);

  const batchCopy = useCallback(async () => {
    const urls = images.filter((i) => selected.has(i.created_at)).map((i) => i.url);
    if (!urls.length) { message.warning("请先选择图片"); return; }
    try { await navigator.clipboard.writeText(urls.join("\n")); message.success(`已复制 ${urls.length} 个链接`); }
    catch { message.warning("复制失败"); }
    setBatchMode(false); setSelected(new Set());
  }, [images, selected, message]);

  // 速率限制：每 1100ms 最多加载一次（配合后端 5张/5s 限制）
  const lastLoadTime = useRef(0);
  const pendingPage = useRef<number | null>(null);
  const retryCount = useRef<Map<number, number>>(new Map()); // API 请求重试计数
  const loadingRef = useRef(false);
  const LOAD_INTERVAL = 1100;
  const MAX_RETRY = 5;

  const loadImages = useCallback(async (pageNum: number, isRetry = false, forceRefresh = false) => {
    const now = Date.now();
    const elapsed = now - lastLoadTime.current;

    if (elapsed < LOAD_INTERVAL && !isRetry) {
      // 冷却中，排队等待
      pendingPage.current = pageNum;
      if (!loadingRef.current) { setLoading(true); loadingRef.current = true; }
      return;
    }

    lastLoadTime.current = now;
    pendingPage.current = null;
    setLoading(true);
    loadingRef.current = true;

    try {
      const res = await fetchImages(pageNum, 20, forceRefresh);
      if (pageNum === 1) {
        setImages(res.items);
      } else {
        setImages((prev) => {
          const seen = new Set(prev.map((i) => i.created_at));
          const deduped = res.items.filter((i) => !seen.has(i.created_at));
          return [...prev, ...deduped];
        });
      }
      setTotalPages(res.totalPages); setPage(pageNum);
      retryCount.current.delete(pageNum); // 成功则清除重试记录

      // 自动加载下一页（不等待滚动到底部）
      if (pageNum < res.totalPages) {
        const nextPage = pageNum + 1;
        pendingPage.current = nextPage;
        setTimeout(() => {
          if (pendingPage.current === nextPage) {
            pendingPage.current = null;
            loadImages(nextPage);
          }
        }, LOAD_INTERVAL);
      }
    } catch (err) {
      const count = (retryCount.current.get(pageNum) || 0) + 1;
      retryCount.current.set(pageNum, count);

      if (count <= MAX_RETRY) {
        const delay = Math.min(1000 * Math.pow(2, count - 1), 10000);
        message.warning(`加载失败，${delay / 1000}s 后重试 (${count}/${MAX_RETRY})`);
        setTimeout(() => loadImages(pageNum, true), delay);
      } else {
        retryCount.current.delete(pageNum);
        message.error("加载失败: " + (err instanceof Error ? err.message : "未知错误"));
        setLoading(false);
        loadingRef.current = false;
        setInitialLoading(false);
      }
      return;
    } finally {
      if (!retryCount.current.has(pageNum)) {
        setLoading(false);
        loadingRef.current = false;
        setInitialLoading(false);
      }
    }
  }, [message]); // 移除 loading 依赖，避免无限重入

  // 单张图片 onError 重试
  const imgRetryCount = useRef<Map<number, number>>(new Map());
  const handleImgError = useCallback((imgId: number, imgUrl: string) => {
    const count = (imgRetryCount.current.get(imgId) || 0) + 1;
    if (count > MAX_RETRY) {
      imgRetryCount.current.delete(imgId);
      return; // 超过重试上限，显示 fallback
    }
    imgRetryCount.current.set(imgId, count);

    // 用 cache-bust 参数强制重新加载
    const sep = imgUrl.includes("?") ? "&" : "?";
    const retryUrl = `${imgUrl}${sep}_retry=${count}`;

    setImages((prev) => prev.map((img) =>
      img.created_at === imgId ? { ...img, url: retryUrl } : img
    ));

    // 成功后恢复原始 URL（延迟清理）
    setTimeout(() => {
      setImages((prev) => prev.map((img) =>
        img.created_at === imgId && img.url.includes("_retry=") ? { ...img, url: imgUrl } : img
      ));
    }, 3000);
  }, []);

  const getImgProps = useCallback((img: ImageItem) => ({
    onError: () => handleImgError(img.created_at, img.url),
    fallback: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNiI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pjwvc3ZnPg==",
  }), [handleImgError]);

  // 初次加载：缓存优先 → 后台同步 → 有新增则提示
  const cachedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const init = async () => {
      // 1. 先从统一缓存加载全部图片，立即显示
      const allCached = fetchAllCachedImages();
      if (allCached.length > 0) {
        setImages(allCached);
        setInitialLoading(false);
        cachedIdsRef.current = new Set(allCached.map((i) => i.created_at));
        // 预加载缓存中的图片资源到浏览器缓存
        prefetchImages(allCached.slice(0, 40).map((i) => i.url));
      }

      // 2. 后台同步最新数据（从 page 1 开始，自动翻页会陆续加载其余页）
      try {
        const fresh = await fetchImages(1, 20, true);
        const newItems = fresh.items.filter((i) => !cachedIdsRef.current.has(i.created_at));
        if (newItems.length > 0 && cachedIdsRef.current.size > 0) {
          message.info(`📷 有 ${newItems.length} 张新照片`);
        }
        setImages(fresh.items.filter((item, idx, arr) => arr.findIndex((i) => i.created_at === item.created_at) === idx));
        setTotalPages(fresh.totalPages);
        setPage(1);
        // 预加载首屏图片
        prefetchImages(fresh.items.slice(0, 20).map((i) => i.url));
        // 首屏加载后自动开始加载后续页
        if (fresh.totalPages > 1) {
          setTimeout(() => loadImages(2), LOAD_INTERVAL);
        }
      } catch {
        // 网络失败，保持缓存数据
      } finally {
        setInitialLoading(false);
        setLoading(false);
        loadingRef.current = false;
      }
    };
    init();
  }, []); // 仅挂载时运行一次

  useEffect(() => {
    if (!observerRef.current || page >= totalPages || loading) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && page < totalPages && !loading) loadImages(page + 1); },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [page, totalPages, loading, loadImages]);

  if (initialLoading) {
    return <SkeletonGallery />;
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <Dropdown menu={galleryCtxMenu} trigger={['contextMenu']}>
      <div style={{
        padding: "16px 16px 8px",
        position: viewMode === "free" ? "sticky" : undefined,
        top: 0, zIndex: viewMode === "free" ? 70 : undefined,
        background: viewMode === "free" ? "var(--ant-color-bg-layout)" : undefined,
      }}>
        {/* 标题行 - 桌面端右对齐 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          marginBottom: 12,
        }}>
          <Title level={3} style={{
            margin: 0, fontWeight: 700, color: accentColor,
            fontSize: 22,
          }}>
            广场 <PictureOutlined />
          </Title>
        </div>

        {/* 统计 + 批量按钮 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%",
        }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            共 {images.length} 张
          </Text>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!batchMode && (
              <>
            {isDesktop ? (
              <Segmented size="small"
                value={viewMode}
                onChange={(v) => {
                  const newView = v as GalleryView;
                  if (newView === "free") setBatchMode(false);
                  setViewMode(newView);
                }}
                options={viewOptions.map((v) => ({
                  value: v.value,
                  label: <Tooltip title={v.label} mouseEnterDelay={0.3}>{v.icon}</Tooltip>,
                })) as any}
                style={{ marginRight: 4 }}
              />
            ) : (
              <Dropdown
                menu={{
                  items: viewOptions.map((v) => ({
                    key: v.value,
                    icon: v.icon,
                    label: v.label,
                    onClick: () => {
                      if (v.value === "free") setBatchMode(false);
                      setViewMode(v.value);
                    },
                  })),
                  selectedKeys: [viewMode],
                }}
                trigger={["click"]}
                placement="bottomLeft"
              >
                <Button size="small"
                  icon={currentView.icon}
                  style={{ borderRadius: 6, marginRight: 4 }}>
                  {currentView.label}
                </Button>
              </Dropdown>
            )}
            {viewMode !== "free" && (
            <Button
              onClick={toggleSlideshow}
              type={slideshow ? "primary" : "default"}
              icon={slideshow ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              title={slideshow ? "停止幻灯" : "幻灯播放"}
              style={{ borderRadius: 20, height: 36 }}
            />
            )}
              </>
            )}
            {!batchMode ? (
              viewMode !== "free" ? (
              <Button
                onClick={toggleBatchMode}
                icon={<CheckSquareOutlined />}
                style={{ borderRadius: 20, height: 36, fontWeight: 500,
                  borderColor: "var(--ant-color-border-secondary)" }}
              >
                {isDesktop ? "批量操作" : ""}
              </Button>
              ) : null
            ) : isDesktop ? (
              <div className="batch-capsule" style={{
                display: "inline-flex", alignItems: "center", gap: 0,
                background: "var(--ant-color-bg-container)",
                borderRadius: 24, padding: "4px 6px",
                boxShadow: "var(--ant-box-shadow-secondary)",
                border: "1px solid var(--ant-color-border-secondary)",
              }}>
                <Button type="text" size="small" onClick={selectAll}
                  style={{ borderRadius: 18, fontWeight: 500 }}>
                  全选 {images.length}
                </Button>
              <div style={{ width: 1, height: 20, background: "var(--ant-color-border-secondary)", margin: "0 2px" }} />
              <Button type="text" size="small" onClick={deselectAll}
                style={{ borderRadius: 18 }}>
                取消
              </Button>
              <div style={{ width: 1, height: 20, background: "var(--ant-color-border-secondary)", margin: "0 2px" }} />
              <Button type="text" size="small" icon={<DownloadOutlined />}
                onClick={batchDownload} disabled={selected.size === 0}
                style={{ borderRadius: 18, color: accentColor, fontWeight: 500 }}>
                下载 {selected.size}
              </Button>
              <div style={{ width: 1, height: 20, background: "var(--ant-color-border-secondary)", margin: "0 2px" }} />
              <Button type="text" size="small" icon={<CopyOutlined />}
                onClick={batchCopy} disabled={selected.size === 0}
                style={{ borderRadius: 18, color: accentColor, fontWeight: 500 }}>
                复制 {selected.size}
              </Button>
              <div style={{ width: 1, height: 20, background: "var(--ant-color-border-secondary)", margin: "0 2px" }} />
              <Button type="text" size="small" danger onClick={toggleBatchMode}
                style={{ borderRadius: 18 }}>
                退出
              </Button>
            </div>
            ) : (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "var(--ant-color-bg-container)",
                borderRadius: 24, padding: "2px 4px",
                boxShadow: "var(--ant-box-shadow-secondary)",
                border: "1px solid var(--ant-color-border-secondary)",
              }}>
                <Tooltip title={`全选 ${images.length}`}>
                  <Button type="text" size="small" icon={<CheckSquareOutlined />}
                    onClick={selectAll} style={{ borderRadius: 18, minWidth: 32 }} />
                </Tooltip>
                <Button type="text" size="small" icon={<CloseCircleOutlined />}
                  onClick={deselectAll} style={{ borderRadius: 18, minWidth: 32 }} />
                <div style={{ width: 1, height: 18, background: "var(--ant-color-border-secondary)" }} />
                <Button type="text" size="small" icon={<DownloadOutlined />}
                  onClick={batchDownload} disabled={selected.size === 0}
                  style={{ borderRadius: 18, color: accentColor, minWidth: 32 }}>
                  <span style={{ fontSize: 11, marginLeft: 2 }}>{selected.size}</span>
                </Button>
                <Button type="text" size="small" icon={<CopyOutlined />}
                  onClick={batchCopy} disabled={selected.size === 0}
                  style={{ borderRadius: 18, color: accentColor, minWidth: 32 }}>
                  <span style={{ fontSize: 11, marginLeft: 2 }}>{selected.size}</span>
                </Button>
                <div style={{ width: 1, height: 18, background: "var(--ant-color-border-secondary)" }} />
                <Button type="text" size="small" danger icon={<CloseCircleOutlined />}
                  onClick={toggleBatchMode} style={{ borderRadius: 18, minWidth: 32 }} />
              </div>
            )}
        </div>
      </div>
      </div>
      </Dropdown>

      {images.length === 0 && !loading ? (
        <Empty description="还没有人分享回忆，快来上传第一张吧！" />
      ) : viewMode === "river" ? (
        <>
        <Image.PreviewGroup
          preview={{
            mask: (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>
                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>
              </div>
            ),
            countRender: () => null,
            toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
              const url = images[(info as any).current ?? 0]?.url || "";
              return <>{makePreviewTools(url)}{originalNode}</>;
            },
          } as any}
        >
          <div className="gallery-view" style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 2,
            padding: "4px 0",
          }}>
            {images.map((img) => {
              const dateStr = new Date(img.created_at).toLocaleDateString("zh-CN");
              const isSel = selected.has(img.created_at);
              return (
                <div key={img.created_at} data-gallery-date={dateStr} data-gallery-id={img.created_at} style={{
                  height: 200,
                  flexShrink: 0,
                }}
                  onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
                >
                  <div style={{
                    height: 176,
                    overflow: "hidden",
                    background: "var(--ant-color-fill-quaternary)",
                    position: "relative",
                    cursor: batchMode ? "pointer" : undefined,
                    borderRadius: 4,
                  }}
                    className="river-image-wrap"
                  >
                    {batchMode && (
                      <div style={{
                        position: "absolute", top: 6, right: 6, zIndex: 5,
                        width: 22, height: 22, borderRadius: 4,
                        background: isSel ? accentColor : "rgba(255,255,255,0.9)",
                        border: `2px solid ${isSel ? accentColor : "var(--border-muted)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                      }}>{isSel ? "✓" : ""}</div>
                    )}
                    <Image src={img.url} alt={dateStr}
                      style={{ height: "100%", width: "auto", maxWidth: "none", display: "block" }}
                      preview={batchMode ? false : undefined}
                      {...getImgProps(img)} />
                  </div>
                  <Text type="secondary" style={{
                    fontSize: 10, textAlign: "center",
                    display: "block",
                    lineHeight: "24px", height: 24, padding: "0 4px",
                  }}>{dateStr}</Text>
                </div>
              );
            })}
          </div>
        </Image.PreviewGroup>
        <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
          {loading && page < totalPages && <Spin size="small" />}
          {!loading && page < totalPages && (
            <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
          )}
          {!loading && page >= totalPages && images.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
              <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
              <Text type="secondary">已加载全部照片 🎉</Text>
            </div>
          )}
        </div>
        </>
      ) : viewMode === "masonry" ? (
        <>
        <Image.PreviewGroup
          preview={{
            mask: (              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>              </div>            ),
countRender: () => null,
toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
              const url = images[(info as any).current ?? 0]?.url || "";
              return <>{makePreviewTools(url)}{originalNode}</>;
            },
          } as any}
        >
          <div className="gallery-view" style={{
            columnCount: 4, columnGap: 0, columnRule: "none",
            columnFill: "balance",
            padding: 0, fontSize: 0,
          }}>
            {images.map((img) => {
              const isSel = selected.has(img.created_at);
              return (
              <div key={img.created_at} data-gallery-date={new Date(img.created_at).toLocaleDateString("zh-CN")} data-gallery-id={img.created_at} style={{
                breakInside: "avoid", marginBottom: 0,
                lineHeight: 0, fontSize: 0,
                position: "relative",
                cursor: batchMode ? "pointer" : undefined,
              }}
                onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
              >
                {batchMode && (
                  <div style={{
                    position: "absolute", top: 6, right: 6, zIndex: 5,
                    width: 22, height: 22, borderRadius: 4,
                    background: isSel ? accentColor : "rgba(255,255,255,0.9)",
                    border: `2px solid ${isSel ? accentColor : "var(--border-muted)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 700,
                  }}>{isSel ? "✓" : ""}</div>
                )}
                <Image src={img.url}
                  style={{ width: "100%", height: "auto", display: "block", verticalAlign: "top" }}
                  preview={batchMode ? false : undefined}
                  {...getImgProps(img)} />
              </div>
            )})}
          </div>
        </Image.PreviewGroup>
        <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
          {loading && page < totalPages && <Spin size="small" />}
          {!loading && page < totalPages && (
            <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
          )}
          {!loading && page >= totalPages && images.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
              <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
              <Text type="secondary">已加载全部照片 🎉</Text>
            </div>
          )}
        </div>
        </>
      ) : viewMode === "timeline" ? (
        <TimelineView
          images={images}
          loading={loading}
          page={page}
          totalPages={totalPages}
          loadImages={loadImages}
          getImgProps={getImgProps}
          downloadOne={downloadOne}
          copyOne={copyOne}
          handleQueryInfo={handleQueryInfo}
          batchMode={batchMode}
          selected={selected}
          toggleSelect={toggleSelect}
          accentColor={accentColor}
          activeDate={timelineActiveDate}
          onActiveDateChange={setTimelineActiveDate}
        />
      ) : viewMode === "free" ? (
        <FreeView
          images={images}
          loading={loading}
          page={page}
          totalPages={totalPages}
          loadImages={loadImages}
          getImgProps={getImgProps}
          downloadOne={downloadOne}
          copyOne={copyOne}
          handleQueryInfo={handleQueryInfo}
        />
      ) : (
        /* ===== 普通视图：grid / compact / list ===== */
        <>
          <div className={`gallery-view gallery-grid ${viewMode === "compact" ? "gallery-grid-compact" : ""} ${(viewMode === "list" || viewMode === "simple") ? "gallery-grid-list" : ""}`} style={{
            display: "grid",
            gridTemplateColumns: (viewMode === "list" || viewMode === "simple")
              ? "1fr"
              : viewMode === "compact"
              ? "repeat(auto-fill, minmax(min(180px, 100%), 1fr))"
              : "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
            gap: (viewMode === "list" || viewMode === "simple") ? 0 : viewMode === "compact" ? 8 : 16,
            padding: viewMode === "simple" ? "0" : "0 16px",
          }}>
            <Image.PreviewGroup
              preview={{
                mask: (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.12)",
                    backdropFilter: "blur(2px)",
                  }}>
                    <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
                    <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>
                      点击预览
                    </Text>
                  </div>
                ),
                countRender: () => null,
                toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
                  const url = images[(info as any).current ?? 0]?.url || "";
                  return <>{makePreviewTools(url)}{originalNode}</>;
                },
              } as any}
            >
            {images.map((img) => {
              const isSel = selected.has(img.created_at);
              const dateStr = new Date(img.created_at).toLocaleDateString("zh-CN");
              const isListView = viewMode === "list" || viewMode === "simple";
              const isSimple = viewMode === "simple";

              if (isListView) {
                const filename = img.url.split("/").pop() || "—";
                const ext = filename.split(".").pop()?.toUpperCase() || "—";
                const fullDate = new Date(img.created_at).toLocaleString("zh-CN");
                const dateShort = new Date(img.created_at).toLocaleDateString("zh-CN");

                if (isSimple) {
                  /* ===== 简洁列表：仅日期 + 文件名 ===== */
                  return (
                    <div key={img.created_at} id={`list-row-${img.created_at}`} data-gallery-date={dateShort} data-gallery-id={img.created_at}
                      onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px 14px",
                        borderBottom: "1px solid var(--ant-color-border-secondary)",
                        background: isSel && batchMode ? `${accentColor}10` : undefined,
                        cursor: batchMode ? "pointer" : "default",
                        transition: "background 0.15s",
                      }}>
                      {batchMode && (
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                          background: isSel ? accentColor : "var(--ant-color-fill-quaternary)",
                          border: `2px solid ${isSel ? accentColor : "var(--ant-color-border-secondary)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 12, fontWeight: 700,
                        }}>{isSel ? "✓" : ""}</div>
                      )}
                      <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, width: 80 }}>{dateShort}</Text>
                      <Text
                        onClick={batchMode ? undefined : () => { const el = document.getElementById(`list-row-${img.created_at}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); }}
                        style={{
                          flex: 1, fontSize: 13, cursor: batchMode ? "default" : "pointer", color: accentColor,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{filename}</Text>
                      <Image src={img.url} style={{ display: "none" }} preview={batchMode ? false : undefined} {...getImgProps(img)} />
                    </div>
                  );
                }
                return (
                  <div key={img.created_at} id={`list-row-${img.created_at}`} className="gallery-list-row" data-gallery-date={dateShort} data-gallery-id={img.created_at}
                    onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", borderRadius: 12,
                      background: "var(--ant-color-bg-container)",
                      border: `1px solid ${isSel && batchMode ? accentColor : "var(--ant-color-border-secondary)"}`,
                      marginBottom: 6, cursor: batchMode ? "pointer" : "default",
                      transition: "all 0.15s",
                    }}>
                    {batchMode && (
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        background: isSel ? accentColor : "var(--ant-color-fill-quaternary)",
                        border: `2px solid ${isSel ? accentColor : "var(--ant-color-border-secondary)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                      }}>{isSel ? "✓" : ""}</div>
                    )}
                    <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, margin: 0, flexShrink: 0 }}>{ext}</Tag>
                    <Text type="secondary" className="gallery-list-date" style={{ fontSize: 12, flexShrink: 0, width: 130 }}>{fullDate}</Text>
                    <Text
                      onClick={() => { if (!batchMode) { const el = document.getElementById(`list-row-${img.created_at}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); } }}
                      style={{
                      flex: 1, fontSize: 13, cursor: "pointer", color: accentColor,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{filename}</Text>
                    {!batchMode && (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <Tooltip title="预览">
                        <Button type="text" size="small" icon={<EyeOutlined />}
                          onClick={(e) => { e.stopPropagation(); const el = document.getElementById(`list-row-${img.created_at}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); }}
                          style={{ color: accentColor }} />
                      </Tooltip>
                      <Tooltip title="下载">
                        <Button type="text" size="small" icon={<DownloadOutlined />}
                          onClick={(e) => { e.stopPropagation(); downloadOne(img.url); }}
                          style={{ color: accentColor }} />
                      </Tooltip>
                      <Tooltip title="复制链接">
                        <Button type="text" size="small" icon={<CopyOutlined />}
                          onClick={(e) => { e.stopPropagation(); copyOne(img.url); }}
                          style={{ color: accentColor }} />
                      </Tooltip>
                      <Tooltip title="图片信息">
                        <Button type="text" size="small" icon={<InfoCircleOutlined />}
                          onClick={(e) => { e.stopPropagation(); handleQueryInfo(img.url); }}
                          style={{ color: accentColor }} />
                      </Tooltip>
                    </div>
                    )}
                    <Image src={img.url} style={{ display: "none" }} preview={batchMode ? false : undefined} {...getImgProps(img)} />
                  </div>
                );
              }

              return (
                <Dropdown key={img.created_at} menu={makeImgCtxMenu(img)} trigger={['contextMenu']}>
                <Card id={`card-${img.created_at}`} data-gallery-date={dateStr} data-gallery-id={img.created_at} size="small" hoverable
                  style={{
                    borderRadius: 12, overflow: "hidden",
                    outline: batchMode && isSel ? `2px solid ${accentColor}` : undefined,
                    outlineOffset: -2,
                  }}
                  styles={{ body: { padding: 0 } }}
                  onContextMenu={(e) => e.stopPropagation()}
                  cover={
                    <div onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
                      style={{
                        position: "relative", overflow: "hidden",
                        aspectRatio: "4/3", maxHeight: 400,
                        background: "var(--ant-color-fill-quaternary)",
                        cursor: batchMode ? "pointer" : undefined,
                      }}>
                      {batchMode && (
                        <div style={{
                          position: "absolute", top: 8, right: 8, zIndex: 5,
                          width: 24, height: 24, borderRadius: 4,
                          background: isSel ? accentColor : "rgba(255,255,255,0.9)",
                          border: `2px solid ${isSel ? accentColor : "var(--border-muted)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 14, fontWeight: 700,
                        }}>{isSel ? "✓" : ""}</div>
                      )}
                      <Image src={img.url} alt={dateStr}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        preview={batchMode ? false : undefined}
                        {...getImgProps(img)} />
                    </div>
                  }>
                </Card>
                </Dropdown>
              );
            })}
            </Image.PreviewGroup>
          </div>

          <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
            {loading && page < totalPages && <Spin size="small" />}
            {!loading && page < totalPages && (
              <Button type="link" icon={<ArrowDownOutlined />}
                onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
            )}
            {!loading && page >= totalPages && images.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
                <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                <Text type="secondary">已加载全部照片 🎉</Text>
              </div>
            )}
          </div>
        </>
      )}

      <Modal title={<span style={{ color: accentColor, fontWeight: 700 }}>图片信息</span>} open={infoOpen} onCancel={() => setInfoOpen(false)}
        footer={null} width={isDesktop ? 520 : "100%"}
        zIndex={1050}
        style={isDesktop ? {} : { maxWidth: "100vw", margin: 0, padding: 0, top: 0 }}
        styles={{
          header: { borderBottom: `2px solid ${accentColor}22` },
          body: { padding: isDesktop ? 16 : "12px 8px", maxHeight: isDesktop ? "70vh" : "80vh", overflowY: "auto", paddingBottom: isDesktop ? 16 : "calc(12px + env(safe-area-inset-bottom, 8px))" },
        }}
        destroyOnHidden>
        {infoLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : imageInfo ? (
          <>
          <Descriptions column={isDesktop ? 2 : 1} size="small" bordered styles={{ label: { fontWeight: 600, whiteSpace: "nowrap", background: `${accentColor}10`, color: accentColor } }}>
            <Descriptions.Item label="文件名" span={2}>
              <Text copyable style={{ fontSize: 12 }}>{imageInfo.filename}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="原始文件名" span={2}>{imageInfo.original_filename}</Descriptions.Item>
            <Descriptions.Item label="上传时间">{imageInfo.upload_date}</Descriptions.Item>
            {imageInfo.tags_array.length > 0 && (
              <Descriptions.Item label="标签" span={2}>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {imageInfo.tags_array.map((t) => <Tag key={t} color="green" style={{ borderRadius: 8 }}>{t}</Tag>)}
                </div>
              </Descriptions.Item>
            )}
            {imageInfo.content_description && (
              <Descriptions.Item label="画面描述" span={2}>
                <Text style={{ fontSize: 13 }}>{imageInfo.content_description}</Text>
              </Descriptions.Item>
            )}
            {imageInfo.password_protected && (
              <Descriptions.Item label="加密" span={2}><Tag color="warning">密码保护</Tag></Descriptions.Item>
            )}
          </Descriptions>
          {infoImageUrl && <ExifPanel url={infoImageUrl} accentColor={accentColor} isDesktop={isDesktop} />}
          </>
        ) : null}
      </Modal>

      {/* 右侧时间轴快速滑动条 */}
      <TimelineScrollBar
        images={images}
        accentColor={accentColor}
        isDesktop={isDesktop}
        viewMode={viewMode}
        timelineActiveDate={timelineActiveDate}
        onTimelineDateChange={setTimelineActiveDate}
      />

      {/* 幻灯播放进度条 */}
      {slideshow && (
        <>
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000,
            height: 6, background: "rgba(255,255,255,0.15)",
          }}>
            <div
              key={progressKey}
              style={{
                height: "100%",
                background: `linear-gradient(90deg, ${accentColor}, #53C49E, #E9C46A, #E76F51)`,
                animation: slideshowPaused
                  ? "none"
                  : `slideshow-progress ${SLIDESHOW_INTERVAL}ms linear`,
                borderRadius: "0 3px 3px 0",
              }}
            />
          </div>
          {/* 底部暂停/播放按钮 */}
          <div style={{
            position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)",
            zIndex: 2000,
          }}>
            <Button
              shape="circle"
              size="large"
              icon={slideshowPaused ? <CaretRightOutlined /> : <PauseCircleOutlined />}
              onClick={togglePause}
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* ===== 时间线视图组件 ===== */

function TimelineView({ images, loading, page, totalPages, loadImages, getImgProps, downloadOne, copyOne, handleQueryInfo, batchMode, selected, toggleSelect, accentColor, activeDate, onActiveDateChange }: {
  images: ImageItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  loadImages: (pageNum: number) => void;
  getImgProps: (img: ImageItem) => any;
  downloadOne: (url: string) => void;
  copyOne: (url: string) => void;
  handleQueryInfo: (url: string) => void;
  batchMode: boolean;
  selected: Set<number>;
  toggleSelect: (id: number) => void;
  accentColor: string;
  activeDate: string;
  onActiveDateChange: (date: string) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);

  const makeTools = useCallback((url: string) => {
    const btnStyle: React.CSSProperties = {
      color: "rgba(255,255,255,0.9)",
      fontSize: 18,
      cursor: "pointer",
      width: 36,
      height: 36,
      borderRadius: "50%",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.12)",
      backdropFilter: "blur(6px)",
      transition: "all 0.2s ease",
    };
    const hoverIn = (e: React.MouseEvent<HTMLSpanElement>) => {
      e.currentTarget.style.background = `${accentColor}E6`;
      e.currentTarget.style.color = "#fff";
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}55`;
    };
    const hoverOut = (e: React.MouseEvent<HTMLSpanElement>) => {
      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      e.currentTarget.style.color = "rgba(255,255,255,0.9)";
      e.currentTarget.style.transform = "none";
      e.currentTarget.style.boxShadow = "none";
    };
    return (
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center",
        gap: 8, padding: "6px 10px",
        borderRadius: 24,
        background: "rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
      }}>
        <Tooltip title="下载图片"><span onClick={() => url && downloadOne(url)} style={btnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}><DownloadOutlined /></span></Tooltip>
        <Tooltip title="复制链接"><span onClick={() => url && copyOne(url)} style={btnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}><CopyOutlined /></span></Tooltip>
        <Tooltip title="图片信息"><span onClick={() => url && handleQueryInfo(url)} style={btnStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}><InfoCircleOutlined /></span></Tooltip>
      </div>
    );
  }, [downloadOne, copyOne, handleQueryInfo, accentColor]);

  // 按日期分组（去重）
  const dateGroups = useMemo(() => {
    const groups: Map<string, ImageItem[]> = new Map();
    const seen = new Set<number>();
    images.forEach((img) => {
      if (seen.has(img.created_at)) return; // 跳过重复
      seen.add(img.created_at);
      const date = new Date(img.created_at).toLocaleDateString("zh-CN");
      const existing = groups.get(date) || [];
      existing.push(img);
      groups.set(date, existing);
    });
    return Array.from(groups.entries());
  }, [images]);

  // 默认选中最新日期
  useEffect(() => {
    if (dateGroups.length > 0 && !activeDate) {
      onActiveDateChange(dateGroups[0][0]);
    }
  }, [dateGroups, activeDate]);

  const activeImages = dateGroups.find(([d]) => d === activeDate)?.[1] || [];
  const observerRef = useRef<HTMLDivElement>(null);

  // 无限滚动
  useEffect(() => {
    if (!observerRef.current || page >= totalPages || loading) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && page < totalPages && !loading) loadImages(page + 1); },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [page, totalPages, loading, loadImages]);

  // 顶部时间轴鼠标滚轮水平滚动
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 仅在水平滚动未到达边界时阻止垂直滚动
      const canScrollLeft = e.deltaY < 0 && el.scrollLeft > 0;
      const canScrollRight = e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth;
      if (canScrollLeft || canScrollRight) {
        e.preventDefault();
      }
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div>
      {/* 时间轴 */}
      <div style={{
        background: "var(--ant-color-bg-container)",
        borderBottom: "1px solid var(--ant-color-border-secondary)",
        padding: "10px 0 4px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", padding: "0 16px", marginBottom: 8,
        }}>
          <FieldTimeOutlined style={{ marginRight: 6, color: "var(--ant-color-primary)" }} />
          <Text strong style={{ fontSize: 14 }}>时间轴</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>共 {dateGroups.length} 个日期</Text>
        </div>
        <div style={{ position: "relative", padding: "0 20px" }}>
          {/* 时间线 */}
          <div style={{
            position: "absolute", top: 28, left: 20, right: 20,
            height: 2, background: "var(--ant-color-border-secondary)",
          }} />
          <div ref={timelineRef} style={{
            display: "flex", gap: 0, overflowX: "auto",
            padding: "8px 0 12px",
            scrollbarWidth: "thin",
            WebkitOverflowScrolling: "touch",
            position: "relative",
          }}>
            {dateGroups.map(([date, imgs]) => {
              const isActive = date === activeDate;
              const parts = date.split("/");
              return (
                <div key={date} onClick={() => onActiveDateChange(date)} style={{
                  flexShrink: 0, cursor: "pointer",
                  textAlign: "center",
                  userSelect: "none",
                  padding: "0 14px",
                  position: "relative",
                }}>
                  {/* 时间点 */}
                  <div style={{
                    width: isActive ? 14 : 10, height: isActive ? 14 : 10,
                    borderRadius: "50%",
                    background: isActive ? "var(--ant-color-primary)" : "var(--ant-color-border-secondary)",
                    border: isActive ? "3px solid var(--ant-color-primary-bg)" : "none",
                    margin: "0 auto 6px",
                    transition: "all 0.2s",
                    position: "relative", zIndex: 1,
                  }} />
                  <div style={{
                    fontSize: isActive ? 15 : 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--ant-color-primary)" : "var(--ant-color-text)",
                    lineHeight: 1.2,
                  }}>{parts[1]}/{parts[2]}</div>
                  <div style={{
                    fontSize: 10,
                    color: isActive ? "var(--ant-color-primary)" : "var(--ant-color-text-secondary)",
                    marginTop: 1,
                  }}>{imgs.length}张</div>
                  {parts[0] !== dateGroups[0]?.[0]?.split("/")[0] && (
                    <div style={{ fontSize: 9, color: "var(--ant-color-text-quaternary)", marginTop: 1 }}>{parts[0]}年</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 图片区 */}
      <Image.PreviewGroup
        preview={{
            mask: (              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>              </div>            ),
countRender: () => null,
toolbarRender: (originalNode: React.ReactNode, info: { current: number }) => {
            const url = activeImages[(info as any).current ?? 0]?.url || "";
            return <>{makeTools(url)}{originalNode}</>;
          },
        } as any}
      >
        <div className="gallery-view" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8, padding: "12px 16px",
        }}>
          {activeImages.map((img) => {
            const isSel = selected.has(img.created_at);
            const imgDateStr = new Date(img.created_at).toLocaleDateString("zh-CN");
            return (
            <div key={img.created_at} data-gallery-date={imgDateStr} data-gallery-id={img.created_at} style={{
              borderRadius: 8, overflow: "hidden",
              background: "var(--ant-color-fill-quaternary)",
              position: "relative",
              outline: batchMode && isSel ? `2px solid ${accentColor}` : undefined,
              outlineOffset: -2,
              cursor: batchMode ? "pointer" : undefined,
            }}
              onClick={batchMode ? () => toggleSelect(img.created_at) : undefined}
            >
              {batchMode && (
                <div style={{
                  position: "absolute", top: 6, right: 6, zIndex: 5,
                  width: 22, height: 22, borderRadius: 4,
                  background: isSel ? accentColor : "rgba(255,255,255,0.9)",
                  border: `2px solid ${isSel ? accentColor : "var(--border-muted)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                }}>{isSel ? "✓" : ""}</div>
              )}
              <Image src={img.url}
                style={{ width: "100%", height: "auto", display: "block", maxHeight: 300, objectFit: "cover" }}
                preview={batchMode ? false : undefined}
                {...getImgProps(img)} />
            </div>
          )})}
        </div>
      </Image.PreviewGroup>

      <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
        {loading && page < totalPages && <Spin size="small" />}
        {!loading && page < totalPages && (
          <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
        )}
        {!loading && page >= totalPages && images.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
            <Text type="secondary">已加载全部照片 🎉</Text>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 自由照片视图 ===== */

type FreeLayout = "random" | "grid" | "staircase" | "circle" | "wall" | "waterfall";

type HeartMode = 0 | 1 | 2; // 0=关 1=填充爱心 2=描边爱心

const FREE_LAYOUTS: { value: FreeLayout; label: string }[] = [
  { value: "random", label: "随机" },
  { value: "grid", label: "网格" },
  { value: "staircase", label: "阶梯" },
  { value: "circle", label: "环绕" },
  { value: "wall", label: "照片墙" },
  { value: "waterfall", label: "瀑布" },
];

function computeLayoutPositions(images: ImageItem[], preset: FreeLayout): Map<number, { x: number; y: number; rotate: number }> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const map = new Map<number, { x: number; y: number; rotate: number }>();
  const margin = 30;
  const cardW = FW_CARD_W;
  const cardH = FW_CARD_H;

  images.forEach((img, i) => {
    switch (preset) {
      case "random":
        map.set(img.created_at, {
          x: margin + Math.random() * Math.max(w - cardW - margin * 2, 100),
          y: margin + Math.random() * Math.max(h - cardH - margin * 2, 200),
          rotate: (Math.random() - 0.5) * 12,
        });
        break;
      case "grid": {
        const cols = Math.max(2, Math.floor((w - margin * 2) / (cardW + 16)));
        const col = i % cols;
        const row = Math.floor(i / cols);
        map.set(img.created_at, {
          x: margin + col * (cardW + 16),
          y: margin + row * (cardH + 16),
          rotate: 0,
        });
        break;
      }
      case "staircase": {
        const stepX = 90;
        const stepY = 85;
        const cols = Math.min(images.length, 5);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const totalW = (cols - 1) * stepX + cardW;
        const centerX = (w - totalW) / 2;
        map.set(img.created_at, {
          x: centerX + col * stepX + row * 8,
          y: margin + row * stepY + col * 14,
          rotate: (col - Math.floor(cols / 2)) * 2,
        });
        break;
      }
      case "circle": {
        const count = images.length;
        const cx = w / 2 - cardW / 2;
        const cy = h / 2.3 - cardH / 2;
        const radius = Math.min(w, h) * 0.28;
        const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
        map.set(img.created_at, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          rotate: (angle * 180) / Math.PI * 0.15,
        });
        break;
      }
      case "wall": {
        const cols = Math.max(2, Math.floor((w - margin * 2) / (cardW + 12)));
        const col = i % cols;
        const row = Math.floor(i / cols);
        const rowOffset = (row % 2) * ((cardW + 12) / 2);
        map.set(img.created_at, {
          x: margin + col * (cardW + 12) + rowOffset,
          y: margin + row * (cardH + 12),
          rotate: (Math.random() - 0.5) * 3,
        });
        break;
      }
      case "waterfall": {
        // 瀑布效果：每张照片从左上向右下倾斜级联
        const waterfallStep = 60;
        const row2 = Math.floor(i / 2);
        const col2 = i % 2;
        const stagger = row2 % 2 === 0 ? 0 : waterfallStep * 0.5;
        const centerX = (w - waterfallStep * 3 - cardW) / 2;
        map.set(img.created_at, {
          x: centerX + col2 * waterfallStep * 2.5 + stagger + row2 * 12,
          y: margin + row2 * waterfallStep * 0.8 + col2 * 25,
          rotate: (col2 === 0 ? -3 : 3) + (row2 % 3 - 1) * 2,
        });
        break;
      }
    }
  });
  return map;
}

const FW_CARD_W = 220;
const FW_CARD_H = 180;

function FreeView({ images, loading, page, totalPages, loadImages, getImgProps, downloadOne, copyOne, handleQueryInfo }: {
  images: ImageItem[];
  loading: boolean;
  page: number;
  totalPages: number;
  loadImages: (pageNum: number) => void;
  getImgProps: (img: ImageItem) => any;
  downloadOne: (url: string) => void;
  copyOne: (url: string) => void;
  handleQueryInfo: (url: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<number, { x: number; y: number; rotate: number }>>(new Map());
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [layerOrder, setLayerOrder] = useState<number[]>([]);
  const [layoutPreset, setLayoutPreset] = useState<FreeLayout>("random");
  const [heartMode, setHeartMode] = useState<HeartMode>(0);
  const { message } = App.useApp();
  const dragRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // 爱心曲线点（固定 36 个基准点，确保分层计算正确）
  const HEART_PT_COUNT = 36;
  const heartPts = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < HEART_PT_COUNT; i++) {
      const t = (2 * Math.PI * i) / HEART_PT_COUNT;
      const x = 13 * Math.pow(Math.sin(t), 3) * 1.15;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({ x, y });
    }
    return pts;
  }, []);

  // 检查点是否在爱心形状内部
  const insideHeart = (px: number, py: number): boolean => {
    const nx = px / 14;
    const ny = py / 17;
    return (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny * ny * ny < 0;
  };

  useEffect(() => {
    if (images.length === 0) return;
    if (heartMode === 0) {
      setPositions(computeLayoutPositions(images, layoutPreset));
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.min(w, h) * 0.023;
      const cx = w / 2 - FW_CARD_W / 2;
      const cy = h / 2.4 - FW_CARD_H / 2;
      const n = images.length;
      setPositions(new Map(images.map((img, i) => {
        // 将照片均匀分布到 36 个曲线基准点上
        const curveIdx = Math.min(Math.floor(i * HEART_PT_COUNT / Math.max(n, 1)), HEART_PT_COUNT - 1);
        // 分层：每 36 张一层
        const layer = Math.floor(i / HEART_PT_COUNT);
        if (heartMode === 2) {
          // 描边爱心：均匀分布在曲线边界
          const pt = heartPts[curveIdx];
          return [img.created_at, {
            x: cx + pt.x * scale,
            y: cy + pt.y * scale,
            rotate: 0,
          }];
        }
        // 实心爱心：多层铺设
        const scales = [1, 0.85, 0.65, 0.45, 0.25, 0.1];
        if (layer < scales.length) {
          const angleShift = (layer * Math.PI * 0.6) / HEART_PT_COUNT;
          const t = (2 * Math.PI * curveIdx) / HEART_PT_COUNT + angleShift;
          const sx = 13 * Math.pow(Math.sin(t), 3) * 1.15;
          const sy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          return [img.created_at, {
            x: cx + sx * scale * scales[layer],
            y: cy + sy * scale * scales[layer],
            rotate: 0,
          }];
        }
        // 超出层数：随机散落
        for (let tries = 0; tries < 50; tries++) {
          const rx = (Math.random() - 0.5) * 26;
          const ry = (Math.random() - 0.5) * 30;
          if (insideHeart(rx, ry)) {
            return [img.created_at, {
              x: cx + rx * scale, y: cy + ry * scale, rotate: 0,
            }];
          }
        }
        const pt = heartPts[curveIdx];
        return [img.created_at, {
          x: cx + pt.x * scale * 0.8, y: cy + pt.y * scale * 0.8, rotate: 0,
        }];
      })));
    }
  }, [images, layoutPreset, heartMode, heartPts]);

  const startDrag = (id: number, clientX: number, clientY: number) => {
    const pos = positions.get(id);
    if (!pos) return;
    dragRef.current = { id, startX: clientX, startY: clientY, origX: pos.x, origY: pos.y };
    setDraggingId(id);
    setLayerOrder((prev) => {
      const next = prev.filter((i) => i !== id);
      next.push(id);
      return next;
    });
  };

  const onMouseDown = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(id, e.clientX, e.clientY);
  };

  const onTouchStart = (id: number, e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    startDrag(id, t.clientX, t.clientY);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0]?.clientY : (e as MouseEvent).clientY;
      if (clientX == null || clientY == null) return;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      const id = drag.id;
      const origX = drag.origX;
      const origY = drag.origY;
      setPositions((prev) => {
        const next = new Map(prev);
        const cur = next.get(id);
        if (!cur) return next;
        next.set(id, { ...cur, x: origX + dx, y: origY + dy });
        return next;
      });
    };
    const onUp = () => { dragRef.current = null; setDraggingId(null); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const observerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!observerRef.current || page >= totalPages || loading) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && page < totalPages && !loading) loadImages(page + 1); },
      { threshold: 0.1 },
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [page, totalPages, loading, loadImages]);

  return (
    <div ref={containerRef} className="gallery-view" style={{
      position: "fixed", inset: 0, zIndex: 80,
      background: "var(--ant-color-bg-layout)",
      userSelect: "none",
      pointerEvents: "none",
    }}>
      {/* 布局预设工具栏 */}
      <div className="freeview-toolbar" style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
        zIndex: 100, pointerEvents: "auto",
        display: "flex", gap: 4, alignItems: "center",
        background: "var(--ant-color-bg-container)",
        padding: "4px 8px",
        borderRadius: 10,
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
      }}>
        {FREE_LAYOUTS.map((l) => (
          <Button
            key={l.value}
            type={layoutPreset === l.value && heartMode === 0 ? "primary" : "text"}
            size="small"
            onClick={() => { setHeartMode(0); setLayoutPreset(l.value); }}
            style={{ borderRadius: 8, fontSize: 12 }}
          >
            {l.label}
          </Button>
        ))}
        <div style={{ width: 1, height: 16, background: "var(--ant-color-border-secondary)", margin: "0 2px" }} />
        <Tooltip title={heartMode === 0 ? "排列为爱心" : heartMode === 1 ? "切换描边爱心" : "关闭爱心"}>
          <HeartFilled style={{
            fontSize: 15,
            color: heartMode === 0 ? "var(--ant-color-text-tertiary)" : heartMode === 1 ? "#e74c3c" : "#e74c3c",
            cursor: "pointer", transition: "color 0.3s",
            opacity: heartMode === 2 ? 0.6 : 1,
          }} onClick={() => setHeartMode((p) => ((p + 1) % 3) as HeartMode)} />
        </Tooltip>
      </div>
      <Image.PreviewGroup
        preview={{
          mask: (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>
              <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
              <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>
            </div>
          ),
          countRender: () => null,
          toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
            const url = images[(info as any).current ?? 0]?.url || "";
            const btnStyle: React.CSSProperties = { color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer", padding: 6, display: "inline-flex", alignItems: "center" };
            return (
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, padding: "0 4px" }}>
                <Tooltip title="下载图片"><span onClick={() => url && downloadOne(url)} style={btnStyle}><DownloadOutlined /></span></Tooltip>
                <Tooltip title="复制链接"><span onClick={() => url && copyOne(url)} style={btnStyle}><CopyOutlined /></span></Tooltip>
                <Tooltip title="图片信息"><span onClick={() => url && handleQueryInfo(url)} style={btnStyle}><InfoCircleOutlined /></span></Tooltip>
                {originalNode}
              </div>
            );
          },
        } as any}
      >
        {images.map((img) => {
          const pos = positions.get(img.created_at);
          if (!pos) return null;
          return (
            <div key={img.created_at}
              onMouseDown={(e) => onMouseDown(img.created_at, e)}
              onTouchStart={(e) => onTouchStart(img.created_at, e)}
              style={{
                position: "absolute", left: pos.x, top: pos.y,
                pointerEvents: "auto",
                transform: `rotate(${pos.rotate}deg)`,
                cursor: draggingId === img.created_at ? "grabbing" : "grab",
                zIndex: (() => {
                  if (draggingId === img.created_at) return 1000;
                  const idx = layerOrder.indexOf(img.created_at);
                  if (idx !== -1) return (idx + 1) * 10;
                  return 1;
                })(),
                padding: "10px 10px 40px 10px",
                background: "#fff",
                borderRadius: 2,
                boxShadow: draggingId === img.created_at
                  ? "4px 8px 24px rgba(0,0,0,0.3)"
                  : layerOrder[layerOrder.length - 1] === img.created_at
                  ? "2px 4px 12px rgba(0,0,0,0.2)"
                  : "1px 2px 8px rgba(0,0,0,0.15)",
                transition: draggingId === img.created_at ? "none" : "box-shadow 0.2s",
                touchAction: "none",
              }}
              onMouseEnter={(e) => {
                if (draggingId) return;
                (e.currentTarget as HTMLElement).style.boxShadow = "3px 6px 20px rgba(0,0,0,0.25)";
              }}
              onMouseLeave={(e) => {
                if (draggingId) return;
                (e.currentTarget as HTMLElement).style.boxShadow = "1px 2px 8px rgba(0,0,0,0.15)";
              }}
            >
              <div style={{ width: 200, height: 160, overflow: "hidden", background: "#eee" }}>
                <Image src={img.url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  {...getImgProps(img)} />
              </div>
            </div>
          );
        })}
      </Image.PreviewGroup>

      <div ref={observerRef} style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", padding: "24px", pointerEvents: "auto" }}>
        {loading && page < totalPages && <Spin size="small" />}
        {!loading && page < totalPages && (
          <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)}>加载更多</Button>
        )}
        {!loading && page >= totalPages && images.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-tertiary)" }}>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
            <Text type="secondary">已加载全部照片 🎉</Text>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== 骨架屏加载组件 ==================== */

function SkeletonGallery() {
  const { accentColor } = useTheme();
  return (
    <div className="fade-in-up" style={{ padding: "16px 16px 24px" }}>
      {/* 顶部加载指示器 */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 10, padding: "32px 0 28px",
      }}>
        <div className="loading-logo" style={{
          width: 48, height: 48, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`,
          border: `1px solid ${accentColor}20`,
        }}>
          <PictureOutlined style={{ fontSize: 24, color: accentColor }} />
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: accentColor,
          letterSpacing: 0.5,
        }}>
          正在加载广场
          <span className="loading-dot">·</span>
          <span className="loading-dot">·</span>
          <span className="loading-dot">·</span>
        </div>
        <div className="page-loading-bar" style={{ width: "60%", maxWidth: 240 }} />
      </div>

      {/* 工具栏骨架 */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexWrap: "wrap", gap: 8,
      }}>
        <div className="skeleton-line" style={{ width: 90, height: 14 }} />
        <div className="skeleton-line" style={{ width: 160, height: 30, borderRadius: 15 }} />
      </div>

      {/* 卡片网格骨架 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
        gap: 16,
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{
            animationDelay: `${i * 0.08}s, ${i * 0.08}s`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div className="skeleton-image" />
          </div>
        ))}
      </div>
    </div>
  );
}
