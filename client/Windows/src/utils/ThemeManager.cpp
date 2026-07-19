#include "utils/ThemeManager.h"
#include <QFile>
#include <QTextStream>

ThemeManager& ThemeManager::instance() {
    static ThemeManager inst;
    return inst;
}

ThemeManager::ThemeManager() {
    initThemes();
    m_current = "mint";
}

void ThemeManager::initThemes() {
    // 所有浅色主题共享基调，差异体现在强调色和微妙的色调上
    m_themes["mint"] = {
        "薄荷绿",
        "#f8fafc", "#e8ecf2",      // bg gradient
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",  // card
        "#1e293b", "#475569", "#94a3b8",   // text
        "#1D6E5A", "#165A48", "rgba(29,110,90,0.08)", "#53C49E", "#F59E0B",  // accent
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",  // toolbar/menubar/status
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(148,163,184,0.4)",  // input
        "#fdfcfb", "#edeae5"   // dialog
    };

    m_themes["rose"] = {
        "玫瑰粉",
        "#fef5f7", "#f5e6e8",
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",
        "#2d1b1e", "#5c3b3f", "#b08d91",
        "#C44569", "#a83655", "rgba(196,69,105,0.08)", "#F472B6", "#F97316",
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(176,141,145,0.4)",
        "#fef5f7", "#f0e4e6"
    };

    m_themes["sky"] = {
        "天空蓝",
        "#f0f7ff", "#e3eef8",
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",
        "#0f172a", "#1e3a5f", "#7b93b0",
        "#2563EB", "#1d4ed8", "rgba(37,99,235,0.08)", "#60A5FA", "#F59E0B",
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(123,147,176,0.4)",
        "#f8fafd", "#e8eef8"
    };

    m_themes["lavender"] = {
        "薰衣草紫",
        "#f8f6ff", "#ede9fe",
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",
        "#1e1b4b", "#3b3670", "#9d99c7",
        "#7C3AED", "#6d28d9", "rgba(124,58,237,0.08)", "#A78BFA", "#F43F5E",
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(157,153,199,0.4)",
        "#fdfbff", "#edeaf5"
    };

    m_themes["sunset"] = {
        "日落橙",
        "#fffaf5", "#f5ece4",
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",
        "#2d1a0f", "#5c3a22", "#b09078",
        "#EA580C", "#c2410a", "rgba(234,88,12,0.08)", "#FB923C", "#EAB308",
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(176,144,120,0.4)",
        "#fdfaf7", "#f0e8dd"
    };

    m_themes["ocean"] = {
        "深海蓝",
        "#f2f9fa", "#e4eff2",
        "rgba(255,255,255,0.8)", "rgba(0,0,0,0.05)", "14px",
        "#0f282d", "#1e4d56", "#6b99a2",
        "#0D9488", "#0f766e", "rgba(13,148,136,0.08)", "#2DD4BF", "#F97316",
        "rgba(255,255,255,0.7)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.7)",
        "#ffffff", "rgba(0,0,0,0.08)", "rgba(107,153,162,0.4)",
        "#f8fcfd", "#e4eff2"
    };

    m_themes["dark"] = {
        "深色暗夜",
        "#0a0f1c", "#131a2c",
        "rgba(23,33,54,0.6)", "rgba(255,255,255,0.05)", "14px",
        "#e2e8f0", "#94a3b8", "#64748b",
        "#53C49E", "#1D6E5A", "rgba(83,196,158,0.12)", "#38BDF8", "#F59E0B",
        "rgba(13,20,36,0.8)", "rgba(15,23,42,0.8)", "rgba(13,20,36,0.8)",
        "rgba(15,23,42,0.6)", "rgba(255,255,255,0.08)", "rgba(100,116,139,0.3)",
        "#0a0f1c", "#131a2c"
    };
}

void ThemeManager::setTheme(const QString& name) {
    if (m_themes.contains(name)) {
        m_current = name;
    }
}

QString ThemeManager::currentTheme() const { return m_current; }

