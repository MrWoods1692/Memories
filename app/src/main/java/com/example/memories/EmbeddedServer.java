package com.example.memories;

import android.content.Context;
import android.util.Log;

import org.nanohttpd.protocols.http.IHTTPSession;
import org.nanohttpd.protocols.http.NanoHTTPD;
import org.nanohttpd.protocols.http.response.Response;
import org.nanohttpd.protocols.http.response.Status;

import java.util.Map;

public class EmbeddedServer extends NanoHTTPD {
    private static final String TAG = "EmbeddedServer";
    private final Context context;

    public EmbeddedServer(int port, Context ctx) {
        super(port);
        this.context = ctx.getApplicationContext();
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

            if (uri.startsWith("/oauth")) {
                return handleOauth(session);
            }

            return Response.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
        } catch (Exception e) {
            Log.e(TAG, "Serve error", e);
            return Response.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "Error");
        }
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
                // parse params
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
                    // require admin
                    String qq = session.getHeaders().get("x-user-qq");
                    int role = db.getUserRole(qq);
                    if (role < 2) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                    boolean ok = db.deleteImage(id);
                    return Response.newFixedLengthResponse(ok?Status.OK:Status.NOT_FOUND, "text/plain", ok?"deleted":"not found");
                }

                if (parts.length >= 4 && "audit".equals(parts[3]) && Method.POST.equals(method)) {
                    // require reviewer
                    String qq = session.getHeaders().get("x-user-qq");
                    int role = db.getUserRole(qq);
                    if (role < 1) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "reviewer required");
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
        String qq = session.getHeaders().get("x-user-qq");
        int role = db.getUserRole(qq);
        if (role < 2) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

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
        String qq = session.getHeaders().get("x-user-qq");
        int role = db.getUserRole(qq);
        if (role < 2) return Response.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
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

    private Response handleOauth(IHTTPSession session) {
        // Placeholder: campus wall OAuth integration should be configured and implemented
        String uri = session.getUri();
        if (uri.equals("/oauth/start")) {
            // return a placeholder URL for user to open
            return Response.newFixedLengthResponse(Status.OK, "application/json", "{\"url\":\"https://campus.example.com/oauth/authorize\"}");
        }
        if (uri.equals("/oauth/callback")) {
            return Response.newFixedLengthResponse(Status.OK, "text/plain", "callback placeholder");
        }
        return Response.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "oauth not implemented");
    }
}
