package com.example.memories;

import android.util.Log;

import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import okhttp3.Credentials;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * WebDAV 客户端，基于 OkHttp 实现（替代不兼容 Android 的 Sardine）。
 */
public class WebDavBackup {
    private static final String TAG = "WebDavBackup";

    private static final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    /** 简单的 WebDAV 资源描述 */
    public static class DavResource {
        private final String name;
        private final String path;
        private final long contentLength;
        private final long modified;

        public DavResource(String name, String path, long contentLength, long modified) {
            this.name = name;
            this.path = path;
            this.contentLength = contentLength;
            this.modified = modified;
        }

        public String getName() { return name; }
        public String getPath() { return path; }
        public Long getContentLength() { return contentLength; }
        public Long getModified() { return modified > 0 ? modified : null; }
        public Date getModifiedDate() { return modified > 0 ? new Date(modified) : null; }
    }

    private static String buildUrl(String webdavUrl, String remotePath) {
        String base = webdavUrl;
        if (!base.endsWith("/")) base += "/";
        if (remotePath.startsWith("/")) {
            return base + remotePath.substring(1);
        }
        return base + remotePath;
    }

    private static Request.Builder authHeader(Request.Builder builder, String username, String password) {
        if (username != null && !username.isEmpty() && password != null) {
            builder.header("Authorization", Credentials.basic(username, password));
        }
        return builder;
    }

    // ==================== 目录操作 ====================

    /**
     * 递归创建 WebDAV 目录（类似 mkdir -p）
     */
    private static void ensureDirectories(String webdavUrl, String username, String password, String remotePath) {
        String[] parts = remotePath.split("/");
        if (parts.length <= 1) return;

        StringBuilder dirPath = new StringBuilder();
        String base = webdavUrl;
        if (!base.endsWith("/")) base += "/";

        for (int i = 0; i < parts.length - 1; i++) {
            if (i > 0) dirPath.append("/");
            dirPath.append(parts[i]);
            String dirUrl = base + dirPath.toString();
            try {
                Request request = authHeader(new Request.Builder().url(dirUrl), username, password)
                        .method("MKCOL", null)
                        .build();
                Response response = client.newCall(request).execute();
                int code = response.code();
                response.close();
                if (code == 201 || code == 405) {
                    Log.d(TAG, "Directory OK: " + dirUrl + " (" + code + ")");
                } else {
                    Log.w(TAG, "Directory failed: " + dirUrl + " (" + code + ")");
                }
            } catch (Throwable e) {
                Log.d(TAG, "Directory error (may exist): " + dirUrl);
            }
        }
    }

    // ==================== 上传 ====================

    public static boolean uploadFile(String webdavUrl, String username, String password,
                                      File file, String remotePath) {
        try {
            ensureDirectories(webdavUrl, username, password, remotePath);

            String url = buildUrl(webdavUrl, remotePath);
            RequestBody body = RequestBody.create(file, MediaType.parse("application/octet-stream"));
            Request request = authHeader(new Request.Builder().url(url), username, password)
                    .put(body)
                    .build();

            Response response = client.newCall(request).execute();
            int code = response.code();
            response.close();

            if (code >= 200 && code < 300) {
                Log.i(TAG, "WebDAV upload OK: " + url + " (" + file.length() + " bytes)");
                return true;
            } else {
                Log.e(TAG, "WebDAV upload failed: " + url + " HTTP " + code);
                return false;
            }
        } catch (Throwable e) {
            Log.e(TAG, "WebDAV upload exception: " + remotePath, e);
            return false;
        }
    }

    // ==================== 下载 ====================

    public static boolean downloadFile(String webdavUrl, String username, String password,
                                        String remotePath, File localFile) {
        try {
            String url = buildUrl(webdavUrl, remotePath);

            File parent = localFile.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();

            Request request = authHeader(new Request.Builder().url(url), username, password)
                    .get()
                    .build();

            Response response = client.newCall(request).execute();
            if (!response.isSuccessful()) {
                int code = response.code();
                response.close();
                Log.e(TAG, "WebDAV download failed: " + url + " HTTP " + code);
                return false;
            }

            InputStream in = response.body().byteStream();
            FileOutputStream out = new FileOutputStream(localFile);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
            out.close();
            in.close();
            response.close();

            Log.i(TAG, "WebDAV download OK: " + remotePath + " -> " + localFile.length() + " bytes");
            return true;
        } catch (Throwable e) {
            Log.e(TAG, "WebDAV download exception: " + remotePath, e);
            return false;
        }
    }

    // ==================== 删除 ====================

