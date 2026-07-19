import { useCallback, useEffect, useState } from "react";
import {
  Button, Card, Dropdown, Image, Progress, Segmented, Space, Tag, Typography, Upload, Popconfirm, App,
} from "antd";
import type { MenuProps } from "antd";
import {
  CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, ReloadOutlined, ClockCircleOutlined, PlusCircleOutlined,
  AppstoreOutlined, UnorderedListOutlined, MenuOutlined, PictureOutlined,
  CaretUpOutlined, CaretDownOutlined, AimOutlined,
} from "@ant-design/icons";
import { clearImagesCache, uploadImageToServer, uploadToImageBed } from "@/api";
import { useTheme } from "@/contexts/ThemeContext";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import type { UploadRecord } from "@/types";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const HISTORY_KEY = "upload_history";
const RATE_LIMIT_MS = 1100;

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ==================== 全局上传引擎 ==================== */

class UploadEngine {
  private queue: UploadRecord[] = [];
  private running = false;
  private listeners = new Set<(r: UploadRecord[]) => void>();
  private abortFlag = false;
  private lastUploadAt = 0;
  private retryMap = new Map<string, number>();
  private maxRetry = 5;

  subscribe(fn: (r: UploadRecord[]) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  getRecords() { return this.queue; }
  isRunning() { return this.running; }

  private notify() {
    const data = [...this.queue];
    this.listeners.forEach((fn) => fn(data));
    this.saveHistory();
  }

  add(records: UploadRecord[]) { this.queue.push(...records); this.notify(); }
  remove(id: string) { this.queue = this.queue.filter((r) => r.id !== id); this.notify(); }
  clearDone() { this.queue = this.queue.filter((r) => r.status !== "done"); this.notify(); }
  clearAll() { this.queue = []; this.notify(); }

  private saveHistory() {
    try {
      const toSave = this.queue.filter(
        (r) => r.status !== "uploading_imagebed" && r.status !== "uploading_server"
      );
      localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave));
    } catch { /* ignore */ }
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.abortFlag = false;

    while (this.running && !this.abortFlag) {
      const idx = this.queue.findIndex(
        (r) => r.status === "pending" || r.status === "failed"
      );
      if (idx === -1) break;
      await this.uploadOne(idx);
    }
    this.running = false;
    this.notify();
  }

  stop() { this.abortFlag = true; this.running = false; }

  private async uploadOne(idx: number) {
    if (this.abortFlag) return;
    const record = this.queue[idx];
    if (!record || record.status === "done") return;

    // 速率限制
    const elapsed = Date.now() - this.lastUploadAt;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this.lastUploadAt = Date.now();

    this.queue[idx] = { ...record, status: "uploading_imagebed" as const };
    this.notify();

    if (!record.localUrl) {
      this.queue[idx] = { ...record, status: "failed" as const, error: "图片已过期" };
      this.notify();
      return;
    }

    try {
      const blob = await fetch(record.localUrl).then((r) => r.blob());
      const file = new File([blob], record.fileName, { type: blob.type });
      const imageBedUrl = await uploadToImageBed(file);

      this.queue[idx] = { ...record, imageBedUrl, status: "uploading_server" as const };
      this.notify();

      await uploadImageToServer(imageBedUrl);
      clearImagesCache();
      this.queue[idx] = { ...record, imageBedUrl, status: "done" as const };
      this.retryMap.delete(record.id);
      this.notify();
    } catch (err) {
      const retries = (this.retryMap.get(record.id) || 0) + 1;
      if (retries <= this.maxRetry) {
        this.retryMap.set(record.id, retries);
        // 重新加入队列（标记为 failed 但会再次被 pick up）
        this.queue[idx] = { ...record, status: "failed" as const,
          error: err instanceof Error ? err.message : "上传失败" };
      } else {
        this.queue[idx] = { ...record, status: "failed" as const,
          error: err instanceof Error ? err.message : "上传失败" };
      }
      this.notify();
    }
  }
}

const engine = new UploadEngine();

/* ==================== 组件 ==================== */

function ThumbImage({ url, name, size }: { url: string; name: string; size: number }) {
  const [error, setError] = useState(false);
  if (error) return <ImagePlaceholder size={size} />;
  return <Image src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} preview={false} onError={() => setError(true)} />;
}

type ViewMode = "card" | "list" | "grid";
type FilterStatus = "all" | "done" | "failed" | "pending";

