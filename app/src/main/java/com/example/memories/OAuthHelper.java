package com.example.memories;

import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

/**
 * Campux OAuth 校园墙登录辅助类
 * 实现 PKCE S256 授权码流程
 */
public class OAuthHelper {
    private static final String TAG = "OAuthHelper";
    private static final String STATE_PREFIX = "oauth_state_";

    /**
     * 生成 PKCE code_verifier (43-128 字符随机串)
     */
    public static String generateCodeVerifier() {
        SecureRandom sr = new SecureRandom();
        byte[] bytes = new byte[64];
        sr.nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    /**
     * 计算 PKCE code_challenge = BASE64URL(SHA256(code_verifier))
     */
    public static String generateCodeChallenge(String codeVerifier) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e(TAG, "SHA256 error", e);
            return null;
        }
    }

    /**
     * 生成随机 state 防 CSRF
     */
    public static String generateState() {
        SecureRandom sr = new SecureRandom();
        byte[] bytes = new byte[16];
        sr.nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP);
    }

    /**
     * 构建授权 URL，state 和 code_verifier 存入数据库（防进程重启丢失）
     * @param frontendRedirect 可选：OAuth 完成后重定向到前端的 URL
     */
    public static String buildAuthUrl(String prefix, String clientId, String redirectUri, String scope, String frontendRedirect, DatabaseHelper db) {
        String state = generateState();
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);
        String safeRedirect = sanitizeRedirectUrl(frontendRedirect);

        // 存入数据库：code_verifier, redirect_uri, frontend_redirect
        try {
            JSONObject st = new JSONObject();
            st.put("code_verifier", codeVerifier);
            st.put("redirect_uri", redirectUri);
            if (safeRedirect != null) st.put("frontend_redirect", safeRedirect);
            st.put("created_at", System.currentTimeMillis());
            db.setConfig(STATE_PREFIX + state, st.toString());
            // 清理过期 state (超过10分钟)
            cleanExpiredStates(db);
        } catch (Exception e) {
            Log.e(TAG, "Failed to store oauth state", e);
        }

        String baseUrl = "https://" + prefix + ".campux.top/oauth/authorize";
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append("?response_type=code");
        sb.append("&client_id=").append(urlEncode(clientId));
        sb.append("&redirect_uri=").append(urlEncode(redirectUri));
        if (scope != null && !scope.isEmpty()) {
            sb.append("&scope=").append(urlEncode(scope));
        }
        sb.append("&state=").append(urlEncode(state));
        sb.append("&code_challenge=").append(urlEncode(codeChallenge));
        sb.append("&code_challenge_method=S256");

        return sb.toString();
    }

    /**
     * 用授权码换取 access token。
     * 注意：state 仅在 token 交换成功后删除，失败时保留以便重试，
     * 避免并发回调或代理重试导致 code_verifier 丢失。
     */
    public static JSONObject exchangeToken(String prefix, String clientId, String clientSecret,
                                           String code, String redirectUri, String state, DatabaseHelper db) {
        try {
            // 从数据库获取 code_verifier（不提前删除，防止并发/重试时丢失）
            String stateJson = db.getConfig(STATE_PREFIX + state);
            String codeVerifier = "";
            if (stateJson != null) {
                try {
                    JSONObject st = new JSONObject(stateJson);
                    codeVerifier = st.optString("code_verifier", "");
                } catch (Exception ignored) {}
            }

            if (codeVerifier.isEmpty()) {
                Log.e(TAG, "code_verifier is empty for state=" + state + ", stateJson exists=" + (stateJson != null)
                    + (stateJson != null ? ", stateJson=" + stateJson : ""));
                JSONObject err = new JSONObject();
                err.put("error", "missing_code_verifier");
                err.put("detail", "PKCE code_verifier not found for state " + state + ". Please try logging in again.");
                return err;
            }

            String tokenUrl = "https://" + prefix + ".campux.top/oauth/token";
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setRequestProperty("Accept", "application/json");

            // client_secret_basic: 凭据放 Authorization header
            String credentials = clientId + ":" + clientSecret;
            String basicAuth = Base64.encodeToString(credentials.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            conn.setRequestProperty("Authorization", "Basic " + basicAuth);

            // 构建表单 - 不含 client_id/client_secret
            StringBuilder body = new StringBuilder();
            body.append("grant_type=authorization_code");
            body.append("&code=").append(urlEncode(code));
            body.append("&redirect_uri=").append(urlEncode(redirectUri));
            body.append("&code_verifier=").append(urlEncode(codeVerifier));

            byte[] bodyBytes = body.toString().getBytes(StandardCharsets.UTF_8);
            OutputStream os = conn.getOutputStream();
            os.write(bodyBytes);
            os.close();

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                // 仅在成功后才删除 state，防止并发回调或代理重试导致第二次请求丢失 code_verifier
                db.setConfig(STATE_PREFIX + state, null);
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder resp = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) resp.append(line);
                br.close();
                return new JSONObject(resp.toString());
            } else {
                // 读取 Campux 返回的错误详情
                String errBody = "";
                try {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();
                    errBody = sb.toString();
                } catch (Exception ignored) {}
                Log.e(TAG, "Token exchange failed: HTTP " + responseCode + " body: " + errBody + " state=" + state);
                JSONObject err = new JSONObject();
                err.put("error", "token_exchange_failed");
                err.put("http_status", responseCode);
                err.put("detail", errBody);
                return err;
            }
        } catch (Exception e) {
            Log.e(TAG, "Token exchange error", e);
            return null;
        }
    }

    /**
     * 用 access token 获取用户信息
     */
    public static JSONObject getUserInfo(String prefix, String accessToken) {
        try {
            String userInfoUrl = "https://" + prefix + ".campux.top/oauth/userinfo";
            URL url = new URL(userInfoUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder resp = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) resp.append(line);
                br.close();
                return new JSONObject(resp.toString());
            } else {
                Log.e(TAG, "UserInfo failed: " + responseCode);
                return null;
            }
        } catch (Exception e) {
            Log.e(TAG, "UserInfo error", e);
            return null;
        }
    }

    /**
     * 刷新 access token
     */
    public static JSONObject refreshToken(String prefix, String clientId, String clientSecret, String refreshToken) {
        try {
            String tokenUrl = "https://" + prefix + ".campux.top/oauth/token";
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            conn.setRequestProperty("Accept", "application/json");

            String credentials = clientId + ":" + clientSecret;
            String basicAuth = Base64.encodeToString(credentials.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            conn.setRequestProperty("Authorization", "Basic " + basicAuth);

            StringBuilder body = new StringBuilder();
            body.append("grant_type=refresh_token");
            body.append("&refresh_token=").append(urlEncode(refreshToken));

            byte[] bodyBytes = body.toString().getBytes(StandardCharsets.UTF_8);
            OutputStream os = conn.getOutputStream();
            os.write(bodyBytes);
            os.close();

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder resp = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) resp.append(line);
                br.close();
                return new JSONObject(resp.toString());
            } else {
                Log.e(TAG, "Refresh failed: " + responseCode);
                return null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Refresh error", e);
            return null;
        }
    }

    private static String urlEncode(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    private static String sanitizeRedirectUrl(String redirectUrl) {
        if (redirectUrl == null || redirectUrl.trim().isEmpty()) return null;
        String value = redirectUrl.trim();

        // 允许相对路径
        if (value.startsWith("/")) {
            if (value.startsWith("//")) return null;
            return value;
        }

        // 允许任意合法的绝对 URL
        try {
            java.net.URL url = new java.net.URL(value);
            if (url.getHost() == null) return null;
            return value;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static void cleanExpiredStates(DatabaseHelper db) {
        // 数据库存储无需手动清理，state 用完即删（在 exchangeToken 中删除）
    }

    /**
     * 获取 OAuth 完成后重定向到前端的 URL（如果有的话）
     */
    public static String getFrontendRedirect(String state, DatabaseHelper db) {
        String stateJson = db.getConfig(STATE_PREFIX + state);
        if (stateJson != null) {
            try {
                JSONObject st = new JSONObject(stateJson);
                String fr = st.optString("frontend_redirect", null);
                if (fr != null && !fr.isEmpty()) {
                    return sanitizeRedirectUrl(fr);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }
}