QStringList ThemeManager::themeNames() const {
    QStringList names;
    for (auto it = m_themes.begin(); it != m_themes.end(); ++it)
        names.append(it.key());
    return names;
}

const ThemeColors& ThemeManager::current() const {
    static ThemeColors fallback;
    auto it = m_themes.constFind(m_current);
    return it != m_themes.constEnd() ? *it : fallback;
}

QStringList ThemeManager::fontPresets() {
    return {
        "system", "noto", "wenquanyi", "source-han", "pingfang", "inter", "jetbrains"
    };
}

QString ThemeManager::fontPresetDisplayName(const QString& key) {
    if (key == "system") return "系统默认";
    if (key == "noto") return "Noto Sans SC";
    if (key == "wenquanyi") return "WenQuanYi Micro Hei";
    if (key == "source-han") return "Source Han Sans SC";
    if (key == "pingfang") return "PingFang SC";
    if (key == "inter") return "Inter";
    if (key == "jetbrains") return "JetBrains Mono";
    return key;
}

QString ThemeManager::buildStylesheet(bool) const {
    const auto& c = current();
    bool isDark = (m_current == "dark");

    // 根据主题类型确定颜色
    QString textPrimary = c.textPrimary;
    QString textSecondary = c.textSecondary;
    QString textMuted = c.textMuted;
    QString accent = c.accent;
    QString accentHover = c.accentHover;
    QString accentSoft = c.accentLight;
    QString accentSoftBg = c.accentSoft;

    // 对话框使用专门的渐变
    QString bgStart = c.bgGradientStart;
    QString bgEnd = c.bgGradientEnd;

    // 工具栏、菜单栏、状态栏
    QString toolbarBg = c.toolbarBg;
    QString menubarBg = c.menubarBg;
    QString statusBg = c.statusBg;

    // 输入控件的背景与边框
    QString inputBg = c.inputBg;
    QString inputBorder = c.inputBorder;
    QString cardBg = c.cardBg;
    QString cardBorder = c.cardBorder;
    QString scrollbarHandle = c.scrollbarHandle;

    // 对话框背景
    QString dialogStart = c.dialogBgStart;
    QString dialogEnd = c.dialogBgEnd;

    // 按钮 hover/pressed 背景（对深浅主题区分）
    QString btnHoverBg = isDark ? QString("rgba(83,196,158,0.06)") : QString("%1").arg(c.accentSoft);
    QString btnPressedBg = isDark ? QString("rgba(83,196,158,0.12)") : QString("%1").arg(c.accentSoft);
    QString itemHoverBg = isDark ? QString("rgba(255,255,255,0.03)") : QString("rgba(29,110,90,0.03)");
    QString itemSelectedBg = accentSoftBg;
    QString hoverBg = isDark ? QString("rgba(83,196,158,0.06)") : QString("%1").arg(c.accentSoft);

    // 滚动条 hover 颜色
    QString scrollbarHover = isDark ? QString("rgba(148,163,184,0.6)") : textSecondary;

    // 主按钮文字颜色
    // 主按钮文字颜色（应用键：天青蓝）
    QString primaryBtnFg = isDark ? "#0a0f1c" : "#ffffff";
    QString primaryBtnStart = isDark ? QString("#6BB6EF") : QString("#5BA4DA");
    QString primaryBtnEnd = isDark ? QString("#2E73B5") : QString("#2E73B5");
    QString primaryBtnHoverStart = isDark ? QString("#82C8F7") : QString("#6BB3E5");
    QString primaryBtnHoverEnd = isDark ? QString("#3D82C7") : QString("#3D82C7");

    // borderColor & separator
    QString borderColor = isDark ? QString("rgba(255,255,255,0.06)") : QString("rgba(0,0,0,0.06)");
    QString subtleBorder = isDark ? QString("rgba(255,255,255,0.04)") : QString("rgba(0,0,0,0.04)");

    return QString(R"(
/* ==== Global ==== */
* { font-family: "Noto Sans SC", "WenQuanYi Micro Hei", "Sans Serif"; font-size: 13px; color: %1; line-height: 1.6; }
QMainWindow { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 %2, stop:0.4 %3, stop:1 %4); }
QWidget#centralWidget { background: transparent; }

/* ==== Scroll Areas ==== */
QScrollArea { background: transparent; border: none; }
QScrollArea > QWidget > QWidget { background: transparent; }
QScrollBar:vertical { background: transparent; width: 8px; border-radius: 4px; margin: 6px 2px; }
QScrollBar::handle:vertical { background: %5; border-radius: 4px; min-height: 40px; }
QScrollBar::handle:vertical:hover { background: %6; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; border: none; }
QScrollBar:horizontal { background: transparent; height: 8px; border-radius: 4px; margin: 2px 6px; }
QScrollBar::handle:horizontal { background: %5; border-radius: 4px; min-width: 40px; }
QScrollBar::handle:horizontal:hover { background: %6; }
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; border: none; }

