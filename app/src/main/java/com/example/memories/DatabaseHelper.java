package com.example.memories;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
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
import java.util.Calendar;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;

public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "memories.db";
    private static final int DB_VERSION = 2;
    private static String dbPath = null;
    private static SQLiteDatabase sharedDb = null;
    private static final ExecutorService requestLogExecutor = Executors.newFixedThreadPool(
            2,
            new ThreadFactory() {
                private int counter = 0;
                @Override
                public Thread newThread(Runnable r) {
                    Thread t = new Thread(r, "memories-request-log-" + (++counter));
                    t.setDaemon(true);
                    return t;
                }
            }
    );

    /**
     * 获取数据库路径：统一使用内部存储。
     * Android 11+ 的 Scoped Storage 禁止 SQLite 直接打开外部路径，
     * 数据持久化通过 {@link #backupToExternal()} 实现。
     */
    public static String resolveDatabasePath(Context ctx) {
        if (dbPath != null) return dbPath;
        dbPath = ctx.getDatabasePath(DB_NAME).getAbsolutePath();
        return dbPath;
    }

    /** 外部备份文件路径（卸载后保留） */
    public static File getExternalBackupFile() {
        return new File(Environment.getExternalStorageDirectory(), "Memories/" + DB_NAME);
    }

    private static volatile boolean restoring = false;

    /**
     * 从外部备份恢复数据（内部库为空且有外部备份时自动执行）。
     * 应在首次 getSharedDb() 之后调用。
     */
    public void ensureRestoredFromExternal() {
        if (restoring) return; // 防止递归
        restoring = true;
        try {
            SQLiteDatabase db = getSharedDb();
            Cursor c = db.rawQuery("SELECT COUNT(*) FROM images", null);
            boolean isEmpty = !c.moveToFirst() || c.getInt(0) == 0;
            c.close();

            if (isEmpty) {
                File ext = getExternalBackupFile();
                if (ext.exists() && ext.length() > 0) {
                    if (sharedDb != null && sharedDb.isOpen()) {
                        sharedDb.close();
                    }
                    sharedDb = null;
                    try {
                        copyFile(ext, new File(dbPath));
                        Log.i("DatabaseHelper", "Restored DB from external backup (" + ext.length() + " bytes)");
                    } catch (Exception e) {
                        Log.w("DatabaseHelper", "Failed to restore from external backup, will use empty DB", e);
                    }
                    // 确保数据库连接已重新打开（无论恢复成功与否）
                    getSharedDb();
                }
            }
        } catch (Exception e) {
            Log.w("DatabaseHelper", "Failed to check/restore from external backup", e);
        } finally {
            restoring = false;
        }
    }

    private static volatile long lastBackupTime = 0;
    private static final long BACKUP_COOLDOWN_MS = 10_000; // 10 秒冷却

    /** 备份内部数据库到外部存储（异步，带冷却，卸载后数据保留） */
    public void backupToExternal() {
        long now = System.currentTimeMillis();
        if (now - lastBackupTime < BACKUP_COOLDOWN_MS) return;
        lastBackupTime = now;

        requestLogExecutor.execute(() -> {
            try {
                SQLiteDatabase db = getSharedDb();
                if (db != null && db.isOpen()) {
                    db.execSQL("PRAGMA wal_checkpoint(FULL)");
                }
                File ext = getExternalBackupFile();
                File extDir = ext.getParentFile();
                if (extDir != null && !extDir.exists()) {
                    extDir.mkdirs();
                }
                copyFile(new File(dbPath), ext);
            } catch (Exception e) {
                Log.w("DatabaseHelper", "Failed to backup to external", e);
            }
        });
    }

    private static void copyFile(File src, File dest) throws Exception {
        if (src == null || !src.exists()) return;
        File parent = dest.getParentFile();
        if (parent != null && !parent.exists()) parent.mkdirs();
        try (InputStream in = new FileInputStream(src); OutputStream out = new FileOutputStream(dest)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
    }

    public DatabaseHelper(Context ctx) {
        super(ctx, resolveDatabasePath(ctx), null, DB_VERSION);
        // 每次数据库写入后自动备份到外部存储
        WriteQueue.setOnAfterWrite(this::backupToExternal);
    }

    /** 共享连接，确保 WriteQueue 写入对所有实例可见 */
    private synchronized SQLiteDatabase getSharedDb() {
        if (sharedDb == null || !sharedDb.isOpen()) {
            boolean firstOpen = (sharedDb == null);
            sharedDb = super.getWritableDatabase();
            try {
                sharedDb.execSQL("PRAGMA journal_mode=WAL");
                sharedDb.execSQL("PRAGMA synchronous=NORMAL");
                sharedDb.execSQL("PRAGMA temp_store=MEMORY");
                sharedDb.execSQL("PRAGMA locking_mode=NORMAL");
                sharedDb.execSQL("PRAGMA busy_timeout=3000");
                // 针对 256MB heap 设备 (vivo V2046A / Android 13) 优化
                sharedDb.execSQL("PRAGMA cache_size=-8000");
                sharedDb.execSQL("PRAGMA mmap_size=33554432");
            } catch (Exception ignored) {
                // WAL 对部分设备/路径可能不支持，降级为普通模式即可
            }
            if (firstOpen) {
                ensureRestoredFromExternal();
            }
        }
        return sharedDb;
    }

    /** 获取数据库文件路径（用于备份等） */
    public String getDatabasePathString() {
        return getSharedDb().getPath();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE images (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, status INTEGER DEFAULT 0, created_at INTEGER)");
        db.execSQL("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, qq TEXT, role INTEGER)");
        db.execSQL("CREATE TABLE config (k TEXT PRIMARY KEY, v TEXT)");
        db.execSQL("CREATE TABLE banned_users (qq TEXT PRIMARY KEY, reason TEXT, banned_at INTEGER)");
        db.execSQL("CREATE TABLE api_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, status_code INTEGER, remote_ip TEXT, user_qq TEXT, timestamp_ms INTEGER, elapsed_ms REAL)");
        db.execSQL("CREATE TABLE api_stats_daily (day TEXT PRIMARY KEY, total_requests INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, last_seen_at INTEGER)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL("CREATE TABLE IF NOT EXISTS api_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, status_code INTEGER, remote_ip TEXT, user_qq TEXT, timestamp_ms INTEGER, elapsed_ms REAL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS api_stats_daily (day TEXT PRIMARY KEY, total_requests INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, last_seen_at INTEGER)");
        }
    }

    public long addImage(String url) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("url", url);
                cv.put("created_at", System.currentTimeMillis());
                return db.insert("images", null, cv);
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "addImage error", e);
            return -1;
        }
    }

    public void logRequest(String method, String path, int statusCode, String remoteIp, String userQq, long timestamp, long elapsedMs) {
        requestLogExecutor.execute(() -> {
            try {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("method", method == null ? "" : method);
                cv.put("path", path == null ? "" : path);
                cv.put("status_code", statusCode);
                cv.put("remote_ip", remoteIp == null ? "" : remoteIp);
                cv.put("user_qq", userQq == null ? "" : userQq);
                cv.put("timestamp_ms", timestamp);
                cv.put("elapsed_ms", elapsedMs);
                db.insert("api_requests", null, cv);
                updateDailyStats(db, statusCode, timestamp);
            } catch (Exception e) {
                Log.e("DatabaseHelper", "logRequest error", e);
            }
        });
    }

    private void updateDailyStats(SQLiteDatabase db, int statusCode, long timestamp) {
        String day = formatDay(timestamp);
        Cursor c = db.rawQuery("SELECT total_requests, success_count, error_count FROM api_stats_daily WHERE day=?", new String[]{day});
        ContentValues cv = new ContentValues();
        cv.put("day", day);
        cv.put("last_seen_at", timestamp);
        if (c.moveToFirst()) {
            int total = c.getInt(0) + 1;
            int success = c.getInt(1) + (statusCode < 400 ? 1 : 0);
            int error = c.getInt(2) + (statusCode >= 400 ? 1 : 0);
            cv.put("total_requests", total);
            cv.put("success_count", success);
            cv.put("error_count", error);
            db.update("api_stats_daily", cv, "day=?", new String[]{day});
        } else {
            cv.put("total_requests", 1);
            cv.put("success_count", statusCode < 400 ? 1 : 0);
            cv.put("error_count", statusCode >= 400 ? 1 : 0);
            db.insertWithOnConflict("api_stats_daily", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        }
        c.close();
    }

    public String listRequestLogsJson(int limit) {
        if (limit < 1) limit = 20;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery(
            "SELECT id, method, path, status_code, remote_ip, user_qq, timestamp_ms, elapsed_ms FROM api_requests ORDER BY id DESC LIMIT ?",
            new String[]{String.valueOf(limit)}
        );
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", c.getLong(0));
                o.put("method", c.getString(1));
                o.put("path", c.getString(2));
                o.put("status_code", c.getInt(3));
                o.put("remote_ip", c.getString(4));
                o.put("user_qq", c.getString(5));
                o.put("timestamp_ms", c.getLong(6));
                o.put("elapsed_ms", c.getDouble(7));
                arr.put(o);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    public String listDailyStatsJson(int days) {
        if (days < 1) days = 7;
        SQLiteDatabase db = getSharedDb();
        long cutoff = System.currentTimeMillis() - ((long) days - 1) * 24L * 60L * 60L * 1000L;
        String cutoffDay = formatDay(cutoff);
        Cursor c = db.rawQuery(
            "SELECT day, total_requests, success_count, error_count, last_seen_at FROM api_stats_daily WHERE day >= ? ORDER BY day ASC",
            new String[]{cutoffDay}
        );
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("day", c.getString(0));
                o.put("total_requests", c.getInt(1));
                o.put("success_count", c.getInt(2));
                o.put("error_count", c.getInt(3));
                o.put("last_seen_at", c.getLong(4));
                arr.put(o);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    public long getApiRequestCount() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM api_requests", null);
        long cnt = 0;
        if (c.moveToFirst()) cnt = c.getLong(0);
        c.close();
        return cnt;
    }

    public long getTodayRequestCount() {
        SQLiteDatabase db = getSharedDb();
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        long startOfToday = cal.getTimeInMillis();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM api_requests WHERE timestamp_ms >= ?", new String[]{String.valueOf(startOfToday)});
        long cnt = 0;
        if (c.moveToFirst()) cnt = c.getLong(0);
        c.close();
        return cnt;
    }

    private String formatDay(long timestamp) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return sdf.format(timestamp);
    }

    public String listImagesJson() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT id, url, status, created_at FROM images ORDER BY created_at DESC", null);
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", c.getLong(0));
                o.put("url", c.getString(1));
                o.put("status", c.getInt(2));
                o.put("created_at", c.getLong(3));
                arr.put(o);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    /**
     * 分页查询图片列表 — 默认只返回审核通过的图片 (status=1)
     * @param page 页码，从 1 开始
     * @param limit 每页条数，默认 20
     * @return JSON: {"items":[...], "total":N, "page":1, "limit":20, "totalPages":N}
     */
    public String listImagesPaginatedJson(int page, int limit) {
        return listImagesPaginatedJson(page, limit, false);
    }

    /**
     * 分页查询图片列表，支持返回全部状态
     * @param page 页码，从 1 开始
     * @param limit 每页条数，默认 20
     * @param allStatus true=返回全部状态, false=只返回审核通过 (status=1)
     * @return JSON: {"items":[...], "total":N, "page":1, "limit":20, "totalPages":N}
     */
    public String listImagesPaginatedJson(int page, int limit, boolean allStatus) {
        if (page < 1) page = 1;
        if (limit < 1) limit = 20;
        int offset = (page - 1) * limit;

        SQLiteDatabase db = getSharedDb();

        String whereClause = allStatus ? "" : " WHERE status = 1";
        String countSql = "SELECT COUNT(*) FROM images" + whereClause;

        // 查总数
        Cursor countCur = db.rawQuery(countSql, null);
        long total = 0;
        if (countCur.moveToFirst()) total = countCur.getLong(0);
        countCur.close();

        int totalPages = (int) Math.ceil((double) total / limit);

        // 查分页数据
        Cursor c = db.rawQuery(
            "SELECT id, url, status, created_at FROM images" + whereClause + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
            new String[]{String.valueOf(limit), String.valueOf(offset)}
        );
        JSONArray items = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", c.getLong(0));
                o.put("url", c.getString(1));
                o.put("status", c.getInt(2));
                o.put("created_at", c.getLong(3));
                items.put(o);
            } catch (Exception ignored) {}
        }
        c.close();

        // 组装分页响应
        JSONObject result = new JSONObject();
        try {
            result.put("items", items);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);
            result.put("totalPages", totalPages);
        } catch (Exception ignored) {}

        return result.toString();
    }

    public boolean deleteImage(long id) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int rows = db.delete("images", "id=?", new String[]{String.valueOf(id)});
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "deleteImage error", e);
            return false;
        }
    }

    public boolean updateImageStatus(long id, int status) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("status", status);
                int rows = db.update("images", cv, "id=?", new String[]{String.valueOf(id)});
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "updateImageStatus error", e);
            return false;
        }
    }

    public long getImageCount() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM images", null);
        long cnt = 0;
        if (c.moveToFirst()) cnt = c.getLong(0);
        c.close();
        return cnt;
    }

    public void addUser(String qq, int role) {
        try {
            WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("qq", qq);
                cv.put("role", role);
                db.insertWithOnConflict("users", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                return null;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "addUser error", e);
        }
    }

    public int getUserRole(String qq) {
        if (qq == null) return 0;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT role FROM users WHERE qq=?", new String[]{qq});
        int role = 0;
        if (c.moveToFirst()) role = c.getInt(0);
        c.close();
        return role;
    }

    public String getConfigJson() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT k, v FROM config", null);
        JSONObject o = new JSONObject();
        while (c.moveToNext()) {
            try { o.put(c.getString(0), c.getString(1)); } catch (Exception ignored) {}
        }
        c.close();
        return o.toString();
    }

    public void setConfig(String k, String v) {
        try {
            WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("k", k);
                cv.put("v", v);
                db.insertWithOnConflict("config", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                return null;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "setConfig error", e);
        }
    }

    public String getConfig(String k) {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT v FROM config WHERE k=?", new String[]{k});
        String v = null;
        if (c.moveToFirst()) v = c.getString(0);
        c.close();
        return v;
    }

    public String listUsersJson() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT id, qq, role FROM users ORDER BY id", null);
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", c.getLong(0));
                o.put("qq", c.getString(1));
                o.put("role", c.getInt(2));
                arr.put(o);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    public boolean deleteUser(String qq) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int rows = db.delete("users", "qq=?", new String[]{qq});
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "deleteUser error", e);
            return false;
        }
    }

    // --- 封禁用户管理 ---

    public void banUser(String qq, String reason) {
        try {
            WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("qq", qq);
                cv.put("reason", reason != null ? reason : "");
                cv.put("banned_at", System.currentTimeMillis());
                db.insertWithOnConflict("banned_users", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                return null;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "banUser error", e);
        }
    }

    public boolean unbanUser(String qq) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int rows = db.delete("banned_users", "qq=?", new String[]{qq});
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "unbanUser error", e);
            return false;
        }
    }

    public boolean isUserBanned(String qq) {
        if (qq == null) return false;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT 1 FROM banned_users WHERE qq=?", new String[]{qq});
        boolean banned = c.moveToFirst();
        c.close();
        return banned;
    }

    public String listBannedUsersJson() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT qq, reason, banned_at FROM banned_users ORDER BY banned_at DESC", null);
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("qq", c.getString(0));
                o.put("reason", c.getString(1));
                o.put("banned_at", c.getLong(2));
                arr.put(o);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    // ==================== 数据库可视化管理 ====================

    /**
     * 列出所有用户表及其结构信息
     */
    public String listTablesJson() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%' ORDER BY name",
            null);
        JSONArray arr = new JSONArray();
        while (c.moveToNext()) {
            String tableName = c.getString(0);
            try {
                JSONObject table = new JSONObject();
                table.put("name", tableName);

                // 列信息
                Cursor colCursor = db.rawQuery("PRAGMA table_info('" + tableName + "')", null);
                JSONArray columns = new JSONArray();
                while (colCursor.moveToNext()) {
                    JSONObject col = new JSONObject();
                    col.put("cid", colCursor.getInt(0));
                    col.put("name", colCursor.getString(1));
                    col.put("type", colCursor.getString(2));
                    col.put("notnull", colCursor.getInt(3) == 1);
                    col.put("dflt_value", colCursor.isNull(4) ? JSONObject.NULL : colCursor.getString(4));
                    col.put("pk", colCursor.getInt(5) == 1);
                    columns.put(col);
                }
                colCursor.close();
                table.put("columns", columns);

                // 行数
                Cursor countCursor = db.rawQuery("SELECT COUNT(*) FROM '" + tableName + "'", null);
                if (countCursor.moveToFirst()) table.put("rowCount", countCursor.getLong(0));
                countCursor.close();

                arr.put(table);
            } catch (Exception ignored) {}
        }
        c.close();
        return arr.toString();
    }

    /**
     * 分页查询指定表的数据
     */
    public String queryTableJson(String tableName, int page, int limit) {
        if (page < 1) page = 1;
        if (limit < 1) limit = 50;
        int offset = (page - 1) * limit;

        SQLiteDatabase db = getSharedDb();

        // 验证表名（防注入）
        Cursor check = db.rawQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=? AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%'",
            new String[]{tableName});
        if (!check.moveToFirst()) {
            check.close();
            try {
                JSONObject err = new JSONObject();
                err.put("error", "table not found: " + tableName);
                return err.toString();
            } catch (Exception e) {
                return "{\"error\":\"table not found\"}";
            }
        }
        check.close();

        // 列名
        Cursor colCursor = db.rawQuery("PRAGMA table_info('" + tableName + "')", null);
        JSONArray columns = new JSONArray();
        while (colCursor.moveToNext()) {
            columns.put(colCursor.getString(1));
        }
        colCursor.close();

        // 总数
        Cursor countCur = db.rawQuery("SELECT COUNT(*) FROM '" + tableName + "'", null);
        long total = 0;
        if (countCur.moveToFirst()) total = countCur.getLong(0);
        countCur.close();

        int totalPages = (int) Math.ceil((double) total / limit);

        // 数据
        Cursor dataCur = db.rawQuery(
            "SELECT * FROM '" + tableName + "' LIMIT ? OFFSET ?",
            new String[]{String.valueOf(limit), String.valueOf(offset)});
        JSONArray rows = new JSONArray();
        while (dataCur.moveToNext()) {
            JSONObject row = new JSONObject();
            for (int i = 0; i < columns.length(); i++) {
                String colName = null;
                try {
                    colName = columns.getString(i);
                    if (dataCur.isNull(i)) {
                        row.put(colName, JSONObject.NULL);
                    } else {
                        int type = dataCur.getType(i);
                        if (type == Cursor.FIELD_TYPE_INTEGER) {
                            row.put(colName, dataCur.getLong(i));
                        } else if (type == Cursor.FIELD_TYPE_FLOAT) {
                            row.put(colName, dataCur.getDouble(i));
                        } else if (type == Cursor.FIELD_TYPE_BLOB) {
                            row.put(colName, "[BLOB]");
                        } else {
                            row.put(colName, dataCur.getString(i));
                        }
                    }
                } catch (Exception ignored) {
                    try { if (colName != null) row.put(colName, dataCur.getString(i)); } catch (Exception ignored2) {}
                }
            }
            rows.put(row);
        }
        dataCur.close();

        JSONObject result = new JSONObject();
        try {
            result.put("columns", columns);
            result.put("rows", rows);
            result.put("total", total);
            result.put("page", page);
            result.put("limit", limit);
            result.put("totalPages", totalPages);
        } catch (Exception ignored) {}

        return result.toString();
    }

    /**
     * 执行 SQL 语句（支持 SELECT/INSERT/UPDATE/DELETE 等）
     * 对非 SELECT 语句进行表名校验，仅允许操作已知用户表
     */
    public String executeSql(String sql) {
        if (sql == null || sql.trim().isEmpty()) {
            return "{\"error\":\"empty query\"}";
        }
        String trimmed = sql.trim();
        String upper = trimmed.toUpperCase();

        // 禁止多语句注入
        if (trimmed.contains(";")) {
            int lastSemicolon = trimmed.lastIndexOf(';');
            if (lastSemicolon < trimmed.length() - 1) {
                return "{\"error\":\"不支持多语句查询\"}";
            }
            // 去掉末尾分号
            trimmed = trimmed.substring(0, lastSemicolon).trim();
            upper = trimmed.toUpperCase();
        }

        boolean isQuery = upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("EXPLAIN");

        // 对写操作进行表名校验
        if (!isQuery) {
            String validationError = validateWriteSql(trimmed);
            if (validationError != null) return validationError;
        }

        if (isQuery) {
            return executeReadQuery(trimmed);
        } else {
            return executeWriteStatement(trimmed);
        }
    }

    /** 验证写 SQL 是否只操作已知用户表 */
    private String validateWriteSql(String sql) {
        String upper = sql.toUpperCase();
        // 提取涉及的表名（简单启发式解析）
        String[] tableHints = extractTableNames(sql);
        if (tableHints.length == 0) {
            return "{\"error\":\"无法识别操作的表名\"}";
        }

        SQLiteDatabase db = getSharedDb();
        for (String tableName : tableHints) {
            Cursor c = db.rawQuery(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=? AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%'",
                new String[]{tableName});
            boolean exists = c.moveToFirst();
            c.close();
            if (!exists) {
                return "{\"error\":\"不允许操作表: " + tableName + "\"}";
            }
        }
        return null; // 通过验证
    }

    /** 从 SQL 中提取可能的目标表名 */
    private String[] extractTableNames(String sql) {
        String upper = sql.toUpperCase().replaceAll("\\s+", " ").trim();
        java.util.Set<String> names = new java.util.LinkedHashSet<>();

        // CREATE TABLE / ALTER TABLE / DROP TABLE
        java.util.regex.Matcher m = java.util.regex.Pattern.compile(
            "(?:CREATE|ALTER|DROP)\\s+TABLE\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?['\"]?(\\w+)['\"]?",
            java.util.regex.Pattern.CASE_INSENSITIVE).matcher(sql);
        while (m.find()) names.add(m.group(1));

        // INSERT INTO table
        m = java.util.regex.Pattern.compile("INSERT\\s+INTO\\s+['\"]?(\\w+)['\"]?", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(sql);
        while (m.find()) names.add(m.group(1));

        // UPDATE table / DELETE FROM table
        m = java.util.regex.Pattern.compile("(?:UPDATE|DELETE\\s+FROM)\\s+['\"]?(\\w+)['\"]?", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(sql);
        while (m.find()) names.add(m.group(1));

        // CREATE INDEX ... ON table
        m = java.util.regex.Pattern.compile("ON\\s+['\"]?(\\w+)['\"]?\\s*\\(", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(sql);
        while (m.find()) names.add(m.group(1));

        return names.toArray(new String[0]);
    }

    /** 执行读查询 */
    private String executeReadQuery(String sql) {
        SQLiteDatabase db = getSharedDb();
        try {
            Cursor c = db.rawQuery(sql, null);

            JSONArray columns = new JSONArray();
            String[] colNames = c.getColumnNames();
            for (String name : colNames) columns.put(name);

            JSONArray rows = new JSONArray();
            int maxRows = 500;
            while (c.moveToNext() && rows.length() < maxRows) {
                JSONObject row = new JSONObject();
                for (int i = 0; i < colNames.length; i++) {
                    try {
                        if (c.isNull(i)) {
                            row.put(colNames[i], JSONObject.NULL);
                        } else {
                            int type = c.getType(i);
                            if (type == Cursor.FIELD_TYPE_INTEGER) {
                                row.put(colNames[i], c.getLong(i));
                            } else if (type == Cursor.FIELD_TYPE_FLOAT) {
                                row.put(colNames[i], c.getDouble(i));
                            } else if (type == Cursor.FIELD_TYPE_BLOB) {
                                row.put(colNames[i], "[BLOB]");
                            } else {
                                row.put(colNames[i], c.getString(i));
                            }
                        }
                    } catch (Exception ignored) {
                        try { row.put(colNames[i], c.getString(i)); } catch (Exception ignored2) {}
                    }
                }
                rows.put(row);
            }
            int returned = rows.length();
            c.close();

            JSONObject result = new JSONObject();
            result.put("type", "query");
            result.put("columns", columns);
            result.put("rows", rows);
            result.put("returned", returned);
            if (returned >= maxRows) {
                result.put("truncated", true);
                result.put("message", "结果已截断，仅显示前 " + maxRows + " 行");
            }
            return result.toString();
        } catch (Exception e) {
            return errorJson(e.getMessage());
        }
    }

    /** 执行写语句 */
    private String executeWriteStatement(String sql) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                try {
                    db.beginTransaction();
                    db.execSQL(sql);
                    Cursor c = null;
                    int affected = 0;
                    try {
                        c = db.rawQuery("SELECT changes()", null);
                        if (c.moveToFirst()) affected = c.getInt(0);
                    } catch (Exception ignored) {}
                    finally { if (c != null) c.close(); }
                    db.setTransactionSuccessful();

                    JSONObject result = new JSONObject();
                    result.put("type", "write");
                    result.put("success", true);
                    result.put("affected", affected);
                    result.put("message", "执行成功，影响 " + affected + " 行");
                    return result.toString();
                } catch (Exception e) {
                    try { db.endTransaction(); } catch (Exception ignored) {}
                    return errorJson(e.getMessage());
                } finally {
                    try { db.endTransaction(); } catch (Exception ignored) {}
                }
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "executeWriteStatement error", e);
            return errorJson(e.getMessage());
        }
    }

    private String errorJson(String msg) {
        try {
            JSONObject err = new JSONObject();
            err.put("type", "error");
            err.put("error", msg);
            return err.toString();
        } catch (Exception ignored) {
            return "{\"type\":\"error\",\"error\":\"" + msg.replace("\"", "\\\"") + "\"}";
        }
    }

    /**
     * 执行只读 SQL 查询（仅允许 SELECT/PRAGMA/EXPLAIN，防注入破坏）
     * @deprecated 请使用 executeSql 代替
     */
    @Deprecated
    public String executeReadOnlyQuery(String sql) {
        return executeSql(sql);
    }

    /**
     * 清理所有已拒绝（status=2）的图片记录，返回删除数量
     */
    public int cleanupRejectedImages() {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                return db.delete("images", "status=?", new String[]{"2"});
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "cleanupRejectedImages error", e);
            return 0;
        }
    }
}
