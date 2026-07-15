package com.example.memories;

import android.content.Context;
import android.util.Log;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.util.HashMap;
import java.util.Map;

/**
 * 管理面板专用服务器，仅在局域网端口上运行。
 * 只接受局域网请求，提供 Vite 构建的静态管理页面，API 调用由前端直接发往主 API 端口。
 */
public class AdminServer extends NanoHTTPD {
    private static final String TAG = "AdminServer";
    private final Context context;
    private final int apiPort; // 主 API 服务端口，注入到管理页面 JS 中

    public AdminServer(int adminPort, int apiPort, Context ctx) {
        super(adminPort);
        this.apiPort = apiPort;
        this.context = ctx.getApplicationContext();
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();

        // 仅局域网可访问
        if (!isLanRequest(session)) {
            return NanoHTTPD.newFixedLengthResponse(Status.FORBIDDEN, "text/plain", "仅局域网可访问管理面板");
        }

        Log.i(TAG, "Admin request: " + uri);

        // 管理页面入口
        if ("/".equals(uri) || "/admin".equals(uri) || "/admin/".equals(uri)) {
            uri = "/index.html";
        }

        // 从 assets/admin/ 提供静态文件
        return serveStaticFile(uri);
    }

    private boolean isLanRequest(IHTTPSession session) {
        try {
            String ip = session.getRemoteIpAddress();
            if (ip == null) return false;
            if (ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isLoopbackAddress()) return true;
            if (addr.isSiteLocalAddress()) return true;
            if (addr.isLinkLocalAddress()) return true;
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

    // MIME 类型映射
    private static final Map<String, String> MIME_TYPES = new HashMap<>();
    static {
        MIME_TYPES.put("html", "text/html; charset=utf-8");
        MIME_TYPES.put("css", "text/css; charset=utf-8");
        MIME_TYPES.put("js", "application/javascript; charset=utf-8");
        MIME_TYPES.put("json", "application/json");
        MIME_TYPES.put("png", "image/png");
        MIME_TYPES.put("jpg", "image/jpeg");
        MIME_TYPES.put("jpeg", "image/jpeg");
        MIME_TYPES.put("gif", "image/gif");
        MIME_TYPES.put("svg", "image/svg+xml");
        MIME_TYPES.put("ico", "image/x-icon");
        MIME_TYPES.put("woff", "font/woff");
        MIME_TYPES.put("woff2", "font/woff2");
        MIME_TYPES.put("ttf", "font/ttf");
        MIME_TYPES.put("eot", "application/vnd.ms-fontobject");
    }

    /**
     * 从 assets/admin/ 目录读取并返回静态文件，API_BASE 参数注入到 HTML 中
     */
    private Response serveStaticFile(String uri) {
        try {
            // 移除开头的 /
            String assetPath = uri.startsWith("/") ? uri.substring(1) : uri;
            // 空路径默认 index.html
            if (assetPath.isEmpty()) assetPath = "index.html";

            String fullPath = "admin/" + assetPath;
            InputStream is = context.getAssets().open(fullPath);

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[8192];
            int n;
            while ((n = is.read(data)) != -1) {
                buffer.write(data, 0, n);
            }
            is.close();

            byte[] bytes = buffer.toByteArray();

            // 判断 MIME 类型
            String mime = getMimeType(assetPath);

            // 对 HTML 文件注入 API_BASE
            if ("text/html; charset=utf-8".equals(mime)) {
                String apiBase = "http://" + EmbeddedServer.getLanIpAddress() + ":" + apiPort;
                String html = new String(bytes, "UTF-8");
                html = html.replace(
                    "window.__API_BASE__ = window.__API_BASE__ || 'http://localhost:8080';",
                    "window.__API_BASE__ = '" + apiBase + "';"
                );
                bytes = html.getBytes("UTF-8");
            }

            return NanoHTTPD.newFixedLengthResponse(Status.OK, mime, new java.io.ByteArrayInputStream(bytes), bytes.length);
        } catch (IOException e) {
            Log.w(TAG, "Static file not found: " + uri);
            return NanoHTTPD.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
        }
    }

    private String getMimeType(String path) {
        int dot = path.lastIndexOf('.');
        if (dot >= 0) {
            String ext = path.substring(dot + 1).toLowerCase();
            String mime = MIME_TYPES.get(ext);
            if (mime != null) return mime;
        }
        return "application/octet-stream";
    }
}
