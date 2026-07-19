package com.mrcwoods.memories;

import android.content.Context;
import android.net.Uri;
import android.webkit.MimeTypeMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class ApiClient {
    public interface Callback<T> {
        void onSuccess(T value);
        void onError(String message);
    }

    public static class ImagePage {
        public final List<ImageItem> items;
        public final Long nextAfterId;

        public ImagePage(List<ImageItem> items, Long nextAfterId) {
            this.items = items;
            this.nextAfterId = nextAfterId;
        }
    }

    public void health(Callback<Boolean> callback) {
        getString(AppConfig.MEMORIES_API_BASE + "/health", null, new Callback<String>() {
            @Override
            public void onSuccess(String value) {
                callback.onSuccess("OK".equals(value) || value.contains("ok"));
            }

            @Override
            public void onError(String message) {
                callback.onError(message);
            }
        });
    }

    public void oauthStart(Callback<String> callback) {
        getString(AppConfig.MEMORIES_API_BASE + "/oauth/start", null, new Callback<String>() {
            @Override
            public void onSuccess(String body) {
                if (body.isEmpty()) {
                    callback.onError("服务端返回空响应");
                    return;
                }
                if (body.startsWith("<!") || body.startsWith("<html")) {
                    callback.onError("服务端返回 HTML 页面，请检查 API 地址是否正确");
                    return;
                }
                try {
                    JSONObject json = new JSONObject(body);
                    callback.onSuccess(json.optString("url", ""));
                } catch (Exception e) {
                    String preview = body.length() > 50 ? body.substring(0, 50) + "..." : body;
                    callback.onError("JSON 解析失败: " + preview);
                }
            }

            @Override
            public void onError(String message) {
                callback.onError(message);
            }
        });
    }

    public void oauthCallback(String code, String state, Callback<UserSession> callback) {
        getString(AppConfig.MEMORIES_API_BASE + "/oauth/callback?code=" + encode(code) + "&state=" + encode(state), null, new Callback<String>() {
            @Override
            public void onSuccess(String body) {
                if (body.isEmpty()) {
                    callback.onError("服务端返回空响应");
                    return;
                }
                if (body.startsWith("<!") || body.startsWith("<html")) {
                    callback.onError("服务端返回 HTML 页面");
                    return;
                }
                try {
                    JSONObject json = new JSONObject(body);
                    if (json.has("error")) {
                        String error = json.optString("error", "unknown");
                        String description = json.optString("error_description", json.optString("message", ""));
                        callback.onError(error + (description.isEmpty() ? "" : ": " + description));
                        return;
                    }
                    UserSession session = new UserSession();
                    session.accessToken = json.optString("access_token", "");
                    session.refreshToken = json.optString("refresh_token", "");
                    session.sub = json.optString("qq", json.optString("sub", ""));
                    session.qq = json.optString("qq", "");
                    session.username = json.optString("username", session.qq);
                    session.tenantName = json.optString("tenant_name", "");
                    session.role = json.optInt("role", 0);
                    session.isReviewer = json.optBoolean("is_reviewer", false);
                    session.isAdmin = json.optBoolean("is_admin", false);
                    if (session.accessToken.isEmpty()) {
                        callback.onError("未返回访问令牌");
                        return;
                    }
                    callback.onSuccess(session);
                    } catch (Exception e) {
                        String preview = body.length() > 50 ? body.substring(0, 50) + "..." : body;
                        callback.onError("JSON 解析失败: " + preview);
                    }
            }

            @Override
            public void onError(String message) {
                callback.onError(message);
            }
        });
    }

    public void exchangeCode(String code, String codeVerifier, Callback<String> callback) {
        new Thread(() -> {
            try {
                String body = "grant_type=authorization_code"
                        + "&code=" + encode(code)
                        + "&redirect_uri=" + encode(AppConfig.OAUTH_REDIRECT_URI)
                        + "&client_id=" + encode(AppConfig.OAUTH_CLIENT_ID)
                        + "&code_verifier=" + encode(codeVerifier)
                        + "&client_secret=" + encode(AppConfig.OAUTH_CLIENT_SECRET);
                JSONObject json = postForm(AppConfig.OAUTH_TOKEN_URL, body, null);
                String token = json.optString("access_token", "");
                if (token.isEmpty()) {
                    callback.onError(json.optString("error", "未返回访问令牌"));
                    return;
                }
                callback.onSuccess(token);
            } catch (Exception exception) {
                callback.onError(exception.getMessage());
            }
        }).start();
    }

    public void userInfo(String token, Callback<UserSession> callback) {
        getJson(AppConfig.OAUTH_USERINFO_URL, "Bearer " + token, new Callback<JSONObject>() {
            @Override
            public void onSuccess(JSONObject json) {
                UserSession session = new UserSession();
                session.accessToken = token;
                session.sub = json.optString("sub", "");
                session.qq = json.optString("name", "");
                session.username = json.optString("username", session.qq);
                session.tenantName = json.optString("tenant_name", "");
                session.tenantSlug = json.optString("tenant_slug", "");
                callback.onSuccess(session);
            }

            @Override
            public void onError(String message) {
                callback.onError(message);
            }
        });
    }

    public void images(long afterId, Callback<ImagePage> callback) {
        int page = afterId <= 0 ? 1 : (int) afterId;
        getJson(AppConfig.MEMORIES_API_BASE + "/images?page=" + page + "&limit=20", null, new Callback<JSONObject>() {
            @Override
            public void onSuccess(JSONObject json) {
                JSONArray array = json.optJSONArray("items");
                List<ImageItem> items = new ArrayList<>();
                if (array != null) {
                    for (int index = 0; index < array.length(); index++) {
                        JSONObject item = array.optJSONObject(index);
                        if (item != null) {
                            items.add(new ImageItem(
                                    item.optLong("id"),
                                    item.optString("url"),
                                    item.optInt("status", 0),
                                    item.optLong("created_at")
                            ));
                        }
                    }
                }
                int currentPage = json.optInt("page", 1);
                int totalPages = json.optInt("totalPages", 1);
                Long next = currentPage < totalPages ? (long) (currentPage + 1) : null;
                callback.onSuccess(new ImagePage(items, next));
            }

            @Override
            public void onError(String message) {
                callback.onError(message);
            }
        });
    }

    public void createMemoryImage(String url, Callback<ImageItem> callback) {
        new Thread(() -> {
            try {
                String body = "url=" + encode(url);
                JSONObject json = postForm(AppConfig.MEMORIES_API_BASE + "/images", body, null);
                callback.onSuccess(new ImageItem(json.optLong("id"), url, 0, System.currentTimeMillis()));
            } catch (Exception exception) {
                callback.onError(exception.getMessage());
            }
        }).start();
    }

    public void uploadToImageHost(Context context, Uri uri, String outputFormat, Callback<String> callback) {
        new Thread(() -> {
            String boundary = "MemoriesBoundary" + System.currentTimeMillis();
            try {
                HttpURLConnection connection = open(AppConfig.IMAGE_HOST_API, "POST", null);
                connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                connection.setDoOutput(true);
                OutputStream output = connection.getOutputStream();
                writeField(output, boundary, "outputFormat", outputFormat);
                writeField(output, boundary, "storage_destination", AppConfig.DEFAULT_STORAGE_DESTINATION);
                if (!"default".equals(AppConfig.DEFAULT_CDN_DOMAIN)) {
                    writeField(output, boundary, "cdn_domain", AppConfig.DEFAULT_CDN_DOMAIN);
                }
                writeFile(context, output, boundary, uri);
                output.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                output.flush();
                JSONObject json = readResponse(connection);
                if (!json.optBoolean("success", false)) {
                    callback.onError(json.optString("message", "图床上传失败"));
                    return;
                }
                callback.onSuccess(json.optString("url", json.optJSONObject("data") == null ? "" : json.optJSONObject("data").optString("url", "")));
            } catch (Exception exception) {
                callback.onError(exception.getMessage());
            }
        }).start();
    }

    public void queryImageHost(String query, Callback<JSONObject> callback) {
        getJson(AppConfig.IMAGE_HOST_API + "?q=" + encode(query), null, callback);
    }

    private void getJson(String url, String auth, Callback<JSONObject> callback) {
        new Thread(() -> {
            try {
                callback.onSuccess(readResponse(open(url, "GET", auth)));
            } catch (Exception exception) {
                callback.onError(exception.getMessage());
            }
        }).start();
    }

    private void getString(String url, String auth, Callback<String> callback) {
        new Thread(() -> {
            try {
                HttpURLConnection connection = open(url, "GET", auth);
                int status = connection.getResponseCode();
                InputStream input = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
                String body = readString(input);
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException(body.isEmpty() ? "HTTP " + status : body);
                }
                callback.onSuccess(body);
            } catch (Exception exception) {
                callback.onError(exception.getMessage());
            }
        }).start();
    }

    private JSONObject postJson(String url, String body, String auth) throws Exception {
        HttpURLConnection connection = open(url, "POST", auth);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setDoOutput(true);
        connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
        return readResponse(connection);
    }

    private JSONObject postForm(String url, String body, String auth) throws Exception {
        HttpURLConnection connection = open(url, "POST", auth);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
        connection.setDoOutput(true);
        connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
        return readResponse(connection);
    }

    private HttpURLConnection open(String url, String method, String auth) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "application/json");
        if (auth != null) {
            if (auth.startsWith("Bearer ")) {
                connection.setRequestProperty("Authorization", auth);
            } else {
                connection.setRequestProperty("x-user-qq", auth);
            }
        }
        return connection;
    }

    private JSONObject readResponse(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        InputStream input = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String body = readString(input);
        JSONObject json = body.isEmpty() ? new JSONObject() : new JSONObject(body);
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(json.optString("message", "HTTP " + status));
        }
        return json;
    }

    private String readString(InputStream input) throws Exception {
        if (input == null) {
            return "";
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            builder.append(line);
        }
        return builder.toString();
    }

    private void writeField(OutputStream output, String boundary, String name, String value) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write((value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private void writeFile(Context context, OutputStream output, String boundary, Uri uri) throws Exception {
        String mime = context.getContentResolver().getType(uri);
        String extension = mime == null ? "jpg" : MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
        String filename = "memory_upload." + (extension == null ? "jpg" : extension);
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"image\"; filename=\"" + filename + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + (mime == null ? "image/jpeg" : mime) + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        InputStream input = new BufferedInputStream(context.getContentResolver().openInputStream(uri));
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        input.close();
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (Exception ignored) {
            return value;
        }
    }
}