/* ==== Menubar ==== */
QMenuBar { background: %7; border-bottom: 1px solid %8; padding: 4px 12px; font-size: 13px; font-weight: 500; }
QMenuBar::item { padding: 6px 14px; margin: 2px 2px; border-radius: 7px; background: transparent; color: %9; }
QMenuBar::item:selected { background: %10; color: %11; }
QMenu { background: %12; border: 1px solid %13; border-radius: 12px; padding: 6px; }
QMenu::item { padding: 9px 32px 9px 16px; margin: 2px 4px; border-radius: 8px; color: %9; }
QMenu::item:selected { background: %10; color: %11; }

/* ==== Toolbar ==== */
QToolBar { background: %14; border-bottom: 1px solid %8; padding: 8px 14px; spacing: 10px; }
QToolBar QToolButton { padding: 8px 16px; margin: 1px; border-radius: 9px; color: %9; font-weight: 600; font-size: 13px; border: 1px solid transparent; background: transparent; }
QToolBar QToolButton:hover { background: %10; color: %11; border-color: %15; }
QToolBar QToolButton:pressed { background: %16; }
QToolBar QToolButton:disabled { color: %17; background: transparent; }

/* ==== Status bar ==== */
QStatusBar { background: %18; border-top: 1px solid %8; padding: 6px 14px; font-size: 12px; color: %17; }
QStatusBar QLabel { color: %17; font-size: 12px; }

/* ==== Buttons ==== */
QPushButton { padding: 9px 20px; border-radius: 9px; font-weight: 600; font-size: 13px; border: 1px solid %13; min-height: 22px; background: %19; color: %20; }
QPushButton:hover { background: %21; border-color: %22; color: %11; }
QPushButton:pressed { background: %16; }
QPushButton:disabled { color: rgba(148,163,184,0.4); background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.08); }

/* Primary button */
QPushButton[accent="true"], QPushButton#primaryBtn, QPushButton[primaryBtn="true"] {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 %23, stop:1 %24);
    color: %25; border: 1px solid %22; border-radius: 9px; padding: 9px 22px; min-height: 22px; font-weight: 700; font-size: 13px;
}
QPushButton[accent="true"]:hover, QPushButton#primaryBtn:hover, QPushButton[primaryBtn="true"]:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 %26, stop:1 %27);
    border-color: %11;
}
QPushButton[accent="true"]:pressed, QPushButton#primaryBtn:pressed, QPushButton[primaryBtn="true"]:pressed { background: %24; border-color: %24; }
QPushButton[accent="true"]:disabled, QPushButton#primaryBtn:disabled, QPushButton[primaryBtn="true"]:disabled {
    background: rgba(148,163,184,0.25); color: rgba(255,255,255,0.65); border-color: rgba(148,163,184,0.15);
}

/* Flat button */
QPushButton[flat="true"] { background: %19; border: 1px solid %13; color: %9; }
QPushButton[flat="true"]:hover { background: %21; border-color: %22; color: %11; }
QPushButton[flat="true"]:pressed { background: %16; }

/* ==== Inputs ==== */
QLineEdit { padding: 10px 14px; border-radius: 9px; border: 1px solid %28; background: %29; color: %1; font-size: 13px; selection-background-color: %10; }
QLineEdit:focus { border-color: %11; }
QLineEdit:readonly { background: rgba(148,163,184,0.06); color: %17; }

