package com.mrcwoods.memories;

import android.content.Context;
import android.graphics.Color;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

public final class AppConfig {
    private static final String CONFIG_FILE = "app-config.properties";
    private static final Properties PROPERTIES = new Properties();

    public static String APP_NAME = "Memories";
    public static String SCHOOL_NAME = "";
    public static String DEVELOPER_NAME = "";
    public static String DEVELOPER_AVATAR_URL = "";
    public static String WEBSITE_URL = "";
    public static String UPDATE_DATE = "2026-07-02";

    public static String MEMORIES_API_BASE = "";
    public static String IMAGE_HOST_API = "";

    public static String OAUTH_ISSUER = "";
    public static String OAUTH_AUTHORIZE_URL = "";
    public static String OAUTH_TOKEN_URL = "";
    public static String OAUTH_USERINFO_URL = "";
    public static String OAUTH_REVOKE_URL = "";
    public static String OAUTH_INTROSPECT_URL = "";
    public static String OAUTH_CLIENT_ID = "";
    public static String OAUTH_CLIENT_SECRET = "";
    public static String OAUTH_REDIRECT_URI = "http://localhost:2580/";
    public static String OAUTH_SCOPE = "profile";
    public static int OAUTH_CALLBACK_PORT = 2580;

    public static String DEFAULT_OUTPUT_FORMAT = "auto";
    public static String DEFAULT_STORAGE_DESTINATION = "telegram";
    public static String DEFAULT_CDN_DOMAIN = "default";
    public static int RATE_LIMIT_WINDOW_MS = 5000;
    public static int RATE_LIMIT_MAX_ITEMS = 5;

    public static int LIGHT_PRIMARY_BUTTON = Color.rgb(29, 110, 90);
    public static int LIGHT_SECONDARY_BUTTON = Color.rgb(230, 240, 236);
    public static int LIGHT_BACKGROUND = Color.rgb(248, 247, 242);
    public static int LIGHT_PRIMARY_TEXT = Color.rgb(25, 31, 28);
    public static int LIGHT_SECONDARY_TEXT = Color.rgb(91, 101, 96);

    public static int DARK_PRIMARY_BUTTON = Color.rgb(83, 196, 158);
    public static int DARK_SECONDARY_BUTTON = Color.rgb(33, 48, 43);
    public static int DARK_BACKGROUND = Color.rgb(14, 18, 17);
    public static int DARK_PRIMARY_TEXT = Color.rgb(238, 244, 240);
    public static int DARK_SECONDARY_TEXT = Color.rgb(169, 181, 174);

    public static void load(Context context) {
        try (InputStream input = context.getAssets().open(CONFIG_FILE)) {
            PROPERTIES.clear();
            PROPERTIES.load(new InputStreamReader(input, StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
        APP_NAME = string("app.name", APP_NAME);
        SCHOOL_NAME = string("app.schoolName", SCHOOL_NAME);
        DEVELOPER_NAME = string("app.developerName", DEVELOPER_NAME);
        DEVELOPER_AVATAR_URL = string("app.developerAvatarUrl", DEVELOPER_AVATAR_URL);
        WEBSITE_URL = string("app.websiteUrl", WEBSITE_URL);
        UPDATE_DATE = string("app.updateDate", UPDATE_DATE);
        MEMORIES_API_BASE = trimTrailingSlash(string("api.memoriesBase", MEMORIES_API_BASE));
        IMAGE_HOST_API = string("api.imageHost", IMAGE_HOST_API);
        OAUTH_ISSUER = trimTrailingSlash(string("oauth.issuer", OAUTH_ISSUER));
        OAUTH_AUTHORIZE_URL = string("oauth.authorizeUrl", OAUTH_AUTHORIZE_URL);
        OAUTH_TOKEN_URL = string("oauth.tokenUrl", OAUTH_TOKEN_URL);
        OAUTH_USERINFO_URL = string("oauth.userInfoUrl", OAUTH_USERINFO_URL);
        OAUTH_REVOKE_URL = string("oauth.revokeUrl", OAUTH_REVOKE_URL);
        OAUTH_INTROSPECT_URL = string("oauth.introspectUrl", OAUTH_INTROSPECT_URL);
        OAUTH_CLIENT_ID = string("oauth.clientId", OAUTH_CLIENT_ID);
        OAUTH_CLIENT_SECRET = string("oauth.clientSecret", OAUTH_CLIENT_SECRET);
        OAUTH_REDIRECT_URI = string("oauth.redirectUri", OAUTH_REDIRECT_URI);
        OAUTH_SCOPE = string("oauth.scope", OAUTH_SCOPE);
        OAUTH_CALLBACK_PORT = integer("oauth.callbackPort", OAUTH_CALLBACK_PORT);
        DEFAULT_OUTPUT_FORMAT = string("upload.defaultOutputFormat", DEFAULT_OUTPUT_FORMAT);
        DEFAULT_STORAGE_DESTINATION = string("upload.storageDestination", DEFAULT_STORAGE_DESTINATION);
        DEFAULT_CDN_DOMAIN = string("upload.cdnDomain", DEFAULT_CDN_DOMAIN);
        RATE_LIMIT_WINDOW_MS = integer("rateLimit.windowMs", RATE_LIMIT_WINDOW_MS);
        RATE_LIMIT_MAX_ITEMS = integer("rateLimit.maxItems", RATE_LIMIT_MAX_ITEMS);
        LIGHT_PRIMARY_BUTTON = color("theme.light.primaryButton", LIGHT_PRIMARY_BUTTON);
        LIGHT_SECONDARY_BUTTON = color("theme.light.secondaryButton", LIGHT_SECONDARY_BUTTON);
        LIGHT_BACKGROUND = color("theme.light.background", LIGHT_BACKGROUND);
        LIGHT_PRIMARY_TEXT = color("theme.light.primaryText", LIGHT_PRIMARY_TEXT);
        LIGHT_SECONDARY_TEXT = color("theme.light.secondaryText", LIGHT_SECONDARY_TEXT);
        DARK_PRIMARY_BUTTON = color("theme.dark.primaryButton", DARK_PRIMARY_BUTTON);
        DARK_SECONDARY_BUTTON = color("theme.dark.secondaryButton", DARK_SECONDARY_BUTTON);
        DARK_BACKGROUND = color("theme.dark.background", DARK_BACKGROUND);
        DARK_PRIMARY_TEXT = color("theme.dark.primaryText", DARK_PRIMARY_TEXT);
        DARK_SECONDARY_TEXT = color("theme.dark.secondaryText", DARK_SECONDARY_TEXT);
    }

    public static boolean isOAuthConfigured() {
        return !OAUTH_AUTHORIZE_URL.trim().isEmpty()
                && !OAUTH_TOKEN_URL.trim().isEmpty()
                && !OAUTH_USERINFO_URL.trim().isEmpty()
                && !OAUTH_CLIENT_ID.trim().isEmpty()
                && !OAUTH_CLIENT_SECRET.trim().isEmpty();
    }

    private static String string(String key, String fallback) {
        return PROPERTIES.getProperty(key, fallback).trim();
    }

    private static int integer(String key, int fallback) {
        try {
            return Integer.parseInt(string(key, String.valueOf(fallback)));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static int color(String key, int fallback) {
        try {
            return Color.parseColor(string(key, String.format("#%06X", 0xFFFFFF & fallback)));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static String trimTrailingSlash(String value) {
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private AppConfig() {
    }
}