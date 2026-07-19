/**
 * 纯前端 EXIF 解析（零依赖）
 * 仅支持 JPEG 中的 EXIF（APP1 段），WebP/PNG/GIF 不含 EXIF。
 * 通过 fetch 获取图片字节并解析，避免重复下载（浏览器缓存命中）。
 */

export interface ExifInfo {
  /** 拍摄时间（原始） */
  dateTimeOriginal?: string;
  /** 数字化时间 */
  dateTimeDigitized?: string;
  /** 相机制造商 */
  make?: string;
  /** 相机型号 */
  model?: string;
  /** 镜头型号 */
  lensModel?: string;
  /** 光圈值（f 数） */
  fNumber?: number;
  /** 曝光时间（秒），如 1/200 = 0.005 */
  exposureTime?: number;
  /** ISO 感光度 */
  iso?: number;
  /** 焦距（mm） */
  focalLength?: number;
  /** 焦距（35mm 等效） */
  focalLengthIn35mm?: number;
  /** 曝光补偿（EV） */
  exposureBias?: number;
  /** 测光模式 */
  meteringMode?: string;
  /** 曝光程序 */
  exposureProgram?: string;
  /** 白平衡 */
  whiteBalance?: string;
  /** 闪光灯是否触发 */
  flash?: string;
  /** 方向（度），用于纠正旋转 */
  orientation?: number;
  /** GPS 纬度（十进制度） */
  gpsLatitude?: number;
  /** GPS 经度（十进制度） */
  gpsLongitude?: number;
  /** GPS 海拔（米） */
  gpsAltitude?: number;
  /** 软件名 */
  software?: string;
  /** 作者 */
  artist?: string;
  /** 版权 */
  copyright?: string;
  /** 图片宽度（EXIF 记录） */
  exifImageWidth?: number;
  /** 图片高度（EXIF 记录） */
  exifImageHeight?: number;
}

/** 解析失败/无 EXIF 时返回 null */
export async function parseExifFromUrl(url: string): Promise<ExifInfo | null> {
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return parseExif(new DataView(buf));
  } catch {
    return null;
  }
}

/* ==================== 内部解析实现 ==================== */

const TAGS: Record<number, keyof ExifInfo> = {
  0x010f: "make",
  0x0110: "model",
  0x0131: "software",
  0x013b: "artist",
  0x8298: "copyright",
  0x0112: "orientation",
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8822: "exposureProgram",
  0x8827: "iso",
  0x8830: "meteringMode",
  0x9003: "dateTimeOriginal",
  0x9004: "dateTimeDigitized",
  0x9205: "exposureBias",
  0x920a: "focalLength",
  0xa002: "exifImageWidth",
  0xa003: "exifImageHeight",
  0xa215: "focalLengthIn35mm",
  0xa434: "lensModel",
  0xa401: "whiteBalance",
  0xa403: "flash",
};

const EXPOSURE_PROGRAMS: Record<number, string> = {
  0: "未定义", 1: "手动", 2: "正常程序", 3: "光圈优先", 4: "快门优先",
  5: "创作程序", 6: "动作程序", 7: "人像模式", 8: "风景模式",
};

const METERING_MODES: Record<number, string> = {
  0: "未知", 1: "平均测光", 2: "中央重点", 3: "点测光", 4: "多点测光",
  5: "多区域测光", 6: "局部测光", 255: "其他",
};

const WHITE_BALANCE: Record<number, string> = { 0: "自动", 1: "手动" };

function readTagValue(view: DataView, tiffOffset: number, type: number, count: number, valueOffset: number, little: boolean): unknown {
  switch (type) {
    case 1: // BYTE
      if (count <= 4) return view.getUint8(valueOffset);
      return Array.from({ length: count }, (_, i) => view.getUint8(valueOffset + i));
    case 2: { // ASCII
      const len = count <= 4 ? count : count;
      const off = count <= 4 ? tiffOffset + 8 : valueOffset;
      let s = "";
      for (let i = 0; i < len - 1; i++) s += String.fromCharCode(view.getUint8(off + i));
      return s;
    }
    case 3: // SHORT
      if (count <= 2) return view.getUint16(valueOffset, little);
      return Array.from({ length: count }, (_, i) => view.getUint16(valueOffset + i * 2, little));
    case 4: // LONG
      if (count <= 1) return view.getUint32(valueOffset, little);
      return Array.from({ length: count }, (_, i) => view.getUint32(valueOffset + i * 4, little));
    case 5: { // RATIONAL (num/den)
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        const num = view.getUint32(valueOffset + i * 8, little);
        const den = view.getUint32(valueOffset + i * 8 + 4, little);
        arr.push(den === 0 ? 0 : num / den);
      }
      return count === 1 ? arr[0] : arr;
    }
    case 7: { // UNDEFINED
      const off = count <= 4 ? tiffOffset + 8 : valueOffset;
      return Array.from({ length: count }, (_, i) => view.getUint8(off + i));
    }
    case 9: // SLONG
      return view.getInt32(valueOffset, little);
    case 10: { // SRATIONAL
      const arr: number[] = [];
      for (let i = 0; i < count; i++) {
        const num = view.getInt32(valueOffset + i * 8, little);
        const den = view.getInt32(valueOffset + i * 8 + 4, little);
        arr.push(den === 0 ? 0 : num / den);
      }
      return count === 1 ? arr[0] : arr;
    }
    default:
      return null;
  }
}

function parseRationalArray(value: unknown): number[] | null {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "number") return [value];
  return null;
}