QComboBox { padding: 10px 36px 10px 14px; border-radius: 10px; border: 1px solid %28; background: %29; color: %1; font-size: 13px; font-weight: 500; min-width: 120px; }
QComboBox:hover { border-color: %22; background: %30; }
QComboBox:focus { border-color: %11; background: %29; }
QComboBox:disabled { background: rgba(148,163,184,0.06); color: %17; border-color: rgba(148,163,184,0.12); }
QComboBox::drop-down { subcontrol-origin: padding; subcontrol-position: top right; width: 28px; border-left: 1px solid %35; border-top-right-radius: 10px; border-bottom-right-radius: 10px; background: transparent; }
QComboBox::drop-down:hover { background: %21; }
QComboBox::down-arrow { width: 10px; height: 6px; image: url(%36); }
QComboBox QAbstractItemView { background: %12; border: 1px solid %13; border-radius: 12px; padding: 6px; selection-background-color: %10; outline: none; }
QComboBox QAbstractItemView::item { padding: 10px 18px; border-radius: 8px; color: %20; font-weight: 500; }
QComboBox QAbstractItemView::item:selected { background: %10; color: %11; font-weight: 600; }
QComboBox QAbstractItemView::item:hover { background: %21; }

QSpinBox { padding: 10px 14px; border-radius: 9px; border: 1px solid %28; background: %29; color: %1; font-size: 13px; }
QSpinBox:focus { border-color: %11; }

/* ==== Checkbox ==== */
QCheckBox { spacing: 10px; color: %20; font-size: 13px; }
QCheckBox::indicator { width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid %13; background: %29; }
QCheckBox::indicator:checked { background: %11; border-color: %11; }
QCheckBox::indicator:hover { border-color: %22; }

/* ==== GroupBox (cards) ==== */
QGroupBox { background: %30; border: 1px solid %31; border-radius: 14px; margin-top: 22px; padding: 26px 18px 18px 18px; font-weight: 700; font-size: 13px; color: %1; }
QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; padding: 5px 14px; margin-left: 16px; background: %30; border-radius: 8px; border: 1px solid %31; }

/* ==== TabWidget ==== */
QTabWidget::pane { background: %30; border: 1px solid %31; border-radius: 14px; padding: 14px; }
QTabBar::tab { padding: 9px 22px; margin: 3px 4px; border-radius: 9px; background: transparent; color: %17; font-weight: 500; font-size: 13px; }
QTabBar::tab:selected { background: %30; color: %11; font-weight: 700; border: 1px solid %31; border-bottom: none; }
QTabBar::tab:hover:!selected { background: %21; color: %9; }

/* ==== Labels ==== */
QLabel[heading="true"] { font-weight: 700; font-size: 20px; line-height: 1.3; color: %1; }
QLabel[subtitle="true"] { font-size: 12px; color: %17; }
QLabel#appTitle { font-weight: 800; font-size: 32px; line-height: 1.15; color: %1; letter-spacing: -0.5px; }
QLabel[galleryState="true"] { color: %17; font-size: 16px; font-weight: 500; padding: 24px; }
QLabel[galleryMeta="true"] { color: %9; font-size: 12px; font-weight: 600; padding: 0 6px; }

