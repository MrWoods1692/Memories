package com.example.memories;

import android.content.Context;
import android.os.Environment;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 远程文件管理器。
 * 提供局域网内文件浏览、上传、下载、删除、重命名、搜索等功能。
 *
 * 安全策略：
 * - 仅允许访问 /sdcard/ (外部存储根目录) 及其子目录
 * - 防止路径穿越攻击 (如 ../)
 */
public class FileManager {
    private static final String TAG = "FileManager";

    // 允许访问的根目录（外部存储）
    private static final String ALLOWED_ROOT = Environment.getExternalStorageDirectory().getAbsolutePath();

    // 危险系统目录黑名单（需要管理员权限才能访问）
    private static final List<String> RESTRICTED_DIRS = Arrays.asList(
            "/data/data", "/data/app", "/system", "/root", "/etc",
            "/proc", "/sys", "/dev", "/config", "/vendor",
            "/apex", "/acct", "/oem"
    );

    /** 将用户传入的相对路径解析为绝对路径，并校验安全性 */
    private static File resolveSafe(String relativePath) {
        if (relativePath == null || relativePath.isEmpty()) {
            return Environment.getExternalStorageDirectory();
        }

        // 清理路径
        String cleaned = relativePath
                .replace("\\", "/")
                .replaceAll("/{2,}", "/")
                .replaceAll("/\\./", "/");
        while (cleaned.contains("/../") || cleaned.startsWith("../")) {
            cleaned = cleaned.replaceAll("/[^/]+/\\.\\./", "/");
            cleaned = cleaned.replaceAll("^/\\.\\./", "/");
            if (cleaned.startsWith("../")) {
                cleaned = cleaned.substring(3);
            }
        }

        if (!cleaned.startsWith("/")) {
            cleaned = "/" + cleaned;
        }

        File file = new File(ALLOWED_ROOT + cleaned);

        // 确保解析后的路径仍在允许范围内
        try {
            String canonical = file.getCanonicalPath();
            String rootCanonical = new File(ALLOWED_ROOT).getCanonicalPath();
            if (!canonical.startsWith(rootCanonical)) {
                Log.w(TAG, "Path traversal attempt: " + relativePath);
                return Environment.getExternalStorageDirectory();
            }
            
            // 检查是否在受限目录中（管理员可以绕过）
            for (String restricted : RESTRICTED_DIRS) {
                if (canonical.startsWith(restricted)) {
                    Log.w(TAG, "Restricted directory access: " + canonical);
                    return null; // null 表示需要管理员权限
                }
            }

            return new File(canonical);
        } catch (Exception e) {
            Log.e(TAG, "resolveSafe error", e);
            return Environment.getExternalStorageDirectory();
        }
    }

    // ================================================================
    // 列出目录内容
    // ================================================================

