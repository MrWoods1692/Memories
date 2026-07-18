import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button, Card, Descriptions, Dropdown, Empty, Image, Modal, Segmented, Spin, Tag, Tooltip, Typography, App,
} from "antd";
import {
  AppstoreOutlined, ArrowDownOutlined, BarsOutlined, BlockOutlined, BorderOutlined, CheckCircleOutlined, CheckSquareOutlined,
  CloseCircleOutlined, CopyOutlined, DownloadOutlined, DragOutlined, EyeOutlined, FieldTimeOutlined, InfoCircleOutlined, PictureOutlined,
  PlayCircleOutlined, PauseCircleOutlined, CaretRightOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { fetchImages, extractImageBedFilename, queryImageInfo } from "@/api";
import { useTheme } from "@/contexts/ThemeContext";
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
  const { preset } = useTheme();
  const accentColor = preset.config.token?.colorPrimary || "#1D6E5A";

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [imageInfo, setImageInfo] = useState<ImageBedInfo | null>(null);

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

  const viewOptions: { value: GalleryView; label: string; icon: React.ReactNode }[] = [
    { value: "grid", label: "网格", icon: <AppstoreOutlined /> },
    { value: "compact", label: "紧凑", icon: <PictureOutlined /> },
    { value: "list", label: "详情列表", icon: <UnorderedListOutlined /> },
    { value: "simple", label: "简洁列表", icon: <BarsOutlined /> },
    { value: "river", label: "河视图", icon: <BorderOutlined /> },
    { value: "masonry", label: "瀑布流", icon: <BlockOutlined /> },
    { value: "timeline", label: "时间线", icon: <FieldTimeOutlined /> },
    { value: "free", label: "自由照片", icon: <DragOutlined /> },
  ];
  const currentView = viewOptions.find((v) => v.value === viewMode)!;

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(images.map((i) => i.id))), [images]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);
  const toggleBatchMode = useCallback(() => {
    setBatchMode((prev) => { if (prev) setSelected(new Set()); return !prev; });
  }, []);

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
  const advanceSlide = useCallback(() => {
    if (images.length === 0) return false;
    // 循环索引
    slideshowIndex.current = (slideshowIndex.current + 1) % images.length;
    const idx = slideshowIndex.current;

    // 点击对应缩略图切换
    const thumbnails = document.querySelectorAll(".gallery-grid .ant-image-img");
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
  }, [images.length]);
  const startSlideshow = useCallback(() => {
    setSlideshow(true);
    setSlideshowPaused(false);
    setProgressKey(0);
    slideshowIndex.current = 0;
    isSlideshowRef.current = true;
    document.body.classList.add("slideshow-active");
    if (images.length > 0) {
      const imgs = document.querySelectorAll(".gallery-grid .ant-image-img");
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

  const handleQueryInfo = useCallback(async (url: string) => {
    const filename = extractImageBedFilename(url);
    if (!filename) { message.warning("无法解析图片文件名"); return; }
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
      color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer",
      padding: 6, display: "inline-flex", alignItems: "center",
    };
    return (
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, padding: "0 4px" }}>
        <Tooltip title="下载图片">
          <span onClick={() => url && downloadOne(url)} style={btnStyle}><DownloadOutlined /></span>
        </Tooltip>
        <Tooltip title="复制链接">
          <span onClick={() => url && copyOne(url)} style={btnStyle}><CopyOutlined /></span>
        </Tooltip>
        <Tooltip title="图片信息">
          <span onClick={() => url && handleQueryInfo(url)} style={btnStyle}><InfoCircleOutlined /></span>
        </Tooltip>
      </div>
    );
  }, [downloadOne, copyOne, handleQueryInfo]);

  const batchDownload = useCallback(async () => {
    const urls = images.filter((i) => selected.has(i.id)).map((i) => i.url);
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
    const urls = images.filter((i) => selected.has(i.id)).map((i) => i.url);
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
      if (pageNum === 1) setImages(res.items);
      else setImages((prev) => [...prev, ...res.items]);
      setTotalPages(res.totalPages); setPage(pageNum);
      retryCount.current.delete(pageNum); // 成功则清除重试记录

      // 处理排队中的请求
      if (pendingPage.current !== null) {
        const next = pendingPage.current;
        pendingPage.current = null;
        setTimeout(() => loadImages(next), LOAD_INTERVAL);
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
      img.id === imgId ? { ...img, url: retryUrl } : img
    ));

    // 成功后恢复原始 URL（延迟清理）
    setTimeout(() => {
      setImages((prev) => prev.map((img) =>
        img.id === imgId && img.url.includes("_retry=") ? { ...img, url: imgUrl } : img
      ));
    }, 3000);
  }, []);

  const getImgProps = useCallback((img: ImageItem) => ({
    onError: () => handleImgError(img.id, img.url),
    fallback: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNiI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pjwvc3ZnPg==",
  }), [handleImgError]);

  // 初次加载：缓存优先 → 后台同步 → 有新增则提示
  const cachedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const init = async () => {
      // 1. 先从缓存加载，立即显示
      try {
        const cached = await fetchImages(1, 20, false);
        if (cached.items.length > 0) {
          setImages(cached.items);
          setTotalPages(cached.totalPages);
          cachedIdsRef.current = new Set(cached.items.map((i) => i.id));
          setInitialLoading(false); // 有缓存，立即显示
        }
      } catch { /* 无缓存或出错，继续等待网络请求 */ }

      // 2. 后台同步最新数据
      try {
        const fresh = await fetchImages(1, 20, true);
        const newItems = fresh.items.filter((i) => !cachedIdsRef.current.has(i.id));
        if (newItems.length > 0 && cachedIdsRef.current.size > 0) {
          message.info(`📷 有 ${newItems.length} 张新照片`);
        }
        setImages(fresh.items);
        setTotalPages(fresh.totalPages);
        setPage(1);
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
      <div style={{
        padding: "16px 16px 8px",
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
                onChange={(v) => setViewMode(v as GalleryView)}
                options={viewOptions.map((v) => ({ value: v.value, icon: v.icon })) as any}
                style={{ marginRight: 4 }}
              />
            ) : (
              <Dropdown
                menu={{
                  items: viewOptions.map((v) => ({
                    key: v.value,
                    icon: v.icon,
                    label: v.label,
                    onClick: () => setViewMode(v.value),
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
            <Button
              onClick={toggleSlideshow}
              type={slideshow ? "primary" : "default"}
              icon={slideshow ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              title={slideshow ? "停止幻灯" : "幻灯播放"}
              style={{ borderRadius: 20, height: 36 }}
            />
              </>
            )}
            {!batchMode ? (
              <Button
                onClick={toggleBatchMode}
                icon={<CheckSquareOutlined />}
                style={{ borderRadius: 20, height: 36, fontWeight: 500,
                  borderColor: "var(--ant-color-border-secondary)" }}
              >
                {isDesktop ? "批量操作" : ""}
              </Button>
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

      {images.length === 0 && !loading ? (
        <Empty description="还没有人分享回忆，快来上传第一张吧！" />
      ) : viewMode === "river" ? (
        <>
        <Image.PreviewGroup
          preview={{
            mask: (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>
                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>
              </div>
            ),
            toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
              const url = images[(info as any).current ?? 0]?.url || "";
              return <>{makePreviewTools(url)}{originalNode}</>;
            },
          } as any}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gridAutoRows: "180px",
            columnGap: 1, rowGap: 12,
            padding: 0,
          }}>
            {images.map((img) => {
              const dateStr = new Date(img.created_at).toLocaleDateString("zh-CN");
              return (
                <div key={img.id} style={{
                  display: "flex", flexDirection: "column",
                  background: "var(--ant-color-bg-container)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    flex: 1, overflow: "hidden",
                    background: "var(--ant-color-fill-quaternary)",
                  }}>
                    <Image src={img.url} alt={dateStr}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      {...getImgProps(img)} />
                  </div>
                  <Text type="secondary" style={{
                    fontSize: 10, textAlign: "center",
                    padding: "2px 4px", lineHeight: 1.3,
                    borderTop: "1px solid var(--ant-color-border-secondary)",
                  }}>{dateStr}</Text>
                </div>
              );
            })}
          </div>
        </Image.PreviewGroup>
        <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
          {loading && <Spin size="small" />}
          {!loading && page < totalPages && (
            <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
          )}
          {!loading && page >= totalPages && images.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
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
            mask: (              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>              </div>            ),
toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
              const url = images[(info as any).current ?? 0]?.url || "";
              return <>{makePreviewTools(url)}{originalNode}</>;
            },
          } as any}
        >
          <div style={{
            columnCount: 4, columnGap: 0, columnRule: "none",
            columnFill: "balance",
            padding: 0, fontSize: 0,
          }}>
            {images.map((img) => (
              <div key={img.id} style={{
                breakInside: "avoid", marginBottom: 0,
                lineHeight: 0, fontSize: 0,
              }}>
                <Image src={img.url}
                  style={{ width: "100%", height: "auto", display: "block", verticalAlign: "top" }}
                  {...getImgProps(img)} />
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
        <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
          {loading && <Spin size="small" />}
          {!loading && page < totalPages && (
            <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
          )}
          {!loading && page >= totalPages && images.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
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
          <div className={`gallery-grid ${(viewMode === "list" || viewMode === "simple") ? "gallery-grid-list" : ""}`} style={{
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
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: "100%",
                    background: "rgba(0,0,0,0.12)",
                    backdropFilter: "blur(2px)",
                  }}>
                    <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
                    <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>
                      点击预览
                    </Text>
                  </div>
                ),
                toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
                  const url = images[(info as any).current ?? 0]?.url || "";
                  return <>{makePreviewTools(url)}{originalNode}</>;
                },
              } as any}
            >
            {images.map((img) => {
              const isSel = selected.has(img.id);
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
                    <div key={img.id} id={`list-row-${img.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "6px 14px",
                        borderBottom: "1px solid var(--ant-color-border-secondary)",
                        cursor: batchMode ? "pointer" : "default",
                      }}>
                      <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, width: 80 }}>{dateShort}</Text>
                      <Text
                        onClick={() => { if (!batchMode) { const el = document.getElementById(`list-row-${img.id}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); } }}
                        style={{
                          flex: 1, fontSize: 13, cursor: "pointer", color: accentColor,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{filename}</Text>
                      <Image src={img.url} style={{ display: "none" }} preview={batchMode ? false : undefined} {...getImgProps(img)} />
                    </div>
                  );
                }
                return (
                  <div key={img.id} id={`list-row-${img.id}`} className="gallery-list-row"
                    onClick={batchMode ? () => toggleSelect(img.id) : undefined}
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
                      onClick={() => { if (!batchMode) { const el = document.getElementById(`list-row-${img.id}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); } }}
                      style={{
                      flex: 1, fontSize: 13, cursor: "pointer", color: accentColor,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{filename}</Text>
                    <Text type="secondary" className="gallery-list-id" style={{ fontSize: 12, flexShrink: 0 }}>#{img.id}</Text>
                    {!batchMode && (
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      <Tooltip title="预览">
                        <Button type="text" size="small" icon={<EyeOutlined />}
                          onClick={(e) => { e.stopPropagation(); const el = document.getElementById(`list-row-${img.id}`)?.querySelector(".ant-image-img") as HTMLElement; el?.click(); }}
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
                <Card key={img.id} size="small" hoverable
                  style={{
                    borderRadius: 12, overflow: "hidden",
                    outline: batchMode && isSel ? `2px solid ${accentColor}` : undefined,
                    outlineOffset: -2,
                  }}
                  styles={{ body: { padding: 0 } }}
                  cover={
                    <div onClick={batchMode ? () => toggleSelect(img.id) : undefined}
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
                          border: `2px solid ${isSel ? accentColor : "#ccc"}`,
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
              );
            })}
            </Image.PreviewGroup>
          </div>

          <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
            {loading && <Spin size="small" />}
            {!loading && page < totalPages && (
              <Button type="link" icon={<ArrowDownOutlined />}
                onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
            )}
            {!loading && page >= totalPages && images.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
                <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                <Text type="secondary">已加载全部照片 🎉</Text>
              </div>
            )}
          </div>
        </>
      )}

      <Modal title="图片信息" open={infoOpen} onCancel={() => setInfoOpen(false)}
        footer={null} width={isDesktop ? 520 : "100%"}
        zIndex={2100}
        style={isDesktop ? {} : { maxWidth: "100vw", margin: 0, padding: 0, top: 0 }}
        styles={{
          body: { padding: isDesktop ? 16 : "12px 8px", maxHeight: isDesktop ? "70vh" : "80vh", overflowY: "auto", paddingBottom: isDesktop ? 16 : "calc(12px + env(safe-area-inset-bottom, 8px))" },
        }}
        destroyOnHidden>
        {infoLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : imageInfo ? (
          <Descriptions column={isDesktop ? 2 : 1} size="small" bordered labelStyle={{ fontWeight: 500, whiteSpace: "nowrap" }}>
            <Descriptions.Item label="文件名" span={2}>
              <Text copyable style={{ fontSize: 12 }}>{imageInfo.filename}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="原始文件名" span={2}>{imageInfo.original_filename}</Descriptions.Item>
            <Descriptions.Item label="上传时间">{imageInfo.upload_date}</Descriptions.Item>
            <Descriptions.Item label="最近访问">{imageInfo.last_accessed || "无记录"}</Descriptions.Item>
            <Descriptions.Item label="原大小">{imageInfo.size_display.split("→")[0]?.trim() || "-"}</Descriptions.Item>
            <Descriptions.Item label="压缩后">{imageInfo.size_display.split("→")[1]?.trim() || imageInfo.size_display}</Descriptions.Item>
            <Descriptions.Item label="存储位置"><Tag color="blue">{imageInfo.storage_location}</Tag></Descriptions.Item>
            <Descriptions.Item label="上传者 IP">{imageInfo.uploader_masked}</Descriptions.Item>
            <Descriptions.Item label="归属地" span={2}>{imageInfo.location || "未知"}</Descriptions.Item>
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
        ) : null}
      </Modal>

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

function TimelineView({ images, loading, page, totalPages, loadImages, getImgProps, downloadOne, copyOne, handleQueryInfo }: {
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
  const timelineRef = useRef<HTMLDivElement>(null);
  const [activeDate, setActiveDate] = useState<string>("");

  const makeTools = useCallback((url: string) => (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, padding: "0 4px" }}>
      <Tooltip title="下载图片"><span onClick={() => url && downloadOne(url)} style={{ color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer", padding: 6, display: "inline-flex", alignItems: "center" }}><DownloadOutlined /></span></Tooltip>
      <Tooltip title="复制链接"><span onClick={() => url && copyOne(url)} style={{ color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer", padding: 6, display: "inline-flex", alignItems: "center" }}><CopyOutlined /></span></Tooltip>
      <Tooltip title="图片信息"><span onClick={() => url && handleQueryInfo(url)} style={{ color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer", padding: 6, display: "inline-flex", alignItems: "center" }}><InfoCircleOutlined /></span></Tooltip>
    </div>
  ), [downloadOne, copyOne, handleQueryInfo]);

  // 按日期分组
  const dateGroups = useMemo(() => {
    const groups: Map<string, ImageItem[]> = new Map();
    images.forEach((img) => {
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
      setActiveDate(dateGroups[0][0]);
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
                <div key={date} onClick={() => setActiveDate(date)} style={{
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
            mask: (              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>                <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />                <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>              </div>            ),
toolbarRender: (originalNode: React.ReactNode, info: { current: number }) => {
            const url = activeImages[(info as any).current ?? 0]?.url || "";
            return <>{makeTools(url)}{originalNode}</>;
          },
        } as any}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 8, padding: "12px 16px",
        }}>
          {activeImages.map((img) => (
            <div key={img.id} style={{ borderRadius: 8, overflow: "hidden", background: "var(--ant-color-fill-quaternary)" }}>
              <Image src={img.url}
                style={{ width: "100%", height: "auto", display: "block", maxHeight: 300, objectFit: "cover" }}
                {...getImgProps(img)} />
            </div>
          ))}
        </div>
      </Image.PreviewGroup>

      <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
        {loading && <Spin size="small" />}
        {!loading && page < totalPages && (
          <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
        )}
        {!loading && page >= totalPages && images.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
            <Text type="secondary">已加载全部照片 🎉</Text>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== 自由照片视图 ===== */

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
  const [topPhotoId, setTopPhotoId] = useState<number | null>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current || images.length === 0) return;
    const w = containerRef.current.clientWidth;
    const h = Math.max(600, window.innerHeight * 0.7);
    setPositions((prev) => {
      const next = new Map(prev);
      images.forEach((img) => {
        if (!next.has(img.id)) {
          next.set(img.id, {
            x: 40 + Math.random() * Math.max(w - 300, 100),
            y: 20 + Math.random() * Math.max(h - 300, 100),
            rotate: (Math.random() - 0.5) * 12,
          });
        }
      });
      return next;
    });
  }, [images]);

  const startDrag = (id: number, clientX: number, clientY: number) => {
    const pos = positions.get(id);
    if (!pos) return;
    dragRef.current = { id, startX: clientX, startY: clientY, origX: pos.x, origY: pos.y };
    setDraggingId(id);
    setTopPhotoId(id);
  };

  const onMouseDown = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(id, e.clientX, e.clientY);
  };

  const onTouchStart = (id: number, e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startDrag(id, t.clientX, t.clientY);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX == null || clientY == null) return;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(dragRef.current!.id, {
          ...next.get(dragRef.current!.id)!,
          x: dragRef.current!.origX + dx,
          y: dragRef.current!.origY + dy,
        });
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
    <div ref={containerRef} style={{
      position: "relative", minHeight: "70vh",
      background: "var(--ant-color-bg-layout)",
      overflow: "hidden", userSelect: "none",
    }}>
      <Image.PreviewGroup
        preview={{
          mask: (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "rgba(0,0,0,0.12)", backdropFilter: "blur(2px)" }}>
              <EyeOutlined style={{ color: "#fff", fontSize: 20, marginRight: 6 }} />
              <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>
            </div>
          ),
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
          const pos = positions.get(img.id);
          if (!pos) return null;
          return (
            <div key={img.id}
              onMouseDown={(e) => onMouseDown(img.id, e)}
              onTouchStart={(e) => onTouchStart(img.id, e)}
              style={{
                position: "absolute", left: pos.x, top: pos.y,
                transform: `rotate(${pos.rotate}deg)`,
                cursor: draggingId === img.id ? "grabbing" : "grab",
                zIndex: draggingId === img.id ? 1000 : topPhotoId === img.id ? 100 : 1,
                padding: "10px 10px 40px 10px",
                background: "#fff",
                borderRadius: 2,
                boxShadow: draggingId === img.id
                  ? "4px 8px 24px rgba(0,0,0,0.3)"
                  : topPhotoId === img.id
                  ? "2px 4px 12px rgba(0,0,0,0.2)"
                  : "1px 2px 8px rgba(0,0,0,0.15)",
                transition: draggingId === img.id ? "none" : "box-shadow 0.2s",
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

      <div ref={observerRef} style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", padding: "24px" }}>
        {loading && <Spin size="small" />}
        {!loading && page < totalPages && (
          <Button type="link" icon={<ArrowDownOutlined />} onClick={() => loadImages(page + 1)}>加载更多</Button>
        )}
        {!loading && page >= totalPages && images.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
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
  return (
    <div style={{ padding: "16px 16px 24px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        marginBottom: 12,
      }}>
        <div className="skeleton-line skeleton-line-short" style={{ width: 80, height: 22 }} />
      </div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div className="skeleton-line" style={{ width: 80, height: 14 }} />
        <div className="skeleton-line" style={{ width: 160, height: 28, borderRadius: 14 }} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
        gap: 16,
      }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="skeleton-image" />
          </div>
        ))}
      </div>
    </div>
  );
}