function gpsToDecimal(values: number[], ref: string | undefined): number | undefined {
  if (!values || values.length < 3) return undefined;
  const d = values[0] + values[1] / 60 + values[2] / 3600;
  const sign = ref === "S" || ref === "W" ? -1 : 1;
  return +(d * sign).toFixed(6);
}

function readGps(view: DataView, gpsOffset: number, little: boolean): Partial<ExifInfo> {
  const result: Partial<ExifInfo> = {};
  const entries = view.getUint16(gpsOffset, little);
  let latRef: string | undefined, latArr: number[] | undefined;
  let lonRef: string | undefined, lonArr: number[] | undefined;

  for (let i = 0; i < entries; i++) {
    const off = gpsOffset + 2 + i * 12;
    const tag = view.getUint16(off, little);
    const type = view.getUint16(off + 2, little);
    const count = view.getUint32(off + 4, little);
    const valueOffset = view.getUint32(off + 8, little) + gpsOffset;
    const value = readTagValue(view, gpsOffset, type, count, valueOffset, little);

    switch (tag) {
      case 1: latRef = typeof value === "string" ? value.charAt(0) : undefined; break;
      case 2: latArr = parseRationalArray(value) ?? undefined; break;
      case 3: lonRef = typeof value === "string" ? value.charAt(0) : undefined; break;
      case 4: lonArr = parseRationalArray(value) ?? undefined; break;
      case 6: {
        const arr = parseRationalArray(value);
        if (arr) result.gpsAltitude = +arr[0].toFixed(2);
        break;
      }
    }
  }
  if (latArr) result.gpsLatitude = gpsToDecimal(latArr, latRef);
  if (lonArr) result.gpsLongitude = gpsToDecimal(lonArr, lonRef);
  return result;
}

function readIfd(view: DataView, ifdOffset: number, little: boolean, tiffOffset: number, out: ExifInfo): void {
  const entries = view.getUint16(ifdOffset, little);
  for (let i = 0; i < entries; i++) {
    const off = ifdOffset + 2 + i * 12;
    const tag = view.getUint16(off, little);
    const type = view.getUint16(off + 2, little);
    const count = view.getUint32(off + 4, little);
    const valueOffset = view.getUint32(off + 8, little) + tiffOffset;
    const value = readTagValue(view, tiffOffset, type, count, valueOffset, little);
    const key = TAGS[tag];
    if (!key) continue;

    switch (key) {
      case "exposureProgram":
        out.exposureProgram = typeof value === "number" ? EXPOSURE_PROGRAMS[value] : undefined;
        break;
      case "meteringMode":
        out.meteringMode = typeof value === "number" ? METERING_MODES[value] : undefined;
        break;
      case "whiteBalance":
        out.whiteBalance = typeof value === "number" ? WHITE_BALANCE[value] : undefined;
        break;
      case "flash":
        out.flash = typeof value === "number" ? (value & 1 ? "已触发" : "未触发") : undefined;
        break;
      default:
        if (typeof value === "string") (out[key] as unknown as string) = value.trim();
        else if (typeof value === "number") (out[key] as unknown as number) = value;
        break;
    }
  }
}

export function parseExif(view: DataView): ExifInfo | null {
  // JPEG SOI
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    // APP1
    if (marker === 0xe1) {
      const segLen = view.getUint16(offset + 2);
      // EXIF header: "Exif\0\0"
      const exifId = view.getUint32(offset + 4);
      if (exifId !== 0x45786966) return null; // "Exif"
      const tiffOffset = offset + 10;
      const endian = view.getUint16(tiffOffset);
      const little = endian === 0x4949;
      if (view.getUint16(tiffOffset + 2) !== 0x002a) return null;

      const ifd0Offset = view.getUint32(tiffOffset + 4, little) + tiffOffset;
      const info: ExifInfo = {};
      readIfd(view, ifd0Offset, little, tiffOffset, info);

      // IFD0 中可能有 ExifOffset 指向 Exif IFD
      const ifd0Entries = view.getUint16(ifd0Offset, little);
      for (let i = 0; i < ifd0Entries; i++) {
        const off = ifd0Offset + 2 + i * 12;
        const tag = view.getUint16(off, little);
        if (tag === 0x8769) {
          // ExifOffset
          const exifIfdOffset = view.getUint32(off + 8, little) + tiffOffset;
          readIfd(view, exifIfdOffset, little, tiffOffset, info);
          break;
        }
      }
      // GPSInfoOffset
      for (let i = 0; i < ifd0Entries; i++) {
        const off = ifd0Offset + 2 + i * 12;
        const tag = view.getUint16(off, little);
        if (tag === 0x8825) {
          const gpsOffset = view.getUint32(off + 8, little) + tiffOffset;
          Object.assign(info, readGps(view, gpsOffset, little));
          break;
        }
      }
      return info;
    }
    // 跳过其他 marker
    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

/** 格式化曝光时间，如 1/200s 或 1.3s */
export function formatExposureTime(v?: number): string {
  if (v == null) return "-";
  if (v >= 1) return `${v}s`;
  const denom = Math.round(1 / v);
  return `1/${denom}s`;
}

/** 格式化光圈，如 f/2.8 */
export function formatFNumber(v?: number): string {
  if (v == null) return "-";
  return `f/${Number.isInteger(v) ? v : v.toFixed(1)}`;
}

/** 格式化焦距 */
export function formatFocalLength(v?: number, v35?: number): string {
  if (v == null) return "-";
  let s = `${v}mm`;
  if (v35 != null && v35 !== v) s += ` (35mm 等效 ${v35}mm)`;
  return s;
}

/** 格式化 GPS 坐标 */
export function formatGps(lat?: number, lon?: number): string {
  if (lat == null || lon == null) return "-";
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
