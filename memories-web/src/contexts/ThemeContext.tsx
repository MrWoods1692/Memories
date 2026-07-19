import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ThemeConfig } from "antd";

/* ==================== 字体列表 ==================== */

const FONT_CDN = "/fonts";

export interface FontOption {
  id: string;
  name: string;
  file: string;
  family: string;
}

export const fontOptions: FontOption[] = [
  { id: "system", name: "系统默认", file: "", family: "" },
  { id: "cascadia", name: "Cascadia Next 简体", file: "cascadianextjianti.ttf", family: "Cascadia Next SC" },
  { id: "chengming", name: "澄明手写体", file: "chengmingshouxieti.ttf", family: "ChengMingShouXieTi" },
  { id: "hanchanby", name: "寒蝉半圆体", file: "hanchanbanyuanti.ttf", family: "HanChanBanYuanTi" },
  { id: "hanchanhk", name: "寒蝉火楷体", file: "hanchanhuokaiti.otf", family: "HanChanHuoKaiTi" },
  { id: "hongmeng", name: "鸿蒙 Sans SC", file: "hongmengsansscmediumziti.ttf", family: "HarmonyOS Sans SC" },
  { id: "linhai", name: "临海隶书", file: "linhailishu.ttf", family: "LinHaiLiShu" },
  { id: "lipinhui", name: "礼品惠自由落体", file: "lipinhuiziyouluoti.ttf", family: "LiPinHuiZiYouLuoTi" },
  { id: "namidian", name: "纳米点宋", file: "namidiansong.ttf", family: "NaMiDianSong" },
  { id: "siyuan", name: "思源圆体", file: "siyuanyuanti.ttf", family: "SiYuanYuanTi" },
  { id: "yishan", name: "宜山碑篆体", file: "yishanbeizhuanti.ttf", family: "YiShanBeiZhuanTi" },
  { id: "zhouzi", name: "周子宋体", file: "zhouzisongti.otf", family: "ZhouZiSongTi" },
];

/* ==================== 5 套预设主题 ==================== */

export interface ThemePreset {
  id: string;
  name: string;
  desc: string;
  colors: string[];
  config: ThemeConfig;
  /** 暗色模式专属 token 覆盖（背景/文字/边框等） */
  darkToken?: Record<string, string>;
}