export default function UploadPage() {
  const { message } = App.useApp();
  const [records, setRecords] = useState<UploadRecord[]>(() => engine.getRecords());
  const [uploading, setUploading] = useState(() => engine.isRunning());
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const { accentColor } = useTheme();

  useEffect(() => engine.subscribe((r) => { setRecords(r); setUploading(engine.isRunning()); }), []);

  const filteredRecords = filterStatus === "all"
    ? records
    : records.filter((r) => {
        if (filterStatus === "done") return r.status === "done";
        if (filterStatus === "failed") return r.status === "failed";
        return r.status === "pending" || r.status === "uploading_imagebed" || r.status === "uploading_server";
      });

  const handleBeforeUpload = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowedExt = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"];
    if (!file.type.startsWith("image/") && !allowedExt.includes(ext)) {
      message.warning("仅支持上传图片文件"); return Upload.LIST_IGNORE;
    }
    engine.add([{ id: uid(), fileName: file.name, fileSize: file.size, localUrl: URL.createObjectURL(file), status: "pending", createdAt: Date.now() }]);
    return false;
  }, [message]);

  const startUpload = () => {
    if (!engine.getRecords().some((r) => r.status === "pending" || r.status === "failed")) {
      message.warning("请先选择图片");
      return;
    }
    engine.start();
  };

  const retryFailed = () => {
    if (!engine.getRecords().some((r) => r.status === "failed")) {
      message.warning("没有失败的项目");
      return;
    }
    engine.start();
  };

  const totalCount = records.length;
  const doneCount = records.filter((r) => r.status === "done").length;
  const failedCount = records.filter((r) => r.status === "failed").length;
  const pendingCount = records.filter((r) => r.status === "pending" || r.status === "uploading_imagebed" || r.status === "uploading_server").length;

  // 上传页面右键菜单
  const uploadCtxMenu: MenuProps = {
    items: [
      { key: "upload", icon: <CloudUploadOutlined />, label: "上传图片" },
      { key: "select", icon: <PictureOutlined />, label: "选择图片文件" },
    ],
    onClick: ({ key }) => {
      if (key === "upload") startUpload();
      else if (key === "select") {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif"; input.multiple = true;
        input.onchange = () => {
          Array.from(input.files || []).forEach((f) => {
            const ext = f.name.split(".").pop()?.toLowerCase() || "";
            const allowedExt = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"];
            if (f.type.startsWith("image/") || allowedExt.includes(ext)) {
              engine.add([{ id: uid(), fileName: f.name, fileSize: f.size, localUrl: URL.createObjectURL(f), status: "pending", createdAt: Date.now() }]);
            }
          });
        };
        input.click();
      }
    },
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const statusTag = (status: string, error?: string) => {
    const base = { borderRadius: 10, fontSize: 12, padding: "2px 10px", fontWeight: 500 };
    switch (status) {
      case "pending": return <Tag icon={<ClockCircleOutlined />} style={base}>等待</Tag>;
      case "uploading_imagebed": return (
        <Tag icon={<CloudUploadOutlined spin />} color="processing" style={base}>
          图床上传中
        </Tag>
      );
      case "uploading_server": return (
        <Tag icon={<CloudUploadOutlined spin />} color="processing" style={base}>
          服务器同步中
        </Tag>
      );
      case "done": return <Tag icon={<CheckCircleOutlined />} color="success" style={base}>成功</Tag>;
      case "failed": return <Tag icon={<CloseCircleOutlined />} color="error" title={error} style={base}>失败</Tag>;
    }
  };

  return (
    <>
    <Dropdown menu={uploadCtxMenu} trigger={['contextMenu']}>
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ textAlign: "center", padding: "32px 16px 20px" }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800,
          background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}aa 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>
          <PlusCircleOutlined style={{ marginRight: 8 }} />上传照片
        </Title>
        <Text type="secondary" style={{ display: "block", marginTop: 8 }}>选择图片，多选自动加入上传队列</Text>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 700, margin: "0 auto" }}>
        <Dragger multiple accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif" showUploadList={false}
          beforeUpload={handleBeforeUpload as any} disabled={uploading}
          style={{
            borderRadius: 20, padding: "8px 0",
            background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}03 100%)`,
            border: `2px dashed ${accentColor}55`,
            transition: "all 0.3s",
          }}>
          <p className="ant-upload-drag-icon">
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 72, height: 72, borderRadius: "50%",
              background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`,
              animation: "memories-logo-breathe 3s ease-in-out infinite",
            }}>
              <CloudUploadOutlined style={{ fontSize: 36, color: accentColor }} />
            </span>
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>点击或拖拽图片到此处</p>
          <p className="ant-upload-hint" style={{ fontSize: 13 }}>支持 JPG / PNG / WebP · 可多选</p>
        </Dragger>

        {records.length > 0 && (
          <>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 16, flexWrap: "wrap", gap: 8,
              padding: "10px 14px", borderRadius: 14,
              background: "var(--ant-color-fill-quaternary)",
            }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <Text style={{ fontSize: 13, fontWeight: 600 }}>共 {totalCount}</Text>
                <Segmented size="small" value={filterStatus} onChange={(v) => setFilterStatus(v as FilterStatus)}
                  options={[
                    { value: "all", label: `全部 ${totalCount}` },
                    { value: "done", label: `✓ ${doneCount}` },
                    { value: "failed", label: `✕ ${failedCount}` },
                    { value: "pending", label: `⏱ ${pendingCount}` },
                  ] as any} />
              </div>
              <Space size={6} wrap>
                <Segmented size="small" value={viewMode} onChange={(v) => setViewMode(v as ViewMode)}
                  options={[{ value: "card", icon: <AppstoreOutlined /> }, { value: "list", icon: <UnorderedListOutlined /> }, { value: "grid", icon: <MenuOutlined /> }] as any} />
                {failedCount > 0 && <Button size="small" type="link" danger icon={<ReloadOutlined />} onClick={retryFailed}>重试</Button>}
                <Button size="small" type="primary" icon={!uploading ? <CloudUploadOutlined /> : undefined} onClick={startUpload}
                  disabled={uploading || records.every((r) => r.status === "done")} loading={uploading}
                  style={{
                    borderRadius: 10, fontWeight: 600, minWidth: 96,
                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    border: "none", boxShadow: `0 3px 10px ${accentColor}33`,
                    color: "#fff",
                  }}>{uploading ? "上传中…" : "开始上传"}</Button>
                <Popconfirm title="清除所有已完成记录？" onConfirm={() => { engine.clearDone(); message.success("已清除"); }} okText="确定" cancelText="取消">
                  <Button size="small" type="link" icon={<DeleteOutlined />}>清除完成</Button>
                </Popconfirm>
              </Space>
            </div>
            {uploading && totalCount > 0 && (
              <Progress percent={Math.round((doneCount / totalCount) * 100)} style={{ marginTop: 12 }} strokeColor={{ "0%": accentColor, "100%": "#53C49E" }} />
            )}
          </>
        )}

        {records.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {filteredRecords.length === 0 && (
              <div style={{ textAlign: "center", padding: 32, color: "var(--ant-color-text-quaternary)" }}>
                <Text type="secondary">当前筛选条件下无记录</Text>
              </div>
            )}
            {filteredRecords.length > 0 && viewMode === "card" && (
              <Space direction="vertical" style={{ width: "100%" }}>
                {filteredRecords.map((r) => (
                  <Card key={r.id} size="small" data-upload-id={r.id} style={{
                    borderRadius: 14, opacity: r.status === "done" ? 0.85 : 1,
                    transition: "all 0.25s",
                    border: r.status === "failed" ? "1px solid #ff4d4f44" : r.status === "done" ? `1px solid ${accentColor}33` : undefined,
                    position: "relative", overflow: "hidden",
                  }} styles={{ body: { padding: "10px 14px" } }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--ant-color-fill-quaternary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {r.localUrl ? <ThumbImage url={r.localUrl} name={r.fileName} size={32} /> : <ImagePlaceholder size={32} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fileName}</Text>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatSize(r.fileSize)}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(r.createdAt)}</Text>
                        </div>
                        <div style={{ marginTop: 4 }}>{statusTag(r.status, r.error)}</div>
                      </div>
                      {r.status !== "uploading_imagebed" && r.status !== "uploading_server" && (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => engine.remove(r.id)} />
                      )}
                    </div>
                    {/* 上传中底部进度条 */}
                    {(r.status === "uploading_imagebed" || r.status === "uploading_server") && (
                      <div style={{
                        position: "absolute", left: 0, right: 0, bottom: 0, height: 2,
                        background: "var(--ant-color-border-secondary)", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: "40%",
                          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
                          animation: "upload-progress-slide 1.4s ease-in-out infinite",
                        }} />
                      </div>
                    )}
                  </Card>
                ))}
              </Space>
            )}
            {filteredRecords.length > 0 && viewMode === "list" && (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--ant-color-border-secondary)" }}>
                {filteredRecords.map((r, i) => (
                  <div key={r.id} data-upload-id={r.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "7px 14px",
                    background: "var(--ant-color-bg-container)",
                    borderBottom: i < filteredRecords.length - 1 ? "1px solid var(--ant-color-border-secondary)" : "none",
                    position: "relative", overflow: "hidden",
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, width: 44, flexShrink: 0 }}>{formatTime(r.createdAt)}</Text>
                    <Text style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fileName}</Text>
                    <Text type="secondary" style={{ fontSize: 11, width: 52, textAlign: "right", flexShrink: 0 }}>{formatSize(r.fileSize)}</Text>
                    <div style={{ width: 52, flexShrink: 0, display: "flex", justifyContent: "center" }}>{statusTag(r.status, r.error)}</div>
                    {r.status !== "uploading_imagebed" && r.status !== "uploading_server" && (
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => engine.remove(r.id)} />
                    )}
                    {(r.status === "uploading_imagebed" || r.status === "uploading_server") && (
                      <div style={{
                        position: "absolute", left: 0, right: 0, bottom: 0, height: 2,
                        background: "var(--ant-color-border-secondary)", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: "40%",
                          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
                          animation: "upload-progress-slide 1.4s ease-in-out infinite",
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {filteredRecords.length > 0 && viewMode === "grid" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {filteredRecords.map((r) => (
                  <div key={r.id} data-upload-id={r.id} style={{
                    borderRadius: 12, overflow: "hidden", background: "var(--ant-color-bg-container)",
                    border: r.status === "failed" ? "1px solid #ff4d4f44" : r.status === "done" ? `1px solid ${accentColor}33` : "1px solid var(--ant-color-border-secondary)",
                    transition: "all 0.25s",
                  }}>
                    <div style={{ aspectRatio: "1", overflow: "hidden", background: "var(--ant-color-fill-quaternary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {r.localUrl ? <ThumbImage url={r.localUrl} name={r.fileName} size={36} /> : <ImagePlaceholder size={36} />}
                    </div>
                    <div style={{ padding: "4px 6px" }}>
                      <Text style={{ fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fileName}</Text>
                      <div style={{ marginTop: 2, transform: "scale(0.8)", transformOrigin: "left" }}>{statusTag(r.status, r.error)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {records.length > 10 && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Popconfirm title="清空所有上传记录？" onConfirm={() => { engine.clearAll(); message.success("已清空"); }} okText="确定" cancelText="取消">
              <Button size="small" type="link" danger>清空全部记录</Button>
            </Popconfirm>
          </div>
        )}
      </div>
    </div>
    </Dropdown>

    {/* 右侧快速导航 */}
    <UploadQuickNav records={records} accentColor={accentColor} />
    </>
  );
}

/* ===== 上传快速导航组件 ===== */

function UploadQuickNav({ records, accentColor }: { records: UploadRecord[]; accentColor: string }) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (records.length === 0) return null;

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  const scrollToCurrentUpload = () => {
    const uploading = records.find(
      (r) => r.status === "uploading_imagebed" || r.status === "uploading_server"
    );
    if (!uploading) return;
    const el = document.querySelector(`[data-upload-id="${uploading.id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const hasUploading = records.some(
    (r) => r.status === "uploading_imagebed" || r.status === "uploading_server"
  );

  const btn: React.CSSProperties = {
    cursor: "pointer",
    width: isDesktop ? 36 : 44,
    height: isDesktop ? 36 : 44,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `${accentColor}14`,
    color: accentColor,
    border: `1px solid ${accentColor}30`,
    fontSize: isDesktop ? 14 : 16,
    transition: "all 0.2s",
    boxShadow: `0 2px 8px ${accentColor}18`,
  };

  return (
    <div style={{
      position: "fixed",
      right: isDesktop ? 16 : 8,
      top: "50%",
      transform: "translateY(-50%)",
      zIndex: 996,
      display: "flex",
      flexDirection: "column",
      gap: isDesktop ? 6 : 8,
    }}>
      <div
        onClick={scrollToTop}
        style={btn}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = accentColor;
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${accentColor}14`;
          e.currentTarget.style.color = accentColor;
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <CaretUpOutlined />
      </div>

      {hasUploading && (
        <div
          onClick={scrollToCurrentUpload}
          style={{
            ...btn,
            background: accentColor,
            color: "#fff",
            boxShadow: `0 2px 12px ${accentColor}44`,
            animation: "memories-status-pulse 2s ease-in-out infinite",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <AimOutlined />
        </div>
      )}

      <div
        onClick={scrollToBottom}
        style={btn}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = accentColor;
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `${accentColor}14`;
          e.currentTarget.style.color = accentColor;
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <CaretDownOutlined />
      </div>
    </div>
  );
}
