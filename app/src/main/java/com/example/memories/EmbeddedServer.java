package com.example.memories;

import android.content.Context;
import android.util.Log;

import org.nanohttpd.protocols.http.IHTTPSession;
import org.nanohttpd.protocols.http.NanoHTTPD;
import org.nanohttpd.protocols.http.response.Response;
import org.nanohttpd.protocols.http.response.Status;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.Map;

public class EmbeddedServer extends NanoHTTPD {
    private static final String TAG = "EmbeddedServer";
    private final Context context;

    public EmbeddedServer(int port, Context ctx) {
        super(port);
        this.context = ctx.getApplicationContext();
    }

    /**
     * 判断请求是否来自局域网 (10.x, 172.16-31.x, 192.168.x, 127.x)
     */
    private boolean isLanRequest(IHTTPSession session) {
        try {
            String ip = session.getRemoteIpAddress();
            if (ip == null) return false;
            // IPv6 localhost
            if (ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isLoopbackAddress()) return true;
            if (addr.isSiteLocalAddress()) return true;
            if (addr.isLinkLocalAddress()) return true;
            // 额外检查 10.x 和 172.16-31.x (某些 JVM 不视为 site-local)
            byte[] octets = addr.getAddress();
            if (octets.length == 4) {
                int first = octets[0] & 0xFF;
                int second = octets[1] & 0xFF;
                if (first == 10) return true;
                if (first == 172 && second >= 16 && second <= 31) return true;
                if (first == 192 && second == 168) return true;
                if (first == 127) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 检查是否为管理员：局域网请求自动获得管理员权限，否则检查 x-user-qq header
     */
    private boolean isAdmin(IHTTPSession session, DatabaseHelper db) {
        if (isLanRequest(session)) return true;
        String qq = session.getHeaders().get("x-user-qq");
        return db.getUserRole(qq) >= 2;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Log.i(TAG, "Request: " + uri + " method=" + session.getMethod());

        try {
            if ("/health".equals(uri)) {
                return Response.newFixedLengthResponse(Status.OK, "text/plain", "OK");
            }

            if (uri.startsWith("/images")) {
                return handleImages(session);
            }

            if (uri.equals("/backup") && Method.POST.equals(session.getMethod())) {
                return handleBackup(session);
            }

            if (uri.equals("/config")) {
                if (Method.GET.equals(session.getMethod())) return handleGetConfig(session);
                if (Method.POST.equals(session.getMethod())) return handleSetConfig(session);
            }

            if (uri.equals("/status") && Method.GET.equals(session.getMethod())) {
                return handleStatus(session);
            }

            if (uri.startsWith("/bans")) {
                return handleBans(session);
            }

            if (uri.startsWith("/users")) {
                return handleUsers(session);
            }

            if (uri.equals("/webdav/config") && Method.GET.equals(session.getMethod())) {
                return handleWebdavConfig(session);
            }

            if (uri.equals("/platform") && Method.GET.equals(session.getMethod())) {
                return handlePlatform(session);
            }

            if (uri.startsWith("/frpc")) {
                return handleFrpc(session);
            }

            if (uri.startsWith("/oauth")) {
                return handleOauth(session);
            }

            // /admin 管理面板 - 仅局域网可访问
            if (uri.equals("/admin") || uri.equals("/admin/")) {
                return handleAdminPage(session);
            }

            // 管理员专用 API（仅局域网）
            if (uri.startsWith("/admin/api/")) {
                return handleAdminApi(session);
            }

            return Response.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
        } catch (Exception e) {
            Log.e(TAG, "Serve error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "Error");
        }
    }

    /**
     * 管理员专用 API 路由（仅局域网可访问）
     */
    private Response handleAdminApi(IHTTPSession session) {
        if (!isLanRequest(session)) {
            return Response.newFixedLengthResponse(Status.FORBIDDEN, "text/plain", "LAN only");
        }
        String uri = session.getUri();
        // /admin/api/images -> 代理到 /images
        // /admin/api/users -> 代理到 /users 等
        String realUri = uri.replace("/admin/api", "");
        // 通过反射调用实际处理器 - 简单起见，这里直接转发
        try {
            if (realUri.startsWith("/images")) return handleImages(session);
            if (realUri.equals("/backup")) return handleBackup(session);
            if (realUri.equals("/config")) {
                if (Method.GET.equals(session.getMethod())) return handleGetConfig(session);
                if (Method.POST.equals(session.getMethod())) return handleSetConfig(session);
            }
            if (realUri.equals("/status")) return handleStatus(session);
            if (realUri.startsWith("/bans")) return handleBans(session);
            if (realUri.startsWith("/users")) return handleUsers(session);
            if (realUri.equals("/webdav/config")) return handleWebdavConfig(session);
            if (realUri.equals("/platform")) return handlePlatform(session);
            if (realUri.startsWith("/frpc")) return handleFrpc(session);
            if (realUri.startsWith("/oauth")) return handleOauth(session);
        } catch (Exception e) {
            Log.e(TAG, "adminApi error", e);
        }
        return Response.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
    }

    private Response handleImages(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        DatabaseHelper db = new DatabaseHelper(context);

        try {
            if ("/images".equals(uri) && Method.GET.equals(method)) {
                String json = db.listImagesJson();
                return Response.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            if ("/images".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String url = params.get("url");
                if (url == null || url.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing url");
                }
                long id = db.addImage(url);
                return Response.newFixedLengthResponse(Status.OK, "application/json", "{\"id\":"+id+"}");
            }

            // /images/{id}
            String[] parts = uri.split("/");
            if (parts.length >= 3) {
                String idStr = parts[2];
                long id = Long.parseLong(idStr);
                if (Method.DELETE.equals(method)) {
                    if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                    boolean ok = db.deleteImage(id);
                    return Response.newFixedLengthResponse(ok?Status.OK:Status.NOT_FOUND, "text/plain", ok?"deleted":"not found");
                }

                if (parts.length >= 4 && "audit".equals(parts[3]) && Method.POST.equals(method)) {
                    String qq = session.getHeaders().get("x-user-qq");
                    int role = db.getUserRole(qq);
                    if (!isLanRequest(session) && role < 1) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "reviewer required");
                    Map<String, String> files = new java.util.HashMap<>();
                    session.parseBody(files);
                    Map<String, String> params = session.getParms();
                    String statusStr = params.get("status");
                    int status = Integer.parseInt(statusStr == null ? "0" : statusStr);
                    boolean ok = db.updateImageStatus(id, status);
                    return Response.newFixedLengthResponse(ok?Status.OK:Status.NOT_FOUND, "text/plain", ok?"updated":"not found");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "handleImages error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    private Response handleBackup(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            String cfg = db.getConfigJson();
            JSONObject o = new JSONObject(cfg);
            String webdavUrl = o.optString("webdav_url", null);
            String webdavUser = o.optString("webdav_user", null);
            String webdavPass = o.optString("webdav_pass", null);
            if (webdavUrl == null || webdavUrl.isEmpty()) return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "webdav not configured");

            String dbPath = db.getDatabasePathString();
            java.io.File f = new java.io.File(dbPath);
            String remoteName = "memories_backup_"+System.currentTimeMillis()+".db";
            boolean ok = WebDavBackup.uploadFile(webdavUrl, webdavUser, webdavPass, f, remoteName);
            return Response.newFixedLengthResponse(ok?Status.OK:Status.INTERNAL_ERROR, "text/plain", ok?"uploaded":"upload failed");
        } catch (Exception e) {
            Log.e(TAG, "backup error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    private Response handleGetConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String json = db.getConfigJson();
        return Response.newFixedLengthResponse(Status.OK, "application/json", json);
    }

    private Response handleSetConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
        try {
            Map<String,String> files = new java.util.HashMap<>();
            session.parseBody(files);
            Map<String,String> params = session.getParms();
            String k = params.get("k");
            String v = params.get("v");
            if (k==null) return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing k");
            db.setConfig(k, v==null?"":v);
            return Response.newFixedLengthResponse(Status.OK, "text/plain", "ok");
        } catch (Exception e) {
            Log.e(TAG, "setConfig error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    private Response handleStatus(IHTTPSession session) {
        try {
            DatabaseHelper db = new DatabaseHelper(context);
            JSONObject o = new JSONObject();
            o.put("db_path", db.getDatabasePathString());
            o.put("image_count", db.getImageCount());
            o.put("uptime", System.currentTimeMillis());
            return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "status error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    private Response handleUsers(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            // GET /users - list all users
            if ("/users".equals(uri) && Method.GET.equals(method)) {
                String json = db.listUsersJson();
                return Response.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // POST /users - add reviewer (role=1) or admin (role=2)
            if ("/users".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String userQq = params.get("qq");
                String roleStr = params.get("role");
                if (userQq == null || userQq.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing qq");
                }
                int newRole = 1; // default reviewer
                if (roleStr != null) {
                    try { newRole = Integer.parseInt(roleStr); } catch (NumberFormatException ignored) {}
                }
                if (newRole < 1 || newRole > 2) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "role must be 1 (reviewer) or 2 (admin)");
                }
                db.addUser(userQq, newRole);
                return Response.newFixedLengthResponse(Status.OK, "application/json", "{\"qq\":\""+userQq+"\",\"role\":"+newRole+"}");
            }

            // DELETE /users/{qq} - remove a user
            String[] parts = uri.split("/");
            if (parts.length >= 3 && Method.DELETE.equals(method)) {
                String targetQq = parts[2];
                boolean ok = db.deleteUser(targetQq);
                return Response.newFixedLengthResponse(ok ? Status.OK : Status.NOT_FOUND, "text/plain", ok ? "deleted" : "not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "handleUsers error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // --- 封禁用户管理 ---

    private Response handleBans(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            // GET /bans - 列出所有封禁用户
            if ("/bans".equals(uri) && Method.GET.equals(method)) {
                String json = db.listBannedUsersJson();
                return Response.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // POST /bans - 封禁用户 (qq, reason)
            if ("/bans".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String targetQq = params.get("qq");
                String reason = params.get("reason");
                if (targetQq == null || targetQq.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing qq");
                }
                db.banUser(targetQq, reason);
                return Response.newFixedLengthResponse(Status.OK, "application/json", "{\"qq\":\""+targetQq+"\",\"banned\":true}");
            }

            // DELETE /bans/{qq} - 解封用户
            String[] parts = uri.split("/");
            if (parts.length >= 3 && Method.DELETE.equals(method)) {
                String targetQq = parts[2];
                boolean ok = db.unbanUser(targetQq);
                return Response.newFixedLengthResponse(ok ? Status.OK : Status.NOT_FOUND, "text/plain", ok ? "unbanned" : "not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "handleBans error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // --- WebDAV 备份配置获取 ---

    private Response handleWebdavConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        try {
            JSONObject o = new JSONObject();
            o.put("webdav_url", db.getConfig("webdav_url"));
            o.put("webdav_user", db.getConfig("webdav_user"));
            o.put("configured", db.getConfig("webdav_url") != null);
            return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "webdavConfig error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    // --- 平台信息 (logo / 名称) ---

    private Response handlePlatform(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        try {
            JSONObject o = new JSONObject();
            o.put("platform_name", db.getConfig("platform_name"));
            o.put("platform_logo", db.getConfig("platform_logo"));
            return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "platform error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    // --- FRPC 内网穿透管理 ---

    private Response handleFrpc(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        try {
            // GET /frpc/config - 获取 frpc 配置
            if ("/frpc/config".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                o.put("frpc_path", db.getConfig("frpc_path"));
                o.put("frpc_config", db.getConfig("frpc_config"));
                o.put("configured", db.getConfig("frpc_path") != null && db.getConfig("frpc_config") != null);
                return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // POST /frpc/config - 设置 frpc 配置 (管理员)
            if ("/frpc/config".equals(uri) && Method.POST.equals(method)) {
                if (!isAdmin(session, db)) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String path = params.get("frpc_path");
                String config = params.get("frpc_config");
                if (path != null) db.setConfig("frpc_path", path);
                if (config != null) db.setConfig("frpc_config", config);
                return Response.newFixedLengthResponse(Status.OK, "text/plain", "ok");
            }

            // GET /frpc/status - 获取 frpc 运行状态
            if ("/frpc/status".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                // 状态由 ServerService 维护，这里返回配置状态
                o.put("configured", db.getConfig("frpc_path") != null && db.getConfig("frpc_config") != null);
                o.put("frpc_path", db.getConfig("frpc_path"));
                return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "handleFrpc error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    private Response handleOauth(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        try {
            // GET /oauth/config - 获取 OAuth 配置状态
            if ("/oauth/config".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                o.put("configured", db.getConfig("oauth_prefix") != null);
                return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // POST /oauth/config - 管理员配置 OAuth 参数
            if ("/oauth/config".equals(uri) && Method.POST.equals(method)) {
                if (!isAdmin(session, db))
                    return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String prefix = params.get("prefix");
                String clientId = params.get("client_id");
                String clientSecret = params.get("client_secret");
                String redirectUri = params.get("redirect_uri");
                if (prefix != null) db.setConfig("oauth_prefix", prefix);
                if (clientId != null) db.setConfig("oauth_client_id", clientId);
                if (clientSecret != null) db.setConfig("oauth_client_secret", clientSecret);
                if (redirectUri != null) db.setConfig("oauth_redirect_uri", redirectUri);
                return Response.newFixedLengthResponse(Status.OK, "text/plain", "ok");
            }

            // GET /oauth/start - 发起授权，返回跳转 URL
            if ("/oauth/start".equals(uri) && Method.GET.equals(method)) {
                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String redirectUri = db.getConfig("oauth_redirect_uri");
                if (prefix == null || clientId == null || redirectUri == null) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }
                String scope = "profile tenant";
                String authUrl = OAuthHelper.buildAuthUrl(prefix, clientId, redirectUri, scope);
                JSONObject o = new JSONObject();
                o.put("url", authUrl);
                return Response.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // GET /oauth/callback?code=...&state=... - 回调处理
            if ("/oauth/callback".equals(uri) && Method.GET.equals(method)) {
                Map<String, String> params = session.getParms();
                String code = params.get("code");
                String state = params.get("state");
                if (code == null || code.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing code");
                }

                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String clientSecret = db.getConfig("oauth_client_secret");
                String redirectUri = db.getConfig("oauth_redirect_uri");
                if (prefix == null || clientId == null || clientSecret == null || redirectUri == null) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }

                // 换取 token
                JSONObject tokenResp = OAuthHelper.exchangeToken(prefix, clientId, clientSecret, code, redirectUri, state);
                if (tokenResp == null) {
                    return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "token exchange failed");
                }

                String accessToken = tokenResp.optString("access_token");
                String refreshToken = tokenResp.optString("refresh_token");
                if (accessToken == null || accessToken.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "no access_token");
                }

                // 获取用户信息
                JSONObject userInfo = OAuthHelper.getUserInfo(prefix, accessToken);
                if (userInfo == null) {
                    return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "userinfo failed");
                }

                String userQq = userInfo.optString("name"); // QQ 号
                String userName = userInfo.optString("username");
                String tenantName = userInfo.optString("tenant_name");

                // 检查该 QQ 是否在审核员/管理员列表中
                int role = db.getUserRole(userQq);

                JSONObject result = new JSONObject();
                result.put("qq", userQq);
                result.put("username", userName);
                result.put("tenant_name", tenantName);
                result.put("role", role);
                result.put("access_token", accessToken);
                result.put("refresh_token", refreshToken);
                result.put("is_reviewer", role >= 1);
                result.put("is_admin", role >= 2);

                return Response.newFixedLengthResponse(Status.OK, "application/json", result.toString());
            }

            // POST /oauth/refresh - 刷新 token
            if ("/oauth/refresh".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String refreshToken = params.get("refresh_token");
                if (refreshToken == null || refreshToken.isEmpty()) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing refresh_token");
                }
                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String clientSecret = db.getConfig("oauth_client_secret");
                if (prefix == null || clientId == null || clientSecret == null) {
                    return Response.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }
                JSONObject tokenResp = OAuthHelper.refreshToken(prefix, clientId, clientSecret, refreshToken);
                if (tokenResp == null) {
                    return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "refresh failed");
                }
                return Response.newFixedLengthResponse(Status.OK, "application/json", tokenResp.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "handleOauth error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // ==================== 管理面板 HTML ====================

    private Response handleAdminPage(IHTTPSession session) {
        if (!isLanRequest(session)) {
            return Response.newFixedLengthResponse(Status.FORBIDDEN, "text/plain", "仅局域网可访问管理面板");
        }
        String html = getAdminPageHtml();
        return Response.newFixedLengthResponse(Status.OK, "text/html; charset=utf-8", html);
    }

    private String getAdminPageHtml() {
        return "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n" +
"<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n" +
"<title>Memories 管理面板</title>\n<style>\n" +
"*{margin:0;padding:0;box-sizing:border-box}\n" +
"body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f0f;color:#e0e0e0;min-height:100vh}\n" +
".header{background:#1a1a2e;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #2a2a4a}\n" +
".header h1{font-size:20px;color:#7c8aff}\n" +
".header .info{font-size:13px;color:#888}\n" +
".tabs{display:flex;background:#1a1a2e;border-bottom:2px solid #2a2a4a;overflow-x:auto}\n" +
".tab{padding:14px 22px;cursor:pointer;font-size:14px;color:#888;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;transition:all .2s}\n" +
".tab:hover{color:#ccc;background:#22223a}\n" +
".tab.active{color:#7c8aff;border-bottom-color:#7c8aff;background:#1e1e36}\n" +
".content{padding:20px;max-width:1200px;margin:0 auto}\n" +
".panel{display:none}\n.panel.active{display:block}\n" +
".card{background:#1a1a2e;border-radius:10px;padding:20px;margin-bottom:16px;border:1px solid #2a2a4a}\n" +
".card h2{font-size:16px;color:#7c8aff;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #2a2a4a}\n" +
".stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}\n" +
".stat-card{background:linear-gradient(135deg,#1a1a2e,#22224a);padding:18px;border-radius:10px;border:1px solid #2a2a4a;text-align:center}\n" +
".stat-card .num{font-size:32px;font-weight:700;color:#7c8aff}\n" +
".stat-card .label{font-size:12px;color:#888;margin-top:4px}\n" +
"table{width:100%;border-collapse:collapse}\n" +
"th,td{padding:10px 12px;text-align:left;border-bottom:1px solid #2a2a4a;font-size:13px}\n" +
"th{color:#888;font-weight:500;font-size:12px;text-transform:uppercase}\n" +
"tr:hover{background:#22223a}\n" +
"td.url{max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n" +
".badge{padding:3px 8px;border-radius:10px;font-size:11px;font-weight:500}\n" +
".badge-0{background:#333;color:#999}\n.badge-1{background:#1a3a1a;color:#4caf50}\n.badge-2{background:#3a1a1a;color:#f44336}\n" +
".badge-admin{background:#2a1a4a;color:#9c7cfc}\n.badge-reviewer{background:#1a2a4a;color:#5c9cfc}\n" +
"button,.btn{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;transition:all .2s;font-weight:500}\n" +
".btn-primary{background:#5c6aff;color:#fff}\n.btn-primary:hover{background:#7c8aff}\n" +
".btn-danger{background:#d32f2f;color:#fff}\n.btn-danger:hover{background:#e53935}\n" +
".btn-sm{padding:5px 10px;font-size:11px}\n" +
".btn-success{background:#2e7d32;color:#fff}\n.btn-success:hover{background:#388e3c}\n" +
".btn-warn{background:#e65100;color:#fff}\n.btn-warn:hover{background:#f57c00}\n" +
"input,select,textarea{background:#12122a;border:1px solid #2a2a4a;color:#e0e0e0;padding:8px 12px;border-radius:6px;font-size:13px;width:100%;margin-bottom:10px}\n" +
"input:focus,select:focus,textarea:focus{outline:none;border-color:#5c6aff}\n" +
"label{font-size:12px;color:#888;display:block;margin-bottom:4px}\n" +
".form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n" +
"@media(max-width:600px){.form-row{grid-template-columns:1fr}}\n" +
".toast{position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:13px;z-index:999;animation:slideIn .3s ease}\n" +
".toast-success{background:#2e7d32}\n.toast-error{background:#c62828}\n" +
"@keyframes slideIn{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}\n" +
".loading{text-align:center;padding:30px;color:#888}\n" +
".empty{text-align:center;padding:40px;color:#666;font-size:14px}\n" +
".confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000}\n" +
".confirm-box{background:#1a1a2e;border:1px solid #2a2a4a;border-radius:12px;padding:24px;max-width:400px;width:90%}\n" +
".confirm-box h3{color:#e0e0e0;margin-bottom:12px}\n" +
".confirm-box p{color:#888;font-size:13px;margin-bottom:20px}\n" +
".confirm-box .btns{display:flex;gap:10px;justify-content:flex-end}\n" +
".status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}\n" +
".status-dot.on{background:#4caf50;box-shadow:0 0 6px #4caf50}\n" +
".status-dot.off{background:#666}\n" +
"</style>\n</head>\n<body>\n" +
"<div class=\"header\"><h1>📋 Memories 管理面板</h1><div class=\"info\" id=\"headerInfo\">LAN</div></div>\n" +
"<div class=\"tabs\">\n" +
"<div class=\"tab active\" data-tab=\"dashboard\">📊 仪表盘</div>\n" +
"<div class=\"tab\" data-tab=\"images\">🖼️ 图片管理</div>\n" +
"<div class=\"tab\" data-tab=\"users\">👥 用户管理</div>\n" +
"<div class=\"tab\" data-tab=\"bans\">🚫 封禁管理</div>\n" +
"<div class=\"tab\" data-tab=\"settings\">⚙️ 系统设置</div>\n" +
"</div>\n" +
"<div class=\"content\">\n" +
// --- Dashboard ---
"<div id=\"panel-dashboard\" class=\"panel active\">\n" +
"<div class=\"stat-grid\" id=\"stats\"></div>\n" +
"<div class=\"card\"><h2>📋 最近图片</h2><div id=\"recentImages\"><div class=\"loading\">加载中...</div></div></div>\n" +
"<div class=\"card\"><h2>🔧 快捷操作</h2>\n" +
"<button class=\"btn btn-primary\" onclick=\"triggerBackup()\">💾 立即备份到 WebDAV</button>\n" +
"<button class=\"btn btn-warn\" onclick=\"refreshAll()\" style=\"margin-left:10px\">🔄 刷新所有数据</button>\n" +
"</div></div>\n" +
// --- Images ---
"<div id=\"panel-images\" class=\"panel\">\n" +
"<div class=\"card\"><h2>🖼️ 图片列表 <span style=\"font-size:12px;color:#888\" id=\"imgCount\"></span></h2>\n" +
"<div style=\"margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap\">\n" +
"<select id=\"imgFilter\" onchange=\"loadImages()\" style=\"width:auto;margin-bottom:0\">\n" +
"<option value=\"\">全部状态</option><option value=\"0\">待审核</option><option value=\"1\">已通过</option><option value=\"2\">已拒绝</option>\n" +
"</select>\n" +
"<input type=\"text\" id=\"imgSearch\" placeholder=\"搜索URL...\" oninput=\"loadImages()\" style=\"width:200px;margin-bottom:0\">\n" +
"<button class=\"btn btn-primary btn-sm\" onclick=\"loadImages()\">🔍 搜索</button>\n" +
"<button class=\"btn btn-danger btn-sm\" onclick=\"batchDelete()\">🗑️ 批量删除选中</button>\n" +
"</div>\n" +
"<div id=\"imageList\"><div class=\"loading\">加载中...</div></div>\n" +
"</div></div>\n" +
// --- Users ---
"<div id=\"panel-users\" class=\"panel\">\n" +
"<div class=\"card\"><h2>➕ 添加用户</h2>\n" +
"<div class=\"form-row\">\n" +
"<div><label>QQ号</label><input type=\"text\" id=\"newUserQq\" placeholder=\"输入QQ号\"></div>\n" +
"<div><label>角色</label><select id=\"newUserRole\"><option value=\"1\">审核员</option><option value=\"2\">管理员</option></select></div>\n" +
"</div>\n" +
"<button class=\"btn btn-primary\" onclick=\"addUser()\">添加用户</button>\n" +
"</div>\n" +
"<div class=\"card\"><h2>👥 用户列表</h2><div id=\"userList\"><div class=\"loading\">加载中...</div></div></div>\n" +
"</div>\n" +
// --- Bans ---
"<div id=\"panel-bans\" class=\"panel\">\n" +
"<div class=\"card\"><h2>🚫 封禁用户</h2>\n" +
"<div class=\"form-row\">\n" +
"<div><label>QQ号</label><input type=\"text\" id=\"banQq\" placeholder=\"输入QQ号\"></div>\n" +
"<div><label>封禁原因</label><input type=\"text\" id=\"banReason\" placeholder=\"可选\"></div>\n" +
"</div>\n" +
"<button class=\"btn btn-danger\" onclick=\"banUser()\">封禁用户</button>\n" +
"</div>\n" +
"<div class=\"card\"><h2>📋 封禁列表</h2><div id=\"banList\"><div class=\"loading\">加载中...</div></div></div>\n" +
"</div>\n" +
// --- Settings ---
"<div id=\"panel-settings\" class=\"panel\">\n" +
"<div class=\"card\"><h2>🔧 服务器配置</h2>\n" +
"<div class=\"form-row\">\n" +
"<div><label>服务器端口 (重启生效)</label><input type=\"number\" id=\"cfgPort\" placeholder=\"8080\"></div>\n" +
"<div><label>平台名称</label><input type=\"text\" id=\"cfgPlatformName\" placeholder=\"Memories\"></div>\n" +
"</div>\n" +
"<div><label>平台 Logo URL</label><input type=\"text\" id=\"cfgPlatformLogo\" placeholder=\"https://...\"></div>\n" +
"<button class=\"btn btn-primary\" onclick=\"saveServerConfig()\">💾 保存服务器配置</button>\n" +
"</div>\n" +
"<div class=\"card\"><h2>🌐 WebDAV 备份配置</h2>\n" +
"<div><label>WebDAV URL</label><input type=\"text\" id=\"cfgWebdavUrl\" placeholder=\"https://webdav.example.com/backup\"></div>\n" +
"<div class=\"form-row\">\n" +
"<div><label>用户名</label><input type=\"text\" id=\"cfgWebdavUser\"></div>\n" +
"<div><label>密码</label><input type=\"password\" id=\"cfgWebdavPass\"></div>\n" +
"</div>\n" +
"<button class=\"btn btn-primary\" onclick=\"saveWebdavConfig()\">💾 保存 WebDAV 配置</button>\n" +
"<button class=\"btn btn-success\" onclick=\"triggerBackup()\" style=\"margin-left:10px\">📤 测试备份</button>\n" +
"</div>\n" +
"<div class=\"card\"><h2>🔑 OAuth 配置</h2>\n" +
"<div><label>OAuth 前缀 (prefix)</label><input type=\"text\" id=\"cfgOauthPrefix\" placeholder=\"your-campus\"></div>\n" +
"<div class=\"form-row\">\n" +
"<div><label>Client ID</label><input type=\"text\" id=\"cfgOauthClientId\"></div>\n" +
"<div><label>Client Secret</label><input type=\"password\" id=\"cfgOauthClientSecret\"></div>\n" +
"</div>\n" +
"<div><label>Redirect URI</label><input type=\"text\" id=\"cfgOauthRedirectUri\" placeholder=\"https://...\"></div>\n" +
"<button class=\"btn btn-primary\" onclick=\"saveOauthConfig()\">💾 保存 OAuth 配置</button>\n" +
"</div>\n" +
"<div class=\"card\"><h2>🔗 FRPC 内网穿透</h2>\n" +
"<div><label>FRPC 可执行文件路径</label><input type=\"text\" id=\"cfgFrpcPath\" placeholder=\"/data/local/tmp/frpc\"></div>\n" +
"<div><label>FRPC 配置文件内容 (INI格式)</label><textarea id=\"cfgFrpcConfig\" rows=\"6\" placeholder=\"[common]\nserver_addr = ...\nserver_port = ...\ntoken = ...\n\n[web]\ntype = tcp\nlocal_ip = 127.0.0.1\nlocal_port = 8080\nremote_port = 8080\"></textarea></div>\n" +
"<button class=\"btn btn-primary\" onclick=\"saveFrpcConfig()\">💾 保存 FRPC 配置</button>\n" +
"<div id=\"frpcStatus\" style=\"margin-top:12px;font-size:13px;color:#888\"></div>\n" +
"</div>\n" +
"</div>\n" +
"</div>\n" +
"<div id=\"toastContainer\"></div>\n" +
"<div id=\"confirmDialog\"></div>\n" +
"<script>\n" +
"const API='';\n" +
"let allImages=[];\n" +
"let selectedImages=new Set();\n" +
"\n" +
"// Toast\n" +
"function toast(msg,type){type=type||'success';var c=document.getElementById('toastContainer');var d=document.createElement('div');d.className='toast toast-'+type;d.textContent=msg;c.appendChild(d);setTimeout(function(){d.remove()},3000)}\n" +
"\n" +
"// Confirm\n" +
"function confirm(msg,cb){var c=document.getElementById('confirmDialog');c.innerHTML='<div class=\"confirm-overlay\"><div class=\"confirm-box\"><h3>确认操作</h3><p>'+msg+'</p><div class=\"btns\"><button class=\"btn btn-sm\" onclick=\"this.closest(\\'.confirm-overlay\\').remove()\">取消</button><button class=\"btn btn-danger btn-sm\" id=\"confirmBtn\">确认</button></div></div></div>';document.getElementById('confirmBtn').onclick=function(){c.innerHTML='';cb()}}\n" +
"\n" +
"// API calls\n" +
"async function apiGet(path){var r=await fetch(API+path);return r.json()}\n" +
"async function apiPost(path,data){var r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});return r.text()}\n" +
"async function apiDelete(path){var r=await fetch(API+path,{method:'DELETE'});return r.text()}\n" +
"\n" +
"// Tabs\n" +
"document.querySelectorAll('.tab').forEach(function(t){t.onclick=function(){var tab=this.dataset.tab;document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});this.classList.add('active');document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active')});document.getElementById('panel-'+tab).classList.add('active');if(tab==='dashboard')loadDashboard();if(tab==='images')loadImages();if(tab==='users')loadUsers();if(tab==='bans')loadBans();if(tab==='settings')loadSettings()}});\n" +
"\n" +
"// Dashboard\n" +
"async function loadDashboard(){try{var s=await apiGet('/status');var c=await apiGet('/config');var html='<div class=\"stat-card\"><div class=\"num\">'+s.image_count+'</div><div class=\"label\">图片总数</div></div>';html+='<div class=\"stat-card\"><div class=\"num\">'+JSON.parse(c).server_port||'8080'+'</div><div class=\"label\">服务端口</div></div>';html+='<div class=\"stat-card\"><div class=\"num\"><span class=\"status-dot on\"></span></div><div class=\"label\">运行状态</div></div>';document.getElementById('stats').innerHTML=html;var imgs=await apiGet('/images');var recent=Array.isArray(imgs)?imgs.slice(0,10):[];var thtml='<table><tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr>';recent.forEach(function(i){var sb=['待审核','已通过','已拒绝'];thtml+='<tr><td>'+i.id+'</td><td class=\"url\" title=\"'+h(i.url)+'\">'+h(i.url)+'</td><td><span class=\"badge badge-'+i.status+'\">'+sb[i.status]+'</span></td><td>'+fmtTs(i.created_at)+'</td></tr>'});thtml+='</table>';if(recent.length===0)thtml='<div class=\"empty\">暂无图片</div>';document.getElementById('recentImages').innerHTML=thtml}catch(e){console.error(e)}}\n" +
"\n" +
"function h(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;')}\n" +
"function fmtTs(ts){if(!ts)return'';var d=new Date(ts);return d.toLocaleString('zh-CN')}\n" +
"\n" +
"// Images\n" +
"async function loadImages(){try{var filter=document.getElementById('imgFilter').value;var search=document.getElementById('imgSearch').value.toLowerCase();var imgs=await apiGet('/images');allImages=Array.isArray(imgs)?imgs:[];if(filter)allImages=allImages.filter(function(i){return i.status==parseInt(filter)});if(search)allImages=allImages.filter(function(i){return(i.url||'').toLowerCase().includes(search)});document.getElementById('imgCount').textContent='共 '+allImages.length+' 张';var html='<table><tr><th><input type=\"checkbox\" onclick=\"toggleSelectAll(this)\"></th><th>ID</th><th>URL</th><th>状态</th><th>时间</th><th>操作</th></tr>';allImages.forEach(function(i){var sb=['待审核','已通过','已拒绝'];var ck=selectedImages.has(i.id)?' checked':'';html+='<tr><td><input type=\"checkbox\" value=\"'+i.id+'\"'+ck+' onchange=\"toggleSelect('+i.id+')\"></td><td>'+i.id+'</td><td class=\"url\" title=\"'+h(i.url)+'\">'+h(i.url)+'</td><td><span class=\"badge badge-'+i.status+'\">'+sb[i.status]+'</span></td><td>'+fmtTs(i.created_at)+'</td><td><button class=\"btn btn-success btn-sm\" onclick=\"auditImage('+i.id+',1)\">✓</button> <button class=\"btn btn-warn btn-sm\" onclick=\"auditImage('+i.id+',2)\">✗</button> <button class=\"btn btn-danger btn-sm\" onclick=\"deleteImage('+i.id+')\">删除</button></td></tr>'});html+='</table>';if(allImages.length===0)html='<div class=\"empty\">暂无图片</div>';document.getElementById('imageList').innerHTML=html}catch(e){console.error(e)}}\n" +
"\n" +
"function toggleSelectAll(el){var cbs=document.querySelectorAll('#imageList input[type=checkbox]');cbs.forEach(function(cb){cb.checked=el.checked;var id=parseInt(cb.value);if(el.checked)selectedImages.add(id);else selectedImages.delete(id)})}\n" +
"function toggleSelect(id){if(selectedImages.has(id))selectedImages.delete(id);else selectedImages.add(id)}\n" +
"async function auditImage(id,status){try{await apiPost('/images/'+id+'/audit',{status:status});toast(status===1?'已通过':'已拒绝');loadImages()}catch(e){toast('操作失败','error')}}\n" +
"function deleteImage(id){confirm('确定删除图片 #'+id+'？',async function(){try{await apiDelete('/images/'+id);toast('已删除');loadImages()}catch(e){toast('删除失败','error')}})}\n" +
"async function batchDelete(){if(selectedImages.size===0){toast('请先选择图片','error');return}confirm('确定删除选中的 '+selectedImages.size+' 张图片？',async function(){for(var id of selectedImages){try{await apiDelete('/images/'+id)}catch(e){}}selectedImages.clear();toast('批量删除完成');loadImages()})}\n" +
"\n" +
"// Users\n" +
"async function loadUsers(){try{var users=await apiGet('/users');var html='<table><tr><th>ID</th><th>QQ</th><th>角色</th><th>操作</th></tr>';if(Array.isArray(users)){users.forEach(function(u){var rb=u.role>=2?'badge-admin':'badge-reviewer';var rn=u.role>=2?'管理员':'审核员';html+='<tr><td>'+u.id+'</td><td>'+h(u.qq)+'</td><td><span class=\"badge '+rb+'\">'+rn+'</span></td><td><button class=\"btn btn-danger btn-sm\" onclick=\"deleteUser(\\''+h(u.qq)+'\\')\">移除</button></td></tr>'})}html+='</table>';if(!Array.isArray(users)||users.length===0)html='<div class=\"empty\">暂无用户</div>';document.getElementById('userList').innerHTML=html}catch(e){console.error(e)}}\n" +
"async function addUser(){var qq=document.getElementById('newUserQq').value.trim();var role=document.getElementById('newUserRole').value;if(!qq){toast('请输入QQ号','error');return}try{await apiPost('/users',{qq:qq,role:role});toast('添加成功');document.getElementById('newUserQq').value='';loadUsers()}catch(e){toast('添加失败','error')}}\n" +
"function deleteUser(qq){confirm('确定移除用户 '+qq+'？',async function(){try{await apiDelete('/users/'+qq);toast('已移除');loadUsers()}catch(e){toast('移除失败','error')}})}\n" +
"\n" +
"// Bans\n" +
"async function loadBans(){try{var bans=await apiGet('/bans');var html='<table><tr><th>QQ</th><th>原因</th><th>封禁时间</th><th>操作</th></tr>';if(Array.isArray(bans)){bans.forEach(function(b){html+='<tr><td>'+h(b.qq)+'</td><td>'+h(b.reason||'-')+'</td><td>'+fmtTs(b.banned_at)+'</td><td><button class=\"btn btn-success btn-sm\" onclick=\"unbanUser(\\''+h(b.qq)+'\\')\">解封</button></td></tr>'})}html+='</table>';if(!Array.isArray(bans)||bans.length===0)html='<div class=\"empty\">暂无封禁</div>';document.getElementById('banList').innerHTML=html}catch(e){console.error(e)}}\n" +
"async function banUser(){var qq=document.getElementById('banQq').value.trim();var reason=document.getElementById('banReason').value.trim();if(!qq){toast('请输入QQ号','error');return}try{await apiPost('/bans',{qq:qq,reason:reason});toast('已封禁 '+qq);document.getElementById('banQq').value='';document.getElementById('banReason').value='';loadBans()}catch(e){toast('封禁失败','error')}}\n" +
"function unbanUser(qq){confirm('确定解封 '+qq+'？',async function(){try{await apiDelete('/bans/'+qq);toast('已解封');loadBans()}catch(e){toast('解封失败','error')}})}\n" +
"\n" +
"// Settings\n" +
"async function loadSettings(){try{var cfg=await apiGet('/config');var o=JSON.parse(cfg);document.getElementById('cfgPort').value=o.server_port||'8080';document.getElementById('cfgPlatformName').value=o.platform_name||'';document.getElementById('cfgPlatformLogo').value=o.platform_logo||'';document.getElementById('cfgWebdavUrl').value=o.webdav_url||'';document.getElementById('cfgWebdavUser').value=o.webdav_user||'';document.getElementById('cfgWebdavPass').value=o.webdav_pass||'';document.getElementById('cfgOauthPrefix').value=o.oauth_prefix||'';document.getElementById('cfgOauthClientId').value=o.oauth_client_id||'';document.getElementById('cfgOauthClientSecret').value=o.oauth_client_secret||'';document.getElementById('cfgOauthRedirectUri').value=o.oauth_redirect_uri||'';document.getElementById('cfgFrpcPath').value=o.frpc_path||'';document.getElementById('cfgFrpcConfig').value=o.frpc_config||'';var frpcS=await apiGet('/frpc/status');document.getElementById('frpcStatus').innerHTML='<span class=\"status-dot '+(frpcS.configured?'on':'off')+'\"></span> '+(frpcS.configured?'FRPC 已配置':'FRPC 未配置')}catch(e){console.error(e)}}\n" +
"async function saveConfig(data){var d=new URLSearchParams();for(var k in data)d.append(k,data[k]);try{await fetch(API+'/config',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:d});toast('保存成功')}catch(e){toast('保存失败','error')}}\n" +
"function saveServerConfig(){saveConfig({k:'server_port',v:document.getElementById('cfgPort').value});saveConfig({k:'platform_name',v:document.getElementById('cfgPlatformName').value});saveConfig({k:'platform_logo',v:document.getElementById('cfgPlatformLogo').value})}\n" +
"function saveWebdavConfig(){saveConfig({k:'webdav_url',v:document.getElementById('cfgWebdavUrl').value});saveConfig({k:'webdav_user',v:document.getElementById('cfgWebdavUser').value});saveConfig({k:'webdav_pass',v:document.getElementById('cfgWebdavPass').value})}\n" +
"function saveOauthConfig(){saveConfig({k:'oauth_prefix',v:document.getElementById('cfgOauthPrefix').value});saveConfig({k:'oauth_client_id',v:document.getElementById('cfgOauthClientId').value});saveConfig({k:'oauth_client_secret',v:document.getElementById('cfgOauthClientSecret').value});saveConfig({k:'oauth_redirect_uri',v:document.getElementById('cfgOauthRedirectUri').value})}\n" +
"function saveFrpcConfig(){saveConfig({k:'frpc_path',v:document.getElementById('cfgFrpcPath').value});saveConfig({k:'frpc_config',v:document.getElementById('cfgFrpcConfig').value});loadSettings()}\n" +
"async function triggerBackup(){try{var r=await apiPost('/backup',{});toast(r)}catch(e){toast('备份失败','error')}}\n" +
"function refreshAll(){loadDashboard();loadImages();loadUsers();loadBans();loadSettings();toast('已刷新')}\n" +
"\n" +
"// Init\n" +
"loadDashboard();\n" +
"// Auto-refresh every 30s\n" +
"setInterval(function(){var active=document.querySelector('.panel.active');if(!active)return;var id=active.id;if(id==='panel-dashboard')loadDashboard();if(id==='panel-images')loadImages()},30000);\n" +
"</script>\n</body>\n</html>";
    }
}
