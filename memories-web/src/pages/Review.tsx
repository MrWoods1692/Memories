import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button, Card, Empty, Image, Modal, Spin, Tag, Tooltip, Typography, App, Descriptions,
} from "antd";
import {
  CheckOutlined, CloseOutlined, EyeOutlined, InfoCircleOutlined,
  ArrowDownOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  DownloadOutlined, CopyOutlined,
} from "@ant-design/icons";
import { fetchPendingImages, auditImage, extractImageBedFilename, queryImageInfo } from "@/api";
import { useTheme } from "@/contexts/ThemeContext";
import type { ImageBedInfo, ImageItem } from "@/types";

const { Title, Text } = Typography;

export default function ReviewPage() {
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

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadImages = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetchPendingImages(pageNum, 20);
      if (pageNum === 1) setImages(res.items);
      else setImages((prev) => [...prev, ...res.items]);
      setTotalPages(res.totalPages);
      setPage(pageNum);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [message]);

  // 初次加载
  useEffect(() => {
    loadImages(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // 审核操作
  const handleAudit = useCallback(async (id: number, status: 1 | 2) => {
    const label = status === 1 ? "通过" : "拒绝";
    Modal.confirm({
      title: `确认${label}`,
      icon: <ExclamationCircleOutlined />,
      content: status === 2
        ? "拒绝后将自动删除该图片，确定继续？"
        : `确定要将该图片设为"已通过"吗？`,
      okText: label,
      cancelText: "取消",
      okButtonProps: { danger: status === 2 },
      onOk: async () => {
        try {
          await auditImage(id, status);
          message.success(`已${label}`);
          // 从列表中移除
          setImages((prev) => prev.filter((img) => img.id !== id));
        } catch (err) {
          message.error(err instanceof Error ? err.message : "操作失败");
        }
      },
    });
  }, [message]);

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

  // 待审核数量（只统计 pending）
  const pendingImages = useMemo(() => images.filter((i) => i.status === 0), [images]);
  const pendingCount = pendingImages.length;

  if (initialLoading) {
    return <SkeletonReview />;
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, flexWrap: "wrap", gap: 8,
        }}>
          <Title level={3} style={{
            margin: 0, fontWeight: 700, color: accentColor,
            fontSize: 22,
          }}>
            审核 <CheckCircleOutlined />
          </Title>
          <Tag color={pendingCount > 0 ? "orange" : "green"} style={{ fontSize: 13, borderRadius: 12, padding: "2px 12px" }}>
            待审核 {pendingCount} 张
          </Tag>
        </div>
      </div>

      {pendingImages.length === 0 && !loading ? (
        <Empty description="暂无待审核图片 🎉" />
      ) : (
        <>
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
                  <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>点击预览</Text>
                </div>
              ),
              toolbarRender: (originalNode: React.ReactNode, info: { current: number; actions: Record<string, unknown> }) => {
                const url = pendingImages[(info as any).current ?? 0]?.url || "";
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
                    {originalNode}
                  </div>
                );
              },
            } as any}
          >
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
              gap: 16, padding: "0 16px",
            }}>
              {pendingImages.map((img) => {
                const dateStr = new Date(img.created_at).toLocaleDateString("zh-CN");
                const isPending = img.status === 0;
                const statusTag = isPending
                  ? <Tag color="orange" style={{ borderRadius: 6, fontSize: 11 }}>待审核</Tag>
                  : img.status === 1
                  ? <Tag color="green" style={{ borderRadius: 6, fontSize: 11 }}>已通过</Tag>
                  : <Tag color="red" style={{ borderRadius: 6, fontSize: 11 }}>已拒绝</Tag>;

                return (
                  <Card key={img.id} size="small" hoverable
                    style={{
                      borderRadius: 12, overflow: "hidden",
                      border: isPending ? `2px solid ${accentColor}44` : undefined,
                    }}
                    styles={{ body: { padding: 0 } }}
                    cover={
                      <div style={{
                        position: "relative", overflow: "hidden",
                        aspectRatio: "4/3", maxHeight: 400,
                        background: "var(--ant-color-fill-quaternary)",
                      }}>
                        <Image src={img.url} alt={dateStr}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNiI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pjwvc3ZnPg=="
                        />
                      </div>
                    }>
                    <div style={{ padding: "8px 12px" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 6, flexWrap: "wrap", gap: 4,
                      }}>
                        {statusTag}
                        <Text type="secondary" style={{ fontSize: 11 }}>#{img.id}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                        {dateStr}
                      </Text>
                      {isPending && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button type="primary" size="small" icon={<CheckOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleAudit(img.id, 1); }}
                            style={{ flex: 1, borderRadius: 8, background: "#52c41a", borderColor: "#52c41a" }}>
                            通过
                          </Button>
                          <Button danger size="small" icon={<CloseOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleAudit(img.id, 2); }}
                            style={{ flex: 1, borderRadius: 8 }}>
                            拒绝
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </Image.PreviewGroup>

          <div ref={observerRef} style={{ textAlign: "center", padding: "24px 16px" }}>
            {loading && <Spin size="small" />}
            {!loading && page < totalPages && (
              <Button type="link" icon={<ArrowDownOutlined />}
                onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
            )}
            {!loading && page >= totalPages && pendingImages.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#999" }}>
                <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                <Text type="secondary">已加载全部照片 🎉</Text>
              </div>
            )}
          </div>
        </>
      )}

      {/* 图片信息弹窗 */}
      {/* 图片信息弹窗 */}
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
    </div>
  );
}

/* ==================== 骨架屏加载组件 ==================== */

function SkeletonReview() {
  return (
    <div style={{ padding: "16px 16px 24px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <div className="skeleton-line" style={{ width: 100, height: 22 }} />
        <div className="skeleton-line" style={{ width: 80, height: 22, borderRadius: 12 }} />
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
        gap: 16,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="skeleton-image" />
            <div style={{ padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div className="skeleton-line" style={{ width: 48, height: 20, borderRadius: 6 }} />
                <div className="skeleton-line" style={{ width: 30, height: 12 }} />
              </div>
              <div className="skeleton-line" style={{ width: "70%", height: 12, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-line" style={{ flex: 1, height: 28, borderRadius: 8 }} />
                <div className="skeleton-line" style={{ flex: 1, height: 28, borderRadius: 8 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
