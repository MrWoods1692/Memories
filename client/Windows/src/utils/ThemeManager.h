#pragma once
#include <QString>
#include <QColor>
#include <QMap>
#include <QApplication>

struct ThemeColors {
    QString name;
    // Background
    QString bgGradientStart;
    QString bgGradientEnd;
    // Surfaces
    QString cardBg;
    QString cardBorder;
    QString cardRadius;
    // Text
    QString textPrimary;
    QString textSecondary;
    QString textMuted;
    // Accent
    QString accent;
    QString accentHover;
    QString accentLight;
    QString accentSoft;
    QString accentWarm;
    // Misc
    QString toolbarBg;
    QString menubarBg;
    QString statusBg;
    QString inputBg;
    QString inputBorder;
    QString scrollbarHandle;
    QString dialogBgStart;
    QString dialogBgEnd;
};

class ThemeManager {
public:
    static ThemeManager& instance();

    void setTheme(const QString& name);
    QString currentTheme() const;
    QStringList themeNames() const;
    const ThemeColors& current() const;
    QString buildStylesheet(bool dark = false) const;

    // Built-in font presets
    static QStringList fontPresets();
    static QString fontPresetDisplayName(const QString& key);

private:
    ThemeManager();
    void initThemes();

    QMap<QString, ThemeColors> m_themes;
    QString m_current;
};