    /**
     * 列出目录内容（JSON 格式）。
     *
     * @param path 目录路径（相对于 /sdcard/）
     * @param sortBy 排序方式：name, size, date
     * @param order 排序顺序：asc, desc
     * @param showHidden 是否显示隐藏文件
     * @return JSON 字符串
     */
    public static String listFiles(String path, String sortBy, String order, boolean showHidden) {
        File dir = resolveSafe(path);
        if (dir == null) {
            return "{\"error\":\"restricted_directory\",\"path\":\"" + escapeJson(path) + "\"}";
        }
        if (!dir.exists()) {
            return "{\"error\":\"not_found\",\"path\":\"" + escapeJson(path) + "\"}";
        }
        if (!dir.isDirectory()) {
            return "{\"error\":\"not_directory\",\"path\":\"" + escapeJson(path) + "\"}";
        }

        File[] files = dir.listFiles();
        if (files == null) {
            return "{\"error\":\"permission_denied\",\"path\":\"" + escapeJson(path) + "\"}";
        }

        List<File> fileList = new ArrayList<>(Arrays.asList(files));

        // 过滤隐藏文件
        if (!showHidden) {
            List<File> filtered = new ArrayList<>();
            for (File f : fileList) {
                if (!f.getName().startsWith(".")) {
                    filtered.add(f);
                }
            }
            fileList = filtered;
        }

        // 排序：目录在前
        final boolean asc = !"desc".equalsIgnoreCase(order);
        Comparator<File> baseComparator;
        if ("size".equalsIgnoreCase(sortBy)) {
            baseComparator = Comparator.comparingLong(File::length);
        } else if ("date".equalsIgnoreCase(sortBy)) {
            baseComparator = Comparator.comparingLong(File::lastModified);
        } else {
            baseComparator = Comparator.comparing(File::getName, String.CASE_INSENSITIVE_ORDER);
        }
        final Comparator<File> comparator = asc ? baseComparator : baseComparator.reversed();

        // 目录优先
        Comparator<File> dirFirst = (a, b) -> {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return comparator.compare(a, b);
        };
        Collections.sort(fileList, dirFirst);

        // 构建 JSON
        try {
            JSONObject result = new JSONObject();
            result.put("path", getRelativePath(dir));
            result.put("parent", getRelativePath(dir.getParentFile()));
            result.put("absolute_path", dir.getAbsolutePath());

            JSONArray items = new JSONArray();
            for (File f : fileList) {
                JSONObject item = new JSONObject();
                item.put("name", f.getName());
                item.put("path", getRelativePath(f));
                item.put("isDirectory", f.isDirectory());
                item.put("size", f.length());
                item.put("readableSize", formatSize(f.length()));
                item.put("lastModified", f.lastModified());
                item.put("lastModifiedStr", formatDate(f.lastModified()));
                item.put("isHidden", f.getName().startsWith("."));
                item.put("canRead", f.canRead());
                item.put("canWrite", f.canWrite());
                items.put(item);
            }
            result.put("items", items);
            result.put("count", items.length());

            // 磁盘空间
            long freeSpace = dir.getFreeSpace();
            long totalSpace = dir.getTotalSpace();
            result.put("freeSpace", freeSpace);
            result.put("totalSpace", totalSpace);
            result.put("freeSpaceReadable", formatSize(freeSpace));
            result.put("totalSpaceReadable", formatSize(totalSpace));

            return result.toString(2);
        } catch (Exception e) {
            Log.e(TAG, "listFiles JSON error", e);
            return "{\"error\":\"internal_error\"}";
        }
    }

    // ================================================================
    // 文件信息
    // ================================================================

    public static String getFileInfo(String path) {
        File file = resolveSafe(path);
        if (file == null) {
            return "{\"error\":\"restricted_directory\"}";
        }
        if (!file.exists()) {
            return "{\"error\":\"not_found\"}";
        }

        try {
            JSONObject info = new JSONObject();
            info.put("name", file.getName());
            info.put("path", getRelativePath(file));
            info.put("absolutePath", file.getAbsolutePath());
            info.put("isDirectory", file.isDirectory());
            info.put("size", file.length());
            info.put("readableSize", formatSize(file.length()));
            info.put("lastModified", file.lastModified());
            info.put("lastModifiedStr", formatDate(file.lastModified()));
            info.put("canRead", file.canRead());
            info.put("canWrite", file.canWrite());
            info.put("canExecute", file.canExecute());
            info.put("isHidden", file.getName().startsWith("."));

            // MIME 类型推测
            String mime = guessMimeType(file.getName());
            if (mime != null) {
                info.put("mimeType", mime);
            }

            return info.toString(2);
        } catch (Exception e) {
            Log.e(TAG, "getFileInfo error", e);
            return "{\"error\":\"internal_error\"}";
        }
    }

    // ================================================================
    // 创建目录
    // ================================================================

    public static String createDirectory(String path) {
        File dir = resolveSafe(path);
        if (dir == null) {
            return "{\"error\":\"restricted_directory\"}";
        }
        if (dir.exists()) {
            return "{\"error\":\"already_exists\"}";
        }

        boolean created = dir.mkdirs();
        if (created) {
            return "{\"success\":true,\"path\":\"" + escapeJson(getRelativePath(dir)) + "\"}";
        } else {
            return "{\"error\":\"create_failed\"}";
        }
    }

    // ================================================================
    // 删除文件/目录
    // ================================================================

