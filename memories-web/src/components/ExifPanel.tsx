import { useEffect, useState } from "react";
import { Descriptions, Spin, Tag, Typography } from "antd";
import { parseExifFromUrl, formatExposureTime, formatFNumber, formatFocalLength, formatGps, type ExifInfo } from "@/lib/exif";

const { Text } = Typography;

interface ExifPanelProps {
  /** 图片完整 URL */
  url: string;
  /** 主题色（用于 label 背景） */
  accentColor: string;
  /** 桌面端：2 列；移动端：1 列 */
  isDesktop: boolean;
}

/**
 * EXIF 信息展示面板：纯前端解析 JPEG EXIF，无 EXIF 或非 JPEG 时显示提示。
 */
export default function ExifPanel({ url, accentColor, isDesktop }: ExifPanelProps) {
  const [loading, setLoading] = useState(true);
  const [exif, setExif] = useState<ExifInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExif(null);
    setError(null);
    parseExifFromUrl(url)
      .then((info) => { if (!cancelled) setExif(info); })
      .catch(() => { if (!cancelled) setError("解析失败"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

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
    <>
      <div style={{ marginTop: 12, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <Tag color="purple" style={{ borderRadius: 8 }}>EXIF</Tag>
        <span style={{ fontSize: 12, color: "#999" }}>拍摄信息（前端解析）</span>
      </div>
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
    </>
  );
}
