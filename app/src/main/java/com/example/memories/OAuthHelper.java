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

    // 存储进行中的授权状态 (state -> {code_verifier, redirect_uri})
    private static final Map<String, OAuthState> pendingStates = new HashMap<>();

    static class OAuthState {
        String codeVerifier;
        String redirectUri;
        String frontendRedirect;  // OAuth 完成后重定向回前端的 URL
        long createdAt;
    }

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
     * 构建授权 URL，存储 state 对应的 verifier
     * @param frontendRedirect 可选：OAuth 完成后重定向到前端的 URL
     */
    public static String buildAuthUrl(String prefix, String clientId, String redirectUri, String scope, String frontendRedirect) {
        String state = generateState();
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        // 存储 state 对应信息
        OAuthState oaState = new OAuthState();
        oaState.codeVerifier = codeVerifier;
        oaState.redirectUri = redirectUri;
        oaState.frontendRedirect = frontendRedirect;
        oaState.createdAt = System.currentTimeMillis();
        pendingStates.put(state, oaState);

        // 清理过期 state (超过10分钟)
        cleanExpiredStates();

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
     * 用授权码换取 access token
     */
    public static JSONObject exchangeToken(String prefix, String clientId, String clientSecret,
                                           String code, String redirectUri, String state) {
        try {
            // 获取 code_verifier
            OAuthState oaState = pendingStates.remove(state);
            String codeVerifier = (oaState != null) ? oaState.codeVerifier : "";

            String tokenUrl = "https://" + prefix + ".campux.top/oauth/token";
            URL url = new URL(tokenUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

            // client_secret_basic: Authorization header
            String credentials = clientId + ":" + clientSecret;
            String basicAuth = Base64.encodeToString(credentials.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            conn.setRequestProperty("Authorization", "Basic " + basicAuth);

            // 构建表单
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
                Log.e(TAG, "Token exchange failed: HTTP " + responseCode + " body: " + errBody);
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

    private static void cleanExpiredStates() {
        long now = System.currentTimeMillis();
        pendingStates.entrySet().removeIf(e -> (now - e.getValue().createdAt) > 600_000); // 10 min
    }

    /**
     * 获取 OAuth 完成后重定向到前端的 URL（如果有的话），不删除 state
     */
    public static String getFrontendRedirect(String state) {
        OAuthState oaState = pendingStates.get(state);
        if (oaState != null) {
            return oaState.frontendRedirect;
        }
        return null;
    }
}