/* ==== Status indicators ==== */
QLabel[statusText="true"] { color: %9; font-size: 12px; }
QLabel[statusPill="checking"] { color: #D97706; background: rgba(245,158,11,0.10); border: 1px solid rgba(245,158,11,0.25); border-radius: 10px; padding: 4px 12px; font-weight: 700; font-size: 12px; }
QLabel[statusPill="ok"] { color: %11; background: %10; border: 1px solid %15; border-radius: 10px; padding: 4px 12px; font-weight: 700; font-size: 12px; }
QLabel[statusPill="error"] { color: #DC2626; background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.2); border-radius: 10px; padding: 4px 12px; font-weight: 700; font-size: 12px; }

/* ==== ListWidget ==== */
QListWidget { background: %30; border: 1px solid %31; border-radius: 12px; padding: 8px; outline: none; color: %20; }
QListWidget::item { padding: 10px 16px; margin: 2px 6px; border-radius: 8px; color: %9; }
QListWidget::item:selected { background: %10; color: %11; }
QListWidget::item:hover:!selected { background: %21; }

/* ==== TextEdit ==== */
QTextEdit { background: %30; border: 1px solid %31; border-radius: 12px; padding: 12px 16px; color: %9; font-size: 13px; line-height: 1.5; selection-background-color: %10; }

/* ==== ProgressBar ==== */
QProgressBar { border-radius: 7px; height: 14px; border: none; background: rgba(148,163,184,0.08); text-align: center; font-size: 10px; color: transparent; }
QProgressBar::chunk { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 %32, stop:1 %11); border-radius: 7px; }

/* ==== Dialog ==== */
QDialog { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 %33, stop:1 %34); border: 1px solid %13; border-radius: 16px; }

/* ==== Gallery thumbnails ==== */
QToolButton[galleryThumb="true"] { border-radius: 12px; border: 2px solid transparent; background: %30; padding: 4px; }
QToolButton[galleryThumb="true"]:hover { border-color: %15; background: %21; }
QToolButton[galleryThumb="true"]:pressed { border-color: %22; }
QToolButton[galleryThumb="true"][selected="true"] { background: %10; border: 3px solid %11; }

/* ==== Tooltip ==== */
QToolTip { background: %12; color: %1; border: 1px solid %13; border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 500; }

/* ==== Frame/Splitter ==== */
QFrame { border: 1px solid %35; border-radius: 8px; }
QSplitter { background: transparent; }
QSplitter::handle { background: %35; width: 4px; }
QSplitter::handle:hover { background: %13; }
)"
    ).arg(
        textPrimary,         // 1
        bgStart,              // 2 - QMainWindow bg start
        isDark ? "#0f172a" : "#f1f5f9",  // 3 - mid stop
        bgEnd,                // 4 - QMainWindow bg end
        scrollbarHandle,      // 5 - scrollbar bg
        scrollbarHover,       // 6 - scrollbar hover
        menubarBg,            // 7 - menubar bg
        subtleBorder,         // 8 - subtle border
        textSecondary,        // 9 - secondary text
        accentSoftBg,         // 10 - accent soft bg (used for selection/hover)
        accent,               // 11 - accent color
        isDark ? "rgba(23,33,54,0.98)" : "rgba(255,255,255,0.95)",  // 12 - menu bg
        borderColor,          // 13 - border color
        toolbarBg,            // 14 - toolbar bg
        isDark ? "rgba(83,196,158,0.15)" : "rgba(29,110,90,0.12)",  // 15 - accent border
        btnPressedBg,         // 16 - pressed bg
        textMuted,            // 17 - muted text
        statusBg,             // 18 - status bar bg
        isDark ? "rgba(30,41,59,0.6)" : "#ffffff",  // 19 - default btn bg
        isDark ? "#cbd5e1" : "#334155",  // 20 - default btn text
        hoverBg,              // 21 - hover bg
        isDark ? "rgba(83,196,158,0.25)" : "rgba(29,110,90,0.2)",  // 22 - hover border
        primaryBtnStart,      // 23 - primary btn gradient start
        primaryBtnEnd,        // 24 - primary btn gradient end
        primaryBtnFg,         // 25 - primary btn text
        primaryBtnHoverStart, // 26 - primary btn hover start
        primaryBtnHoverEnd,   // 27 - primary btn hover end
        inputBorder,          // 28 - input border
        inputBg,              // 29 - input bg
        cardBg,               // 30 - card bg
        cardBorder,           // 31 - card border
        isDark ? "#1D6E5A" : "#53C49E",  // 32 - progress chunk start
        dialogStart,          // 33 - dialog bg start
        dialogEnd,            // 34 - dialog bg end
        subtleBorder,         // 35 - frame border
        isDark ? ":/icons/down-arrow-dark.svg" : ":/icons/down-arrow.svg"  // 36 - combo arrow
    );
}