    public static String delete(String path, boolean recursive) {
        File file = resolveSafe(path);
        if (file == null) {
            return "{\"error\":\"restricted_directory\"}";
        }
        if (!file.exists()) {
            return "{\"error\":\"not_found\"}";
        }

        // 防止删除整个 SD 卡根目录
        try {
            if (file.getCanonicalPath().equals(new File(ALLOWED_ROOT).getCanonicalPath())) {
                return "{\"error\":\"cannot_delete_root\"}";
            }
        } catch (Exception e) {
            return "{\"error\":\"internal_error\"}";
        }

        boolean deleted;
        if (file.isDirectory() && recursive) {
            deleted = deleteRecursive(file);
        } else if (file.isDirectory()) {
            // 非递归：只删除空目录
            String[] children = file.list();
            if (children != null && children.length > 0) {
                return "{\"error\":\"directory_not_empty\",\"count\":" + children.length + "}";
            }
            deleted = file.delete();
        } else {
            deleted = file.delete();
        }

        return deleted
                ? "{\"success\":true}"
                : "{\"error\":\"delete_failed\"}";
    }

    private static boolean deleteRecursive(File dir) {
        File[] children = dir.listFiles();
        if (children != null) {
            for (File child : children) {
                if (child.isDirectory()) {
                    deleteRecursive(child);
                } else {
                    child.delete();
                }
            }
        }
        return dir.delete();
    }

    // ================================================================
    // 重命名/移动
    // ================================================================

    public static String rename(String fromPath, String toPath) {
        File from = resolveSafe(fromPath);
        File to = resolveSafe(toPath);
        if (from == null || to == null) {
            return "{\"error\":\"restricted_directory\"}";
        }
        if (!from.exists()) {
            return "{\"error\":\"source_not_found\"}";
        }
        if (to.exists()) {
            return "{\"error\":\"target_exists\"}";
        }

        boolean success = from.renameTo(to);
        return success
                ? "{\"success\":true,\"newPath\":\"" + escapeJson(getRelativePath(to)) + "\"}"
                : "{\"error\":\"rename_failed\"}";
    }

    // ================================================================
    // 搜索文件
    // ================================================================

    public static String searchFiles(String query, String startPath, int maxResults) {
        File startDir = resolveSafe(startPath);
        if (startDir == null || !startDir.exists()) {
            startDir = Environment.getExternalStorageDirectory();
        }

        if (maxResults <= 0) maxResults = 100;
        if (maxResults > 500) maxResults = 500;

        List<File> results = new ArrayList<>();
        searchRecursive(startDir, query.toLowerCase(Locale.US), results, maxResults);

        try {
            JSONObject result = new JSONObject();
            result.put("query", query);
            result.put("startPath", getRelativePath(startDir));
            JSONArray items = new JSONArray();
            for (File f : results) {
                JSONObject item = new JSONObject();
                item.put("name", f.getName());
                item.put("path", getRelativePath(f));
                item.put("isDirectory", f.isDirectory());
                item.put("size", f.length());
                item.put("readableSize", formatSize(f.length()));
                item.put("lastModified", f.lastModified());
                items.put(item);
            }
            result.put("items", items);
            result.put("count", items.length());
            return result.toString(2);
        } catch (Exception e) {
            Log.e(TAG, "searchFiles error", e);
            return "{\"error\":\"internal_error\"}";
        }
    }

