package com.mrcwoods.memories;

import android.content.SharedPreferences;
import android.graphics.Color;

public class ThemeConfig {
    public boolean darkMode;
    public int primaryButton;
    public int secondaryButton;
    public int background;
    public int primaryText;
    public int secondaryText;
    public float fontScale;
    public String fontFamily;
    public String presetName;

    private static String key(String base, String qq) {
        return qq == null || qq.isEmpty() ? base : base + "_" + qq;
    }

    public static ThemeConfig load(SharedPreferences prefs, String qq) {
        ThemeConfig theme = new ThemeConfig();
        theme.darkMode = prefs.getBoolean(key("theme_dark", qq), false);
        boolean darkForDefaults = theme.darkMode || (qq != null && !qq.isEmpty() && prefs.getBoolean("theme_dark_" + qq, false));
        theme.primaryButton = prefs.getInt(key("theme_primary_button", qq), darkForDefaults ? AppConfig.DARK_PRIMARY_BUTTON : AppConfig.LIGHT_PRIMARY_BUTTON);
        theme.secondaryButton = prefs.getInt(key("theme_secondary_button", qq), darkForDefaults ? AppConfig.DARK_SECONDARY_BUTTON : AppConfig.LIGHT_SECONDARY_BUTTON);
        theme.background = prefs.getInt(key("theme_background", qq), darkForDefaults ? AppConfig.DARK_BACKGROUND : AppConfig.LIGHT_BACKGROUND);
        theme.primaryText = prefs.getInt(key("theme_primary_text", qq), darkForDefaults ? AppConfig.DARK_PRIMARY_TEXT : AppConfig.LIGHT_PRIMARY_TEXT);
        theme.secondaryText = prefs.getInt(key("theme_secondary_text", qq), darkForDefaults ? AppConfig.DARK_SECONDARY_TEXT : AppConfig.LIGHT_SECONDARY_TEXT);
        theme.fontScale = prefs.getFloat(key("theme_font_scale", qq), 1.0f);
        theme.fontFamily = prefs.getString(key("theme_font_family", qq), "sans-serif");
        if ("sans".equals(theme.fontFamily)) {
            theme.fontFamily = "sans-serif";
        }
        theme.presetName = prefs.getString(key("theme_preset_name", qq), "default");
        return theme;
    }

    public void save(SharedPreferences prefs, String qq) {
        prefs.edit()
                .putBoolean(key("theme_dark", qq), darkMode)
                .putInt(key("theme_primary_button", qq), primaryButton)
                .putInt(key("theme_secondary_button", qq), secondaryButton)
                .putInt(key("theme_background", qq), background)
                .putInt(key("theme_primary_text", qq), primaryText)
                .putInt(key("theme_secondary_text", qq), secondaryText)
                .putFloat(key("theme_font_scale", qq), fontScale)
                .putString(key("theme_font_family", qq), fontFamily)
                .putString(key("theme_preset_name", qq), presetName)
                .apply();
    }

    public void applyPreset(boolean dark) {
        darkMode = dark;
        primaryButton = dark ? AppConfig.DARK_PRIMARY_BUTTON : AppConfig.LIGHT_PRIMARY_BUTTON;
        secondaryButton = dark ? AppConfig.DARK_SECONDARY_BUTTON : AppConfig.LIGHT_SECONDARY_BUTTON;
        background = dark ? AppConfig.DARK_BACKGROUND : AppConfig.LIGHT_BACKGROUND;
        primaryText = dark ? AppConfig.DARK_PRIMARY_TEXT : AppConfig.LIGHT_PRIMARY_TEXT;
        secondaryText = dark ? AppConfig.DARK_SECONDARY_TEXT : AppConfig.LIGHT_SECONDARY_TEXT;
        presetName = "default";
    }

    public static int parseColorOrDefault(String value, int fallback) {
        try {
            return Color.parseColor(value.trim());
        } catch (Exception ignored) {
            return fallback;
        }
    }
}