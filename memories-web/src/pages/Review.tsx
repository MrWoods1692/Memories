import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button, Card, Empty, Image, Modal, Spin, Tag, Tooltip, Typography, App, Descriptions,
} from "antd";
import {
  CheckOutlined, CloseOutlined, EyeOutlined, InfoCircleOutlined,
  ArrowDownOutlined, ArrowRightOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
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
  const { message, modal } = App.useApp();
  const observerRef = useRef<HTMLDivElement | null>(null);
  const { accentColor } = useTheme();

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
  const handleAudit = useCallback(async (url: string, status: 1 | 2) => {
    const label = status === 1 ? "通过" : "拒绝";
    modal.confirm({
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
          await auditImage(url, status);
          message.success(`已${label}`);
          // 从列表中移除
          setImages((prev) => prev.filter((img) => img.url !== url));
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
    <div className="fade-in-up" style={{ padding: "0 0 24px" }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 4, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}11 100%)`,
              border: `1px solid ${accentColor}30`,
              boxShadow: `0 2px 8px ${accentColor}18`,
            }}>
              <CheckCircleOutlined style={{ fontSize: 20, color: accentColor }} />
            </div>
            <Title level={3} style={{
              margin: 0, fontWeight: 700, color: accentColor,
              fontSize: 22,
            }}>
              审核
            </Title>
          </div>
          <Tag color={pendingCount > 0 ? "orange" : "green"}
            style={{
              fontSize: 13, borderRadius: 14, padding: "3px 14px",
              fontWeight: 600, margin: 0,
            }}>
            待审核 {pendingCount} 张
          </Tag>
        </div>
      </div>

      {pendingImages.length === 0 && !loading ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 16px 40px", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
            border: `1px solid ${accentColor}24`,
            marginBottom: 16,
            boxShadow: `0 4px 16px ${accentColor}14`,
          }}>
            <CheckCircleOutlined style={{ fontSize: 36, color: accentColor }} />
          </div>
          <Text strong style={{ fontSize: 16, marginBottom: 4, display: "block" }}>
            暂无待审核图片
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            所有图片已审核完毕 🎉
          </Text>
        </div>
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
                const idx = (info as any).current ?? 0;
                const url = pendingImages[idx]?.url || "";
                const btnStyle: React.CSSProperties = {
                  color: "rgba(255,255,255,0.85)", fontSize: 20, cursor: "pointer",
                  padding: 6, display: "inline-flex", alignItems: "center",
                };
                return (
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, padding: "0 4px" }}>
                    {/* 审核操作按钮 */}
                    <Tooltip key="pass" title="通过">
                      <button onClick={() => url && handleAudit(url, 1)} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                        background: "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)",
                        border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(82,196,26,0.4)",
                      }}>
                        <CheckOutlined /> 通过
                      </button>
                    </Tooltip>
                    <Tooltip key="reject" title="拒绝">
                      <button onClick={() => url && handleAudit(url, 2)} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 12px", borderRadius: 8, cursor: "pointer",
                        background: "linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%)",
                        border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(238,82,83,0.4)",
                      }}>
                        <CloseOutlined /> 拒绝
                      </button>
                    </Tooltip>
                    {/* 分隔线 */}
                    <span key="sep1" style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)", margin: "0 2px" }} />
                    {/* 下一张 */}
                    {idx < pendingImages.length - 1 && (
                      <Tooltip key="next" title="下一张">
                        <span onClick={() => (info as any).actions?.next?.()} style={btnStyle}>
                          <ArrowRightOutlined />
                        </span>
                      </Tooltip>
                    )}
                    {/* 分隔线 */}
                    <span key="sep2" style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)", margin: "0 2px" }} />
                    <Tooltip key="download" title="下载图片">
                      <span onClick={() => url && downloadOne(url)} style={btnStyle}><DownloadOutlined /></span>
                    </Tooltip>
                    <Tooltip key="copy" title="复制链接">
                      <span onClick={() => url && copyOne(url)} style={btnStyle}><CopyOutlined /></span>
                    </Tooltip>
                    <Tooltip key="info" title="图片信息">
                      <span onClick={() => url && handleQueryInfo(url)} style={btnStyle}><InfoCircleOutlined /></span>
                    </Tooltip>
                    {React.Children.map(originalNode, (child, i) =>
                      React.isValidElement(child)
                        ? React.cloneElement(child, { key: `orig-${i}` })
                        : child
                    )}
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
                  <Card key={`${img.url}-${img.created_at}`} size="small" hoverable
                    style={{
                      borderRadius: 14, overflow: "hidden",
                      border: isPending ? `1.5px solid ${accentColor}44` : undefined,
                      boxShadow: isPending
                        ? `0 4px 16px ${accentColor}18`
                        : "0 2px 8px rgba(0,0,0,0.06)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                    styles={{ body: { padding: 0 } }}
                    cover={
                      <div style={{
                        position: "relative", overflow: "hidden",
                        aspectRatio: "4/3", maxHeight: 400,
                        background: "var(--ant-color-fill-quaternary)",
                      }}>
                        <Image src={img.url} alt={dateStr}
                          style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s ease" }}
                          fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxNiI+5Zu+54mH5Yqg6L295aSx6LSlPC90ZXh0Pjwvc3ZnPg=="
                        />
                        {/* 待审核角标 */}
                        {isPending && (
                          <div style={{
                            position: "absolute", top: 8, left: 8,
                            padding: "3px 8px", borderRadius: 10,
                            background: `${accentColor}E6`, color: "#fff",
                            fontSize: 10, fontWeight: 600,
                            boxShadow: `0 2px 6px ${accentColor}40`,
                            backdropFilter: "blur(4px)",
                          }}>
                            待审核
                          </div>
                        )}
                      </div>
                    }>
                    <div style={{ padding: "10px 14px 12px" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 4, flexWrap: "wrap", gap: 4,
                      }}>
                        {statusTag}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 10 }}>
                        {dateStr}
                      </Text>
                      {isPending && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <Button type="primary" size="small" icon={<CheckOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleAudit(img.url, 1); }}
                            style={{
                              flex: 1, borderRadius: 10, height: 32, fontWeight: 600,
                              background: "linear-gradient(135deg, #52c41a 0%, #389e0d 100%)",
                              borderColor: "transparent",
                              boxShadow: "0 2px 8px rgba(82,196,26,0.3)",
                            }}>
                            通过
                          </Button>
                          <Button danger size="small" icon={<CloseOutlined />}
                            onClick={(e) => { e.stopPropagation(); handleAudit(img.url, 2); }}
                            style={{
                              flex: 1, borderRadius: 10, height: 32, fontWeight: 600,
                              background: "linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%)",
                              borderColor: "transparent",
                              boxShadow: "0 2px 8px rgba(238,82,83,0.3)",
                              color: "#fff",
                            }}>
                            <span style={{ color: "#fff" }}>拒绝</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </Image.PreviewGroup>

          <div ref={observerRef} style={{ textAlign: "center", padding: "28px 16px" }}>
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 12 }}>加载中</Text>
              </div>
            )}
            {!loading && page < totalPages && (
              <Button type="link" icon={<ArrowDownOutlined />}
                onClick={() => loadImages(page + 1)} style={{ fontSize: 14 }}>加载更多</Button>
            )}
            {!loading && page >= totalPages && pendingImages.length > 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 8, padding: "8px 0",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
                  border: `1px solid ${accentColor}24`,
                }}>
                  <CheckCircleOutlined style={{ color: accentColor, fontSize: 20 }} />
                </div>
                <Text type="secondary" style={{ fontSize: 13 }}>已加载全部照片 🎉</Text>
              </div>
            )}
          </div>
        </>
      )}

      {/* 图片信息弹窗 */}
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
          <Descriptions column={isDesktop ? 2 : 1} size="small" bordered styles={{ label: { fontWeight: 600, whiteSpace: "nowrap", background: `${accentColor}10`, color: accentColor } }}>
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
          <CheckCircleOutlined style={{ fontSize: 24, color: accentColor }} />
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: accentColor,
          letterSpacing: 0.5,
        }}>
          正在加载待审核
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
        <div className="skeleton-line" style={{ width: 100, height: 22 }} />
        <div className="skeleton-line" style={{ width: 80, height: 22, borderRadius: 12 }} />
      </div>

      {/* 卡片网格骨架 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
        gap: 16,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton-card" style={{
            position: "relative",
            animationDelay: `${i * 0.08}s, ${i * 0.08}s`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div className="skeleton-image" />
            <div style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div className="skeleton-line" style={{ width: 48, height: 20, borderRadius: 6 }} />
                <div className="skeleton-line" style={{ width: 30, height: 12 }} />
              </div>
              <div className="skeleton-line" style={{ width: "70%", height: 12, marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-line" style={{ flex: 1, height: 30, borderRadius: 8 }} />
                <div className="skeleton-line" style={{ flex: 1, height: 30, borderRadius: 8 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