export const themePresets: ThemePreset[] = [
  {
    id: "moss",
    name: "苔光晨雾",
    desc: "墨绿与晨雾，自然宁静",
    colors: ["#1D6E5A", "#53C49E", "#E9C46A"],
    config: {
      token: {
        colorPrimary: "#1D6E5A",
        colorSuccess: "#53C49E",
        colorWarning: "#E9C46A",
        colorBgLayout: "#F8F7F2",
        colorTextBase: "#2C3E3A",
        colorBorderSecondary: "#E8EDEB",
      },
    },
    darkToken: {
      colorBgLayout: "#141A18",
      colorTextBase: "#E8F0EC",
      colorBorderSecondary: "#2A3A34",
    },
  },
  {
    id: "mono",
    name: "简约黑白",
    desc: "极简主义，纯粹克制",
    colors: ["#1A1A1A", "#595959", "#BFBFBF"],
    config: {
      token: {
        colorPrimary: "#1A1A1A",
        colorSuccess: "#525252",
        colorWarning: "#8C8C8C",
        colorBgLayout: "#FAFAFA",
        colorTextBase: "#1A1A1A",
        colorBorderSecondary: "#E5E5E5",
      },
    },
    darkToken: {
      colorBgLayout: "#0E0E0E",
      colorTextBase: "#EDEDED",
      colorBorderSecondary: "#262626",
    },
  },
  {
    id: "sunset",
    name: "霞橙晴空",
    desc: "落日余晖，温暖明亮",
    colors: ["#E76F51", "#F4A261", "#E9C46A"],
    config: {
      token: {
        colorPrimary: "#E76F51",
        colorSuccess: "#2A9D8F",
        colorWarning: "#E9C46A",
        colorBgLayout: "#FFF8F3",
        colorTextBase: "#3D2C2A",
        colorBorderSecondary: "#F0E0D6",
      },
    },
    darkToken: {
      colorBgLayout: "#1A1410",
      colorTextBase: "#F5E8DF",
      colorBorderSecondary: "#3A2A22",
    },
  },
  {
    id: "ocean",
    name: "青蓝玻璃",
    desc: "深海玻璃，清澈通透",
    colors: ["#2A9D8F", "#264653", "#A8DADC"],
    config: {
      token: {
        colorPrimary: "#2A9D8F",
        colorSuccess: "#52B788",
        colorWarning: "#E9C46A",
        colorBgLayout: "#F0F8FA",
        colorTextBase: "#1D3557",
        colorBorderSecondary: "#D4ECF0",
      },
    },
    darkToken: {
      colorBgLayout: "#0E1A1E",
      colorTextBase: "#D8ECF0",
      colorBorderSecondary: "#1E3438",
    },
  },
  {
    id: "neon",
    name: "夜航霓光",
    desc: "赛博霓虹，未来感十足",
    colors: ["#F15BB5", "#9B5DE5", "#00BBF9"],
    config: {
      token: {
        colorPrimary: "#9B5DE5",
        colorSuccess: "#00BBF9",
        colorWarning: "#FEE440",
        colorBgLayout: "#FDF6FD",
        colorTextBase: "#2D1B33",
        colorBorderSecondary: "#F0E0F0",
      },
    },
    darkToken: {
      colorBgLayout: "#120E1A",
      colorTextBase: "#E8DEF5",
      colorBorderSecondary: "#2A2238",
    },
  },
  {
    id: "rose",
    name: "玫瑰金箔",
    desc: "玫瑰金调，优雅奢华",
    colors: ["#C9A96E", "#E8B4B8", "#A85751"],
    config: {
      token: {
        colorPrimary: "#A85751",
        colorSuccess: "#C9A96E",
        colorWarning: "#E8B4B8",
        colorBgLayout: "#FBF6F0",
        colorTextBase: "#3A2A26",
        colorBorderSecondary: "#EDE0D4",
      },
    },
    darkToken: {
      colorBgLayout: "#1A1410",
      colorTextBase: "#F0E4D6",
      colorBorderSecondary: "#3A2E22",
    },
  },
  {
    id: "forest",
    name: "深林秘境",
    desc: "墨绿深邃，沉稳大气",
    colors: ["#2D5016", "#73A942", "#B5C99A"],
    config: {
      token: {
        colorPrimary: "#2D5016",
        colorSuccess: "#73A942",
        colorWarning: "#E9C46A",
        colorBgLayout: "#F5F7F0",
        colorTextBase: "#1F2E14",
        colorBorderSecondary: "#DDE5D0",
      },
    },
    darkToken: {
      colorBgLayout: "#0E1408",
      colorTextBase: "#DCE8D0",
      colorBorderSecondary: "#1E2A14",
    },
  },
  {
    id: "lavender",
    name: "薰衣草梦",
    desc: "紫调柔光，梦幻治愈",
    colors: ["#7B5EA7", "#B5A8D8", "#E6E1F0"],
    config: {
      token: {
        colorPrimary: "#7B5EA7",
        colorSuccess: "#9B7EBD",
        colorWarning: "#E9C46A",
        colorBgLayout: "#F7F4FB",
        colorTextBase: "#2D2440",
        colorBorderSecondary: "#E4DCEF",
      },
    },
    darkToken: {
      colorBgLayout: "#14101E",
      colorTextBase: "#E4DEF0",
      colorBorderSecondary: "#2A2238",
    },
  },
];

/* ==================== 颜色工具 ==================== */

/** 将 hex 颜色按百分比调亮（0=不变，1=纯白） */
function lightenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent));
  const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(255 * percent));
  const b = Math.min(255, (num & 0x0000ff) + Math.round(255 * percent));
  // 返回 hex 格式，便于后续追加 alpha 通道（如 `${accentColor}14`）
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ==================== 主题上下文 ==================== */

interface ThemeContextType {
  preset: ThemePreset;
  setPreset: (p: ThemePreset) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  font: FontOption;
  setFont: (f: FontOption) => void;
  isDark: boolean;
  toggleDark: () => void;
  resetTheme: () => void;
  antdTheme: ThemeConfig;
  /** 主题强调色（暗色下已调亮，适合文字/图标） */
  accentColor: string;
  /** 字体资源加载状态：idle | loading | done | error */
  fontLoadStatus: "idle" | "loading" | "done" | "error";
  /** 字体资源加载进度 0-100 */
  fontLoadProgress: number;
  /** 当前正在加载的字体 id */
  fontLoadingId: string | null;
}

const ThemeContext = createContext<ThemeContextType>({
  preset: themePresets[0],
  setPreset: () => {},
  fontSize: 14,
  setFontSize: () => {},
  font: fontOptions[0],
  setFont: () => {},
  isDark: false,
  toggleDark: () => {},
  resetTheme: () => {},
  antdTheme: {},
  accentColor: "#1D6E5A",
  fontLoadStatus: "idle",
  fontLoadProgress: 0,
  fontLoadingId: null,
});

const STORAGE_KEY = "memories_theme";
const FONT_KEY = "memories_font_size";
const FONT_FAMILY_KEY = "memories_font_family";
const DARK_KEY = "memories_dark";