    public static boolean deleteFile(String webdavUrl, String username, String password,
                                      String remotePath) {
        try {
            String url = buildUrl(webdavUrl, remotePath);
            Request request = authHeader(new Request.Builder().url(url), username, password)
                    .delete()
                    .build();

            Response response = client.newCall(request).execute();
            int code = response.code();
            response.close();

            boolean ok = (code >= 200 && code < 300) || code == 404;
            if (ok) {
                Log.i(TAG, "WebDAV delete OK: " + remotePath + " (" + code + ")");
            } else {
                Log.w(TAG, "WebDAV delete failed: " + remotePath + " HTTP " + code);
            }
            return ok;
        } catch (Throwable e) {
            Log.e(TAG, "WebDAV delete exception: " + remotePath, e);
            return false;
        }
    }

    // ==================== 列出目录 ====================

    public static List<DavResource> listFiles(String webdavUrl, String username, String password,
                                               String remotePath) {
        List<DavResource> result = new ArrayList<>();
        try {
            String url = buildUrl(webdavUrl, remotePath);
            if (!url.endsWith("/")) url += "/";

            String propfindBody = "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
                    + "<D:propfind xmlns:D=\"DAV:\">"
                    + "<D:prop>"
                    + "<D:displayname/>"
                    + "<D:getcontentlength/>"
                    + "<D:getlastmodified/>"
                    + "<D:resourcetype/>"
                    + "</D:prop>"
                    + "</D:propfind>";

            RequestBody body = RequestBody.create(propfindBody, MediaType.parse("application/xml"));
            Request request = authHeader(new Request.Builder().url(url), username, password)
                    .method("PROPFIND", body)
                    .header("Depth", "1")
                    .build();

            Response response = client.newCall(request).execute();
            if (response.code() == 207) {
                String xml = response.body().string();
                result = parsePropfindResponse(xml, remotePath);
            } else {
                Log.w(TAG, "PROPFIND returned " + response.code() + " for " + url);
            }
            response.close();
        } catch (Throwable e) {
            Log.e(TAG, "WebDAV list exception: " + remotePath, e);
        }
        return result;
    }

    private static List<DavResource> parsePropfindResponse(String xml, String basePath) throws Exception {
        List<DavResource> resources = new ArrayList<>();
        XmlPullParserFactory factory = XmlPullParserFactory.newInstance();
        factory.setNamespaceAware(true);
        XmlPullParser parser = factory.newPullParser();
        parser.setInput(new StringReader(xml));

        String currentHref = null;
        String currentDisplayName = null;
        long currentSize = 0;
        long currentModified = 0;
        String textContent = null;

        int event = parser.getEventType();
        while (event != XmlPullParser.END_DOCUMENT) {
            String tagName = parser.getName();
            switch (event) {
                case XmlPullParser.START_TAG:
                    textContent = null;
                    break;
                case XmlPullParser.TEXT:
                    textContent = parser.getText();
                    break;
                case XmlPullParser.END_TAG:
                    if (textContent != null) {
                        String text = textContent.trim();
                        if ("href".equals(tagName)) {
                            currentHref = text;
                        } else if ("displayname".equals(tagName)) {
                            currentDisplayName = text;
                        } else if ("getcontentlength".equals(tagName)) {
                            try { currentSize = Long.parseLong(text); } catch (NumberFormatException e) {}
                        } else if ("getlastmodified".equals(tagName)) {
                            currentModified = parseRfc822Date(text);
                        }
                    }
                    if ("response".equals(tagName)) {
                        if (currentHref != null && currentDisplayName != null
                                && !currentDisplayName.isEmpty() && currentSize > 0) {
                            String path = basePath;
                            if (path != null && !path.endsWith("/")) path += "/";
                            path += currentDisplayName;
                            resources.add(new DavResource(currentDisplayName, path, currentSize, currentModified));
                        }
                        currentHref = null;
                        currentDisplayName = null;
                        currentSize = 0;
                        currentModified = 0;
                    }
                    textContent = null;
                    break;
            }
            event = parser.next();
        }
        return resources;
    }

    private static long parseRfc822Date(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return 0;
        String cleaned = dateStr.replaceFirst("^[A-Za-z]{3},\\s*", "");
        String[] formats = {
            "dd MMM yyyy HH:mm:ss zzz",
            "dd MMM yyyy HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
        };
        for (String fmt : formats) {
            try {
                return new SimpleDateFormat(fmt, Locale.US).parse(cleaned).getTime();
            } catch (Exception ignored) {}
        }
        return 0;
    }
}
