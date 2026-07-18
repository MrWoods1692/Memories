import { useCallback, useEffect, useState } from "react";
import {
  Button, Card, Image, Progress, Segmented, Space, Tag, Typography, Upload, Popconfirm, App,
} from "antd";
import {
  CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, ReloadOutlined, ClockCircleOutlined, PlusCircleOutlined,
  AppstoreOutlined, UnorderedListOutlined, MenuOutlined,
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

export default function UploadPage() {
  const { message } = App.useApp();
  const [records, setRecords] = useState<UploadRecord[]>(() => engine.getRecords());
  const [uploading, setUploading] = useState(() => engine.isRunning());
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const { preset } = useTheme();
  const accentColor = preset.config.token?.colorPrimary || "#1D6E5A";

  useEffect(() => engine.subscribe((r) => { setRecords(r); setUploading(engine.isRunning()); }), []);

  const handleBeforeUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { message.warning("仅支持上传图片文件"); return Upload.LIST_IGNORE; }
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
    const base = { borderRadius: 8, fontSize: 12 };
    switch (status) {
      case "pending": return <Tag icon={<ClockCircleOutlined />} style={base}>等待</Tag>;
      case "uploading_imagebed": return <Tag icon={<CloudUploadOutlined />} color="processing" style={base}>图床中</Tag>;
      case "uploading_server": return <Tag icon={<CloudUploadOutlined />} color="processing" style={base}>服务器中</Tag>;
      case "done": return <Tag icon={<CheckCircleOutlined />} color="success" style={base}>成功</Tag>;
      case "failed": return <Tag icon={<CloseCircleOutlined />} color="error" title={error} style={base}>失败</Tag>;
    }
  };

  return (
    <div style={{ padding: "0 0 24px" }}>
      <div style={{ textAlign: "center", padding: "32px 16px 20px" }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: accentColor }}>
          <PlusCircleOutlined style={{ marginRight: 6 }} />上传照片
        </Title>
        <Text type="secondary" style={{ display: "block", marginTop: 8 }}>选择图片，多选自动加入上传队列</Text>
      </div>

      <div style={{ padding: "0 16px", maxWidth: 700, margin: "0 auto" }}>
        <Dragger multiple accept="image/*" showUploadList={false}
          beforeUpload={handleBeforeUpload as any} disabled={uploading}
          style={{ borderRadius: 16 }}>
          <p className="ant-upload-drag-icon"><CloudUploadOutlined style={{ fontSize: 48, color: accentColor }} /></p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>点击或拖拽图片到此处</p>
          <p className="ant-upload-hint" style={{ fontSize: 13 }}>支持 JPG / PNG / WebP · 可多选</p>
        </Dragger>

        {records.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>共 {totalCount} · 成功 {doneCount} · 失败 {failedCount} · 待处理 {pendingCount}</Text>
              <Space size={6} wrap>
                <Segmented size="small" value={viewMode} onChange={(v) => setViewMode(v as ViewMode)}
                  options={[{ value: "card", icon: <AppstoreOutlined /> }, { value: "list", icon: <UnorderedListOutlined /> }, { value: "grid", icon: <MenuOutlined /> }] as any} />
                {failedCount > 0 && <Button size="small" type="link" danger icon={<ReloadOutlined />} onClick={retryFailed}>重试</Button>}
                <Button size="small" type="primary" icon={<CloudUploadOutlined />} onClick={startUpload}
                  disabled={uploading || records.every((r) => r.status === "done")} loading={uploading}
                  style={{ borderRadius: 8 }}>{uploading ? "上传中..." : "开始上传"}</Button>
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
            {viewMode === "card" && (
              <Space direction="vertical" style={{ width: "100%" }}>
                {records.map((r) => (
                  <Card key={r.id} size="small" style={{ borderRadius: 12, opacity: r.status === "done" ? 0.85 : 1 }} styles={{ body: { padding: "10px 14px" } }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--ant-color-fill-quaternary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  </Card>
                ))}
              </Space>
            )}
            {viewMode === "list" && (
              <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--ant-color-border-secondary)" }}>
                {records.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", background: "var(--ant-color-bg-container)", borderBottom: i < records.length - 1 ? "1px solid var(--ant-color-border-secondary)" : "none" }}>
                    <Text type="secondary" style={{ fontSize: 11, width: 44, flexShrink: 0 }}>{formatTime(r.createdAt)}</Text>
                    <Text style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.fileName}</Text>
                    <Text type="secondary" style={{ fontSize: 11, width: 52, textAlign: "right", flexShrink: 0 }}>{formatSize(r.fileSize)}</Text>
                    <div style={{ width: 52, flexShrink: 0, display: "flex", justifyContent: "center" }}>{statusTag(r.status, r.error)}</div>
                    {r.status !== "uploading_imagebed" && r.status !== "uploading_server" && (
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => engine.remove(r.id)} />
                    )}
                  </div>
                ))}
              </div>
            )}
            {viewMode === "grid" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                {records.map((r) => (
                  <div key={r.id} style={{ borderRadius: 10, overflow: "hidden", background: "var(--ant-color-bg-container)", border: "1px solid var(--ant-color-border-secondary)" }}>
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
  );
}