    private static void searchRecursive(File dir, String query, List<File> results, int maxResults) {
        if (results.size() >= maxResults) return;
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File f : children) {
            if (results.size() >= maxResults) return;
            if (f.getName().toLowerCase(Locale.US).contains(query)) {
                results.add(f);
            }
            if (f.isDirectory() && !f.getName().startsWith(".")) {
                searchRecursive(f, query, results, maxResults);
            }
        }
    }

    // ================================================================
    // 获取文件流（用于下载）
    // ================================================================

    public static FileInputStream getFileStream(String path) {
        File file = resolveSafe(path);
        if (file == null || !file.exists() || file.isDirectory()) {
            return null;
        }
        try {
            return new FileInputStream(file);
        } catch (Exception e) {
            Log.e(TAG, "getFileStream error", e);
            return null;
        }
    }

    /** 获取文件大小 */
    public static long getFileSize(String path) {
        File file = resolveSafe(path);
        if (file == null || !file.exists() || file.isDirectory()) {
            return -1;
        }
        return file.length();
    }

    /** 获取文件 MIME 类型 */
    public static String getMimeType(String path) {
        File file = resolveSafe(path);
        if (file == null || !file.exists()) return "application/octet-stream";
        return guessMimeType(file.getName());
    }

    // ================================================================
    // 上传文件（保存到指定路径）
    // ================================================================

    public static String uploadFile(String path, String fileName, InputStream data, long size) {
        File dir = resolveSafe(path);
        if (dir == null) {
            return "{\"error\":\"restricted_directory\"}";
        }
        if (!dir.exists()) {
            dir.mkdirs();
        }
        if (!dir.isDirectory()) {
            return "{\"error\":\"not_directory\"}";
        }

        // 安全文件名
        String safeName = sanitizeFileName(fileName);
        File destFile = new File(dir, safeName);

        try {
            byte[] buffer = new byte[8192];
            int read;
            long totalWritten = 0;
            FileOutputStream fos = new FileOutputStream(destFile);
            while ((read = data.read(buffer)) != -1) {
                fos.write(buffer, 0, read);
                totalWritten += read;
            }
            fos.flush();
            fos.close();

            JSONObject result = new JSONObject();
            result.put("success", true);
            result.put("path", getRelativePath(destFile));
            result.put("name", safeName);
            result.put("size", totalWritten);
            result.put("readableSize", formatSize(totalWritten));
            return result.toString(2);
        } catch (Exception e) {
            Log.e(TAG, "uploadFile error", e);
            try { destFile.delete(); } catch (Exception ignored) {}
            return "{\"error\":\"upload_failed\",\"message\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    /**
     * 批量获取存储信息摘要
     */
    public static String getStorageSummary() {
        try {
            File root = Environment.getExternalStorageDirectory();
            JSONObject info = new JSONObject();
            info.put("rootPath", root.getAbsolutePath());
            info.put("totalSpace", root.getTotalSpace());
            info.put("freeSpace", root.getFreeSpace());
            info.put("usedSpace", root.getTotalSpace() - root.getFreeSpace());
            info.put("totalSpaceReadable", formatSize(root.getTotalSpace()));
            info.put("freeSpaceReadable", formatSize(root.getFreeSpace()));
            info.put("usedSpaceReadable", formatSize(root.getTotalSpace() - root.getFreeSpace()));
            info.put("state", Environment.getExternalStorageState());
            return info.toString(2);
        } catch (Exception e) {
            Log.e(TAG, "getStorageSummary error", e);
            return "{\"error\":\"internal_error\"}";
        }
    }

    // ================================================================
    // 辅助方法
    // ================================================================

    /** 获取相对于 ALLOWED_ROOT 的路径 */
    private static String getRelativePath(File file) {
        if (file == null) return "/";
        try {
            String rootPath = new File(ALLOWED_ROOT).getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (filePath.equals(rootPath)) return "/";
            if (filePath.startsWith(rootPath + "/")) {
                return filePath.substring(rootPath.length());
            }
            return filePath;
        } catch (Exception e) {
            return file.getAbsolutePath();
        }
    }

    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format(Locale.US, "%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024));
        return String.format(Locale.US, "%.2f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private static String formatDate(long millis) {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date(millis));
    }

    private static String sanitizeFileName(String name) {
        if (name == null || name.isEmpty()) return "untitled";
        // 移除路径分隔符等危险字符
        return name.replaceAll("[/\\\\:*?\"<>|]", "_").trim();
    }

    private static String guessMimeType(String fileName) {
        if (fileName == null) return "application/octet-stream";
        String lower = fileName.toLowerCase(Locale.US);
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".mkv")) return "video/x-matroska";
        if (lower.endsWith(".avi")) return "video/x-msvideo";
        if (lower.endsWith(".mov")) return "video/quicktime";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "application/msword";
        if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "application/vnd.ms-excel";
        if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) return "application/vnd.ms-powerpoint";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".xml")) return "application/xml";
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".rar")) return "application/x-rar-compressed";
        if (lower.endsWith(".7z")) return "application/x-7z-compressed";
        if (lower.endsWith(".tar")) return "application/x-tar";
        if (lower.endsWith(".gz")) return "application/gzip";
        if (lower.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