function loadPreset(): ThemePreset {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return themePresets.find((p) => p.id === id) || themePresets[0];
  } catch {
    return themePresets[0];
  }
}

function loadFontSize(): number {
  try {
    return parseInt(localStorage.getItem(FONT_KEY) || "14", 10) || 14;
  } catch {
    return 14;
  }
}

function loadDark(): boolean {
  try {
    const stored = localStorage.getItem(DARK_KEY);
    if (stored !== null) return stored === "true";
  } catch { /* ignore */ }
  // 无手动设置时，根据时间自动判断：21:00 - 06:30 暗色
  return isNightTime();
}

/** 判断当前是否在夜间时段（21:00 - 06:30） */
function isNightTime(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const total = hours * 60 + minutes;
  // 21:00 (1260) 到次日 06:30 (390)
  return total >= 1260 || total < 390;
}

function loadFont(): FontOption {
  try {
    const id = localStorage.getItem(FONT_FAMILY_KEY);
    return fontOptions.find((f) => f.id === id) || fontOptions[3];
  } catch {
    return fontOptions[3];
  }
}

/** 注入 @font-face 声明（不负责加载） */
function injectFontFace(f: FontOption) {
  const styleId = "memories-custom-font";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!f.file) {
    if (styleEl) styleEl.remove();
    return;
  }

  const fontUrl = `${FONT_CDN}/${f.file}`;
  const css = `
    @font-face {
      font-family: "${f.family}";
      src: url("${fontUrl}") format("truetype");
      font-display: swap;
    }
  `;

  if (styleEl) {
    styleEl.textContent = css;
  } else {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
}

/** 已加载过的字体 id 集合，避免重复下载 */
const loadedFonts = new Set<string>();

/**
 * 加载字体文件并追踪下载进度。
 * - 使用 fetch + ReadableStream 获取真实下载进度
 * - 加载完成后通过 FontFace API 注册并应用到文档
 * - 失败时回退到 CSS @font-face（浏览器原生加载）
 */
