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
  colors: string[];
  config: ThemeConfig;
}

export const themePresets: ThemePreset[] = [
  {
    id: "moss",
    name: "苔光晨雾",
    colors: ["#1D6E5A", "#53C49E", "#EDE9E0"],
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
  },
  {
    id: "mono",
    name: "简约黑白",
    colors: ["#1A1A1A", "#FFFFFF", "#666666"],
    config: {
      token: {
        colorPrimary: "#1A1A1A",
        colorSuccess: "#555555",
        colorWarning: "#888888",
        colorBgLayout: "#FAFAFA",
        colorTextBase: "#1A1A1A",
        colorBorderSecondary: "#E5E5E5",
      },
    },
  },
  {
    id: "sunset",
    name: "霞橙晴空",
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
  },
  {
    id: "ocean",
    name: "青蓝玻璃",
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
  },
  {
    id: "neon",
    name: "夜航霓光",
    colors: ["#6A0572", "#AB83A1", "#F15BB5"],
    config: {
      token: {
        colorPrimary: "#6A0572",
        colorSuccess: "#2D6A4F",
        colorWarning: "#F4A261",
        colorBgLayout: "#FDF6FD",
        colorTextBase: "#2D1B33",
        colorBorderSecondary: "#F0E0F0",
      },
    },
  },
];

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
  antdTheme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType>({
  preset: themePresets[0],
  setPreset: () => {},
  fontSize: 14,
  setFontSize: () => {},
  font: fontOptions[3],
  setFont: () => {},
  isDark: false,
  toggleDark: () => {},
  antdTheme: {},
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
    return localStorage.getItem(DARK_KEY) === "true";
  } catch {
    return false;
  }
}

function loadFont(): FontOption {
  try {
    const id = localStorage.getItem(FONT_FAMILY_KEY);
    return fontOptions.find((f) => f.id === id) || fontOptions[3];
  } catch {
    return fontOptions[3];
  }
}

/** 加载并应用自定义字体 */
function applyFont(f: FontOption) {
  const styleId = "memories-custom-font";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!f.file) {
    // 系统默认 — 移除自定义字体
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>(loadPreset);
  const [fontSize, setFontSizeState] = useState(loadFontSize);
  const [font, setFontState] = useState<FontOption>(loadFont);
  const [isDark, setIsDarkState] = useState(loadDark);

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
    applyFont(f);
  }, []);

  const toggleDark = useCallback(() => {
    setIsDarkState((prev) => {
      const next = !prev;
      localStorage.setItem(DARK_KEY, String(next));
      return next;
    });
  }, []);

  // 初始化时加载字体
  useEffect(() => {
    applyFont(font);
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
  // 暗色模式下只保留主题色，背景/文字/边框等交给 darkAlgorithm
  const presetToken = preset.config.token || {};
  const tokenOverrides = isDark
    ? {
        colorPrimary: presetToken.colorPrimary,
        colorSuccess: presetToken.colorSuccess,
        colorWarning: presetToken.colorWarning,
      }
    : presetToken;

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
      value={{ preset, setPreset, fontSize, setFontSize, font, setFont, isDark, toggleDark, antdTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
