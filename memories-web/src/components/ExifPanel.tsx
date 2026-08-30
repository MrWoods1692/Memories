import { useEffect, useState } from "react";
import { Descriptions, Spin, Tag, Typography } from "antd";
import { parseExifFromUrl, formatExposureTime, formatFNumber, formatFocalLength, formatGps, type ExifInfo } from "@/lib/exif";

const { Text } = Typography;

interface ExifPanelProps {
  /** 图片完整 URL（无 data 时前端解析该 URL 的 EXIF） */
  url?: string;
  /** 服务端存储的 EXIF JSON 字符串（上传时提取入库，优先于 URL 解析，图床转码后也不丢失） */
  data?: string;
  /** 主题色（用于 label 背景） */
  accentColor: string;
  /** 桌面端：2 列；移动端：1 列 */
  isDesktop: boolean;
}

/**
 * EXIF 信息展示面板：
 * - 有 data（服务端记录的 EXIF JSON）时直接渲染，不依赖图床是否保留 EXIF；
 * - 无 data 时前端解析 JPEG URL 作为兜底。
 */
export default function ExifPanel({ url, data, accentColor, isDesktop }: ExifPanelProps) {
  const [loading, setLoading] = useState(!data);
  const [exif, setExif] = useState<ExifInfo | null>(() => parseStoredExif(data));
  const [error, setError] = useState<string | null>(null);

  // data/url 变化（如切换图片）时同步重建
  useEffect(() => {
    const stored = parseStoredExif(data);
    if (stored) {
      setExif(stored);
      setLoading(false);
      setError(null);
      return;
    }
    if (!url) { setExif(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setExif(null);
    setError(null);
    parseExifFromUrl(url)
      .then((info) => { if (!cancelled) setExif(info); })
      .catch(() => { if (!cancelled) setError("解析失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, data]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 16 }}><Spin size="small" /></div>;
  }

  if (!exif) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0", color: "#999", fontSize: 12 }}>
        {error ?? "该图片无 EXIF 信息（可能为非 JPEG 或已被剥离）"}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginTop: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Tag color="purple" style={{ borderRadius: 8 }}>EXIF</Tag>
        <span style={{ fontSize: 12, color: "#999" }}>拍摄信息（上传时记录）</span>
      </div>
      <ExifDescriptions exif={exif} accentColor={accentColor} isDesktop={isDesktop} />
    </>
  );
}

/** 把服务端存储的 EXIF JSON 字符串解析为 ExifInfo，失败返回 null */
function parseStoredExif(data?: string): ExifInfo | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    return (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) ? parsed as unknown as ExifInfo : null;
  } catch {
    return null;
  }
}

/** EXIF 明细渲染（无解析态，供已解析对象直接使用） */
export function ExifDescriptions({ exif, accentColor, isDesktop }: { exif: ExifInfo; accentColor: string; isDesktop: boolean }) {
  const items: { label: string; value: React.ReactNode; span?: number }[] = [];

  const push = (label: string, value: React.ReactNode, span?: number) => {
    if (value !== undefined && value !== null && value !== "") items.push({ label, value, span });
  };

  push("相机", [exif.make, exif.model].filter(Boolean).join(" "), 2);
  push("镜头", exif.lensModel, 2);
  push("拍摄时间", exif.dateTimeOriginal);
  push("光圈", formatFNumber(exif.fNumber));
  push("快门", formatExposureTime(exif.exposureTime));
  push("ISO", exif.iso != null ? `ISO ${exif.iso}` : undefined);
  push("焦距", formatFocalLength(exif.focalLength, exif.focalLengthIn35mm));
  push("曝光补偿", exif.exposureBias != null ? `${exif.exposureBias > 0 ? "+" : ""}${exif.exposureBias} EV` : undefined);
  push("曝光程序", exif.exposureProgram);
  push("测光模式", exif.meteringMode);
  push("白平衡", exif.whiteBalance);
  push("闪光灯", exif.flash);
  push("方向", exif.orientation != null ? `${exif.orientation}` : undefined);
  push("尺寸", exif.exifImageWidth && exif.exifImageHeight ? `${exif.exifImageWidth} × ${exif.exifImageHeight}` : undefined);
  push("软件", exif.software, 2);
  push("作者", exif.artist, 2);
  push("版权", exif.copyright, 2);
  if (exif.gpsLatitude != null && exif.gpsLongitude != null) {
    const gps = formatGps(exif.gpsLatitude, exif.gpsLongitude);
    const mapUrl = `https://maps.google.com/?q=${exif.gpsLatitude},${exif.gpsLongitude}`;
    push("GPS 坐标", <Text copyable style={{ fontSize: 12 }}>{gps}</Text>);
    push("GPS 位置", <a href={mapUrl} target="_blank" rel="noreferrer" style={{ color: accentColor }}>在地图中查看 ↗</a>);
    if (exif.gpsAltitude != null) push("GPS 海拔", `${exif.gpsAltitude} m`);
  }

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0", color: "#999", fontSize: 12 }}>
        该图片无可用 EXIF 信息
      </div>
    );
  }

  return (
    <Descriptions
      column={isDesktop ? 2 : 1}
      size="small"
      bordered
      styles={{ label: { fontWeight: 600, whiteSpace: "nowrap", background: `${accentColor}10`, color: accentColor } }}
    >
      {items.map((it, idx) => (
        <Descriptions.Item key={idx} label={it.label} span={it.span ?? 1}>
          {it.value}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