async function loadFontFile(
  f: FontOption,
  onProgress: (p: number) => void,
): Promise<void> {
  if (!f.file) return;
  if (loadedFonts.has(f.id)) {
    onProgress(100);
    return;
  }

  const fontUrl = `${FONT_CDN}/${f.file}`;
  onProgress(0);

  try {
    const resp = await fetch(fontUrl, { cache: "force-cache" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const total = Number(resp.headers.get("Content-Length")) || 0;
    if (!resp.body || !total) {
      // 无法获取进度（如跨域无 Content-Length），直接读取 blob
      const buf = await resp.arrayBuffer();
      await registerFontFace(f, buf);
      loadedFonts.add(f.id);
      onProgress(100);
      return;
    }

    const reader = resp.body.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }

    const blob = new Blob(chunks as BlobPart[]);
    const buf = await blob.arrayBuffer();
    await registerFontFace(f, buf);
    loadedFonts.add(f.id);
    onProgress(100);
  } catch (err) {
    // 失败回退：注入 @font-face 让浏览器自行加载
    injectFontFace(f);
    throw err;
  }
}

/** 用 FontFace API 注册字体并应用到文档 */
async function registerFontFace(f: FontOption, buf: ArrayBuffer) {
  try {
    // @ts-ignore - FontFace 在现代浏览器可用
    const face = new FontFace(f.family, buf);
    await face.load();
    // @ts-ignore
    (document as any).fonts.add(face);
  } catch {
    // FontFace API 失败时回退到 @font-face 注入
    injectFontFace(f);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>(loadPreset);
  const [fontSize, setFontSizeState] = useState(loadFontSize);
  const [font, setFontState] = useState<FontOption>(loadFont);
  const [isDark, setIsDarkState] = useState(loadDark);
  const [fontLoadStatus, setFontLoadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fontLoadProgress, setFontLoadProgress] = useState(0);
  const [fontLoadingId, setFontLoadingId] = useState<string | null>(null);

  const setPreset = useCallback((p: ThemePreset) => {
    setPresetState(p);
    localStorage.setItem(STORAGE_KEY, p.id);
  }, []);

  const setFontSize = useCallback((n: number) => {
    setFontSizeState(n);
    localStorage.setItem(FONT_KEY, String(n));
  }, []);

  const setFont = useCallback((f: FontOption) => {
    setFontState(f);
    localStorage.setItem(FONT_FAMILY_KEY, f.id);

    // 系统默认字体无需加载
    if (!f.file) {
      injectFontFace(f);
      setFontLoadStatus("idle");
      setFontLoadProgress(0);
      setFontLoadingId(null);
      return;
    }

    // 已加载过的字体（缓存命中）不显示进度条
    if (loadedFonts.has(f.id)) {
      injectFontFace(f);
      setFontLoadStatus("idle");
      setFontLoadProgress(0);
      setFontLoadingId(null);
      return;
    }

    setFontLoadStatus("loading");
    setFontLoadProgress(0);
    setFontLoadingId(f.id);

    loadFontFile(f, (p) => setFontLoadProgress(p))
      .then(() => {
        setFontLoadStatus("done");
        setFontLoadingId(null);
        // 加载完成后短暂保留进度条，再淡出
        setTimeout(() => {
          setFontLoadProgress(0);
          setFontLoadStatus("idle");
        }, 1200);
      })
      .catch(() => {
        setFontLoadStatus("error");
        setFontLoadingId(null);
        setTimeout(() => {
          setFontLoadProgress(0);
          setFontLoadStatus("idle");
        }, 2500);
      });
  }, []);

  const toggleDark = useCallback(() => {
    setIsDarkState((prev) => {
      const next = !prev;
      localStorage.setItem(DARK_KEY, String(next));
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setPresetState(themePresets[0]);
    localStorage.setItem(STORAGE_KEY, themePresets[0].id);
    setFontSizeState(14);
    localStorage.setItem(FONT_KEY, "14");
    setFontState(fontOptions[0]);
    localStorage.setItem(FONT_FAMILY_KEY, fontOptions[0].id);
    injectFontFace(fontOptions[0]);
    setFontLoadStatus("idle");
    setFontLoadProgress(0);
    setFontLoadingId(null);
    localStorage.removeItem(DARK_KEY);
    setIsDarkState(isNightTime());
  }, []);

  // 夜间自动暗色模式：每分钟检查一次
  useEffect(() => {
    const check = () => {
      const stored = localStorage.getItem(DARK_KEY);
      // 只有无手动设置时才自动切换
      if (stored === null) {
        setIsDarkState(isNightTime());
      }
    };
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // 初始化时加载字体
  useEffect(() => {
    if (!font.file) return;
    // 已缓存字体不显示进度条
    if (loadedFonts.has(font.id)) {
      injectFontFace(font);
      setFontLoadStatus("idle");
      setFontLoadProgress(0);
      return;
    }
    setFontLoadStatus("loading");
    setFontLoadProgress(0);
    setFontLoadingId(font.id);
    loadFontFile(font, (p) => setFontLoadProgress(p))
      .then(() => {
        setFontLoadStatus("done");
        setFontLoadingId(null);
        setTimeout(() => {
          setFontLoadProgress(0);
          setFontLoadStatus("idle");
        }, 1200);
      })
      .catch(() => {
        setFontLoadStatus("error");
        setFontLoadingId(null);
        setTimeout(() => {
          setFontLoadProgress(0);
          setFontLoadStatus("idle");
        }, 2500);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 暗色模式同步 body class
  useEffect(() => {
    if (isDark) {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [isDark]);

  // 构建字体 family 字符串
  const fontFamily = font.family
    ? `"${font.family}", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif`
    : `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif`;

  // 合并 preset 配置与基础 antd 配置
  // 暗色模式下保留主题色，并应用专属的背景/文字/边框覆盖
  const presetToken = preset.config.token || {};
  const darkToken = preset.darkToken || {};
  const tokenOverrides = isDark
    ? {
        colorPrimary: presetToken.colorPrimary,
        colorSuccess: presetToken.colorSuccess,
        colorWarning: presetToken.colorWarning,
        ...darkToken,
      }
    : presetToken;

  // 计算暗色模式下调亮后的强调色
  const rawPrimary = presetToken.colorPrimary || "#1D6E5A";
  const accentColor = isDark ? lightenHex(rawPrimary, 0.45) : rawPrimary;

  const antdTheme: ThemeConfig = {
    token: {
      ...tokenOverrides,
      borderRadius: 10,
      fontSize,
      fontFamily,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)",
      boxShadowSecondary: "0 4px 20px rgba(0,0,0,0.06)",
    },
    components: {
      Button: {
        borderRadius: 10,
        borderRadiusLG: 14,
        controlHeightLG: 48,
      },
      Card: {
        borderRadiusLG: 14,
        paddingLG: 20,
      },
      Tag: { borderRadiusSM: 8 },
      Menu: {
        horizontalItemSelectedColor: presetToken.colorPrimary,
        itemHoverColor: presetToken.colorPrimary,
      },
      Progress: {
        defaultColor: presetToken.colorPrimary,
      },
    },
  };

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  return (
    <ThemeContext.Provider
      value={{
        preset, setPreset, fontSize, setFontSize, font, setFont,
        isDark, toggleDark, resetTheme, antdTheme, accentColor,
        fontLoadStatus, fontLoadProgress, fontLoadingId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
