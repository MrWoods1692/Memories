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
    private static final int DB_VERSION = 6;
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
     * 获取数据库路径：直接使用外部存储 /storage/emulated/0/Memories/，
     * 这样卸载应用后数据库依然保留。
     * 应用已申请 MANAGE_EXTERNAL_STORAGE 权限。
     */
    public static String resolveDatabasePath(Context ctx) {
        if (dbPath != null) return dbPath;
        File extDir = new File(Environment.getExternalStorageDirectory(), "Memories");
        if (!extDir.exists()) {
            extDir.mkdirs();
        }
        dbPath = new File(extDir, DB_NAME).getAbsolutePath();
        return dbPath;
    }

    /** 获取数据库文件（供导入/导出使用） */
    public static File getDatabaseFile() {
        return new File(dbPath != null ? dbPath : Environment.getExternalStorageDirectory() + "/Memories/" + DB_NAME);
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

    /**
     * 从外部文件导入数据库。关闭当前连接，用源文件替换当前数据库，再重新打开。
     * @param sourceFile 源数据库文件
     * @return 导入后的 images 表行数，-1 表示失败
     */
    public long importDatabase(File sourceFile) throws Exception {
        if (sourceFile == null || !sourceFile.exists() || sourceFile.length() == 0) {
            throw new Exception("源文件不存在或为空");
        }

        // 验证源文件是有效的 SQLite 数据库（v6 起图片拆为三张表，兼容旧版单 images 表）
        SQLiteDatabase testDb = null;
        try {
            testDb = SQLiteDatabase.openDatabase(
                    sourceFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
            Cursor c = testDb.rawQuery("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('images_pending','images_approved','images_rejected','images')", null);
            boolean hasImageTable = false;
            while (c.moveToNext()) {
                if (c.getString(0) != null) { hasImageTable = true; break; }
            }
            c.close();
            if (!hasImageTable) {
                testDb.close();
                throw new Exception("无法读取源数据库的图片表");
            }
        } catch (Exception e) {
            if (testDb != null) testDb.close();
            throw new Exception("源文件不是有效的 Memories 数据库: " + e.getMessage());
        }
        if (testDb != null) testDb.close();

        // 关闭当前数据库连接
        if (sharedDb != null && sharedDb.isOpen()) {
            sharedDb.close();
        }
        sharedDb = null;

        // 复制源文件到目标路径（覆盖）
        File targetFile = new File(dbPath);
        copyFile(sourceFile, targetFile);

        // 清理可能的 WAL 文件（外部存储不支持）
        File walFile = new File(dbPath + "-wal");
        if (walFile.exists()) walFile.delete();
        File shmFile = new File(dbPath + "-shm");
        if (shmFile.exists()) shmFile.delete();
        File journalFile = new File(dbPath + "-journal");
        if (journalFile.exists()) journalFile.delete();

        // 重新打开数据库，统计所有图片表（三表拆分后总数 = 三张表之和）
        SQLiteDatabase db = getSharedDb();
        long count = 0;
        for (String t : IMAGE_TABLES) {
            Cursor c = db.rawQuery("SELECT COUNT(*) FROM " + t, null);
            if (c.moveToFirst()) count += c.getLong(0);
            c.close();
        }

        Log.i("DatabaseHelper", "Database imported successfully, " + count + " images");
        return count;
    }

    public DatabaseHelper(Context ctx) {
        super(ctx, resolveDatabasePath(ctx), null, DB_VERSION);
    }

    /** 共享连接，确保 WriteQueue 写入对所有实例可见 */
    private synchronized SQLiteDatabase getSharedDb() {
        if (sharedDb == null || !sharedDb.isOpen()) {
            sharedDb = super.getWritableDatabase();
            try {
                // 外部存储不支持 WAL 模式的文件锁，使用 DELETE 模式
                sharedDb.execSQL("PRAGMA journal_mode=DELETE");
                sharedDb.execSQL("PRAGMA synchronous=NORMAL");
                sharedDb.execSQL("PRAGMA temp_store=MEMORY");
                sharedDb.execSQL("PRAGMA locking_mode=NORMAL");
                sharedDb.execSQL("PRAGMA busy_timeout=3000");
                // 针对 256MB heap 设备 (vivo V2046A / Android 13) 优化
                sharedDb.execSQL("PRAGMA cache_size=-8000");
                sharedDb.execSQL("PRAGMA mmap_size=33554432");
            } catch (Exception ignored) {
                // 部分 PRAGMA 可能不支持，降级即可
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
        // 图片按审核状态拆分为三张表；拒绝的图片保留在 images_rejected，不自动删除
        db.execSQL("CREATE TABLE images_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
        db.execSQL("CREATE TABLE images_approved (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
        db.execSQL("CREATE TABLE images_rejected (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
        db.execSQL("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, qq TEXT, role INTEGER)");
        db.execSQL("CREATE TABLE config (k TEXT PRIMARY KEY, v TEXT)");
        db.execSQL("CREATE TABLE banned_users (qq TEXT PRIMARY KEY, reason TEXT, banned_at INTEGER)");
        // 用户个人偏好（外观/字体/字号等），按 qq 一行，供多设备登录后同步
        db.execSQL("CREATE TABLE user_settings (qq TEXT PRIMARY KEY, theme_preset TEXT, font_size INTEGER, font_family TEXT, dark INTEGER, updated_at INTEGER)");
        db.execSQL("CREATE TABLE api_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, status_code INTEGER, remote_ip TEXT, user_qq TEXT, timestamp_ms INTEGER, elapsed_ms REAL)");
        db.execSQL("CREATE TABLE api_stats_daily (day TEXT PRIMARY KEY, total_requests INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, last_seen_at INTEGER)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL("CREATE TABLE IF NOT EXISTS api_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, status_code INTEGER, remote_ip TEXT, user_qq TEXT, timestamp_ms INTEGER, elapsed_ms REAL)");
            db.execSQL("CREATE TABLE IF NOT EXISTS api_stats_daily (day TEXT PRIMARY KEY, total_requests INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, error_count INTEGER DEFAULT 0, last_seen_at INTEGER)");
        }
        if (oldVersion < 4) {
            // 新增用户个人偏好表：已有安装通过升级路径建表，新建安装走 onCreate
            db.execSQL("CREATE TABLE IF NOT EXISTS user_settings (qq TEXT PRIMARY KEY, theme_preset TEXT, font_size INTEGER, font_family TEXT, dark INTEGER, updated_at INTEGER)");
        }
        if (oldVersion < 3) {
            // 移除 images 表的显式 id 列，改用隐式 rowid（自动回收）
            db.execSQL("CREATE TABLE images_new (url TEXT, status INTEGER DEFAULT 0, created_at INTEGER)");
            db.execSQL("INSERT INTO images_new (url, status, created_at) SELECT url, status, created_at FROM images ORDER BY id");
            db.execSQL("DROP TABLE images");
            db.execSQL("ALTER TABLE images_new RENAME TO images");
        }
        if (oldVersion < 5) {
            // 新增显式自增主键 id 与上传者 qq 列，按原 rowid 顺序重建，保证 id 连续分配
            db.execSQL("CREATE TABLE images_new (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, status INTEGER DEFAULT 0, created_at INTEGER, qq TEXT)");
            db.execSQL("INSERT INTO images_new (url, status, created_at) SELECT url, status, created_at FROM images ORDER BY rowid");
            db.execSQL("DROP TABLE images");
            db.execSQL("ALTER TABLE images_new RENAME TO images");
        }
        if (oldVersion < 6) {
            // v6：按 status 拆分为三张表，保留原 id；拒绝的图片不再自动删除
            db.execSQL("CREATE TABLE IF NOT EXISTS images_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
            db.execSQL("CREATE TABLE IF NOT EXISTS images_approved (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
            db.execSQL("CREATE TABLE IF NOT EXISTS images_rejected (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, created_at INTEGER, qq TEXT)");
            db.execSQL("INSERT INTO images_pending (id, url, created_at, qq) SELECT id, url, created_at, qq FROM images WHERE status=0");
            db.execSQL("INSERT INTO images_approved (id, url, created_at, qq) SELECT id, url, created_at, qq FROM images WHERE status=1");
            db.execSQL("INSERT INTO images_rejected (id, url, created_at, qq) SELECT id, url, created_at, qq FROM images WHERE status=2");
            db.execSQL("DROP TABLE images");
        }
    }

    /**
     * 添加上传图片到待审核表，返回自增主键 id；同时记录上传者 qq 与上传时间 created_at。
     */
    public long addImage(String url, String qq) {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                cv.put("url", url);
                cv.put("qq", qq == null ? "" : qq);
                cv.put("created_at", System.currentTimeMillis());
                long result = db.insert("images_pending", null, cv);
                markDatabaseDirty();
                return result;
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

    /** 图片表白名单：待审核 / 已通过 / 未通过 */
    private static final String[] IMAGE_TABLES = {"images_pending", "images_approved", "images_rejected"};

    private static boolean isImageTable(String table) {
        for (String t : IMAGE_TABLES) if (t.equals(table)) return true;
        return false;
    }

    /** 表名 → 兼容旧接口的状态值（0=待审核, 1=已通过, 2=已拒绝） */
    private static int tableStatus(String table) {
        if ("images_pending".equals(table)) return 0;
        if ("images_rejected".equals(table)) return 2;
        return 1;
    }

    public String listImagesJson() {
        return listImagesPaginatedJson("images_approved", 1, 1000000);
    }

    /**
     * 分页查询指定图片表（images_pending / images_approved / images_rejected）
     * @param table 目标表名（白名单校验，非法值回落为通过表）
     * @param page 页码，从 1 开始
     * @param limit 每页条数，默认 20
     * @return JSON: {"items":[...], "total":N, "page":1, "limit":20, "totalPages":N}
     */
    public String listImagesPaginatedJson(String table, int page, int limit) {
        if (!isImageTable(table)) table = "images_approved";
        if (page < 1) page = 1;
        if (limit < 1) limit = 20;
        int offset = (page - 1) * limit;
        int status = tableStatus(table);

        SQLiteDatabase db = getSharedDb();

        // 查总数（通过表的总数即广场展示的总图片数）
        Cursor countCur = db.rawQuery("SELECT COUNT(*) FROM " + table, null);
        long total = 0;
        if (countCur.moveToFirst()) total = countCur.getLong(0);
        countCur.close();

        int totalPages = (int) Math.ceil((double) total / limit);

        // 查分页数据
        Cursor c = db.rawQuery(
            "SELECT id, url, created_at, qq FROM " + table + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
            new String[]{String.valueOf(limit), String.valueOf(offset)}
        );
        JSONArray items = new JSONArray();
        while (c.moveToNext()) {
            JSONObject o = new JSONObject();
            try {
                o.put("id", c.getLong(0));
                o.put("url", c.getString(1));
                o.put("status", status);
                o.put("created_at", c.getLong(2));
                o.put("qq", c.getString(3) == null ? "" : c.getString(3));
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

    /** 根据 url 查找指定图片表中的主键 id，用于 delete/audit/recover 操作 */
    public long findImageRowId(String table, String url) {
        if (!isImageTable(table)) return -1;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT id FROM " + table + " WHERE url=?", new String[]{url});
        long id = -1;
        if (c.moveToFirst()) id = c.getLong(0);
        c.close();
        return id;
    }

    public boolean deleteImage(String table, long id) {
        if (!isImageTable(table)) return false;
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int rows = db.delete(table, "id=?", new String[]{String.valueOf(id)});
                if (rows > 0) markDatabaseDirty();
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "deleteImage error", e);
            return false;
        }
    }

    /**
     * 按 url 删除图片；table 为空时依次查找三张表。
     * 仅删除指定记录，不涉及审核状态变更。
     */
    public boolean deleteImageByUrl(String table, String url) {
        String[] tables = (table != null && !table.isEmpty()) ? new String[]{table} : IMAGE_TABLES;
        for (String t : tables) {
            long id = findImageRowId(t, url);
            if (id >= 0) return deleteImage(t, id);
        }
        return false;
    }

    /**
     * 把一行图片从 fromTable 移动到 toTable（保留 id/url/created_at/qq）。
     * 审核（待审核→通过/拒绝）与恢复（未通过→通过）都走移动而非删除，拒绝的图片不会消失。
     */
    public boolean moveImage(String fromTable, String toTable, long id) {
        if (!isImageTable(fromTable) || !isImageTable(toTable)) return false;
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                Cursor c = db.rawQuery("SELECT url, created_at, qq FROM " + fromTable + " WHERE id=?", new String[]{String.valueOf(id)});
                if (!c.moveToFirst()) {
                    c.close();
                    return false;
                }
                String url = c.getString(0);
                long createdAt = c.getLong(1);
                String qq = c.getString(2);
                c.close();

                ContentValues cv = new ContentValues();
                cv.put("id", id);
                cv.put("url", url);
                cv.put("created_at", createdAt);
                cv.put("qq", qq == null ? "" : qq);
                long inserted = db.insertWithOnConflict(toTable, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                if (inserted >= 0) {
                    db.delete(fromTable, "id=?", new String[]{String.valueOf(id)});
                    markDatabaseDirty();
                    return true;
                }
                return false;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "moveImage error", e);
            return false;
        }
    }

    /** 审核待审核图片：status=1 移动到通过表，status=2 移动到未通过表（都不删除） */
    public boolean auditImage(String url, int status) {
        String to = status == 1 ? "images_approved" : "images_rejected";
        long id = findImageRowId("images_pending", url);
        if (id < 0) return false;
        return moveImage("images_pending", to, id);
    }

    /** 未通过 → 通过（管理员在未通过管理页操作） */
    public boolean recoverImage(String url) {
        long id = findImageRowId("images_rejected", url);
        if (id < 0) return false;
        return moveImage("images_rejected", "images_approved", id);
    }

    public long getImageCount() {
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM images_approved", null);
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
                markDatabaseDirty();
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
                // 不在此处标记脏数据，避免备份配置的写入触发循环
                return null;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "setConfig error", e);
        }
    }

    public String getConfig(String k) {
        try {
            SQLiteDatabase db = getSharedDb();
            Cursor c = db.rawQuery("SELECT v FROM config WHERE k=?", new String[]{k});
            String v = null;
            if (c.moveToFirst()) v = c.getString(0);
            c.close();
            return v;
        } catch (Exception e) {
            // 外部库尚未授权（新装/重装后 MANAGE_EXTERNAL_STORAGE 未开）时不能让启动路径崩溃
            Log.w("DatabaseHelper", "getConfig skipped: " + e.getMessage());
            return null;
        }
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
                if (rows > 0) markDatabaseDirty();
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
                markDatabaseDirty();
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
                if (rows > 0) markDatabaseDirty();
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

    /**
     * 读取指定 QQ 的封禁原因，未封禁时返回 null。
     * 供 OAuth 回调把原因透传给前端，让用户在封禁页看到自己被禁的具体理由。
     */
    public String getBanReason(String qq) {
        if (qq == null) return null;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery("SELECT reason FROM banned_users WHERE qq=?", new String[]{qq});
        String reason = c.moveToFirst() ? c.getString(0) : null;
        c.close();
        return reason;
    }

    public String listBannedUsersJson(String filterQq) {
        SQLiteDatabase db = getSharedDb();
        String sql = "SELECT qq, reason, banned_at FROM banned_users";
        if (filterQq != null && !filterQq.isEmpty()) sql += " WHERE qq=?";
        sql += " ORDER BY banned_at DESC";
        Cursor c = db.rawQuery(sql, filterQq != null && !filterQq.isEmpty() ? new String[]{filterQq} : null);
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

    // ==================== 用户个人偏好 ====================

    /**
     * 读取指定用户的个人偏好。
     * 无记录时返回空对象（键均缺省），由前端沿用本地默认值。
     */
    public JSONObject getUserSettings(String qq) {
        JSONObject settings = new JSONObject();
        if (qq == null || qq.isEmpty()) return settings;
        SQLiteDatabase db = getSharedDb();
        Cursor c = db.rawQuery(
            "SELECT theme_preset, font_size, font_family, dark, updated_at FROM user_settings WHERE qq=?",
            new String[]{qq}
        );
        if (c.moveToFirst()) {
            try {
                if (!c.isNull(0)) settings.put("theme_preset", c.getString(0));
                if (!c.isNull(1)) settings.put("font_size", c.getInt(1));
                if (!c.isNull(2)) settings.put("font_family", c.getString(2));
                if (!c.isNull(3)) settings.put("dark", c.getInt(3));
                settings.put("updated_at", c.getLong(4));
            } catch (Exception e) {
                Log.e("DatabaseHelper", "getUserSettings error", e);
            }
        }
        c.close();
        return settings;
    }

    /**
     * 整体保存指定用户的个人偏好（upsert）。
     * settings 中的键可为 theme_preset / font_size / font_family / dark，缺省键不参与写入。
     */
    public void setUserSettings(String qq, JSONObject settings) {
        if (qq == null || qq.isEmpty()) return;
        try {
            WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                ContentValues cv = new ContentValues();
                // qq 是主键，必须先写入，否则每次落盘的都是 qq=NULL 的孤儿行，按 qq 永远查不到
                cv.put("qq", qq);
                if (settings != null) {
                    if (settings.has("theme_preset")) cv.put("theme_preset", settings.isNull("theme_preset") ? null : settings.getString("theme_preset"));
                    if (settings.has("font_size")) cv.put("font_size", settings.isNull("font_size") ? null : settings.getInt("font_size"));
                    if (settings.has("font_family")) cv.put("font_family", settings.isNull("font_family") ? null : settings.getString("font_family"));
                    if (settings.has("dark")) cv.put("dark", settings.isNull("dark") ? null : settings.getInt("dark"));
                }
                cv.put("updated_at", System.currentTimeMillis());
                db.insertWithOnConflict("user_settings", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
                // 清理旧版本写入的 qq=NULL 孤儿行（无主键归属，无法被任何用户命中）
                db.delete("user_settings", "qq IS NULL", null);
                markDatabaseDirty();
                return null;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "setUserSettings error", e);
        }
    }

    /** 删除指定用户的所有个人偏好（移除用户时调用） */
    public boolean deleteUserSettings(String qq) {
        if (qq == null || qq.isEmpty()) return false;
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int rows = db.delete("user_settings", "qq=?", new String[]{qq});
                if (rows > 0) markDatabaseDirty();
                return rows > 0;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "deleteUserSettings error", e);
            return false;
        }
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
     * 手动清理所有未通过图片记录（仅管理员触发，审核拒绝不会自动删除），返回删除数量
     */
    public int cleanupRejectedImages() {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int deleted = db.delete("images_rejected", null, null);
                if (deleted > 0) markDatabaseDirty();
                return deleted;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "cleanupRejectedImages error", e);
            return 0;
        }
    }

    // ==================== 日志自动清理 ====================

    /**
     * 清空所有请求日志（api_requests 表），返回删除行数。
     * 每天凌晨 4 点由 KeepAliveService 调用。
     */
    public int cleanupRequestLogs() {
        try {
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                int deleted = db.delete("api_requests", null, null);
                Log.i("DatabaseHelper", "Cleaned up " + deleted + " request log entries");
                return deleted;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "cleanupRequestLogs error", e);
            return 0;
        }
    }

    /**
     * 清理超过保留天数的每日统计数据（api_stats_daily 表），返回删除行数。
     * 每天凌晨 4 点由 KeepAliveService 调用。
     * @param retentionDays 保留天数，默认 30 天
     */
    public int cleanupOldDailyStats(int retentionDays) {
        if (retentionDays < 1) retentionDays = 30;
        try {
            final int days = retentionDays;
            return WriteQueue.submit(() -> {
                SQLiteDatabase db = getSharedDb();
                // 计算截止日期：今天往前推 retentionDays 天
                Calendar cal = Calendar.getInstance();
                cal.add(Calendar.DAY_OF_MONTH, -days);
                String cutoffDay = formatDay(cal.getTimeInMillis());
                int deleted = db.delete("api_stats_daily", "day < ?", new String[]{cutoffDay});
                Log.i("DatabaseHelper", "Cleaned up " + deleted + " daily stats older than " + cutoffDay);
                return deleted;
            }).get();
        } catch (Exception e) {
            Log.e("DatabaseHelper", "cleanupOldDailyStats error", e);
            return 0;
        }
    }

    // ==================== 数据库备份追踪 ====================

    /**
     * 标记数据库已被修改（在每次写操作后调用）。
     * 设置 config 中的 last_db_change_ts 为当前时间戳。
     */
    private void markDatabaseDirty() {
        try {
            SQLiteDatabase db = getSharedDb();
            ContentValues cv = new ContentValues();
            cv.put("k", "last_db_change_ts");
            cv.put("v", String.valueOf(System.currentTimeMillis()));
            db.insertWithOnConflict("config", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
        } catch (Exception e) {
            Log.e("DatabaseHelper", "markDatabaseDirty error", e);
        }
    }

    private static long parseLong(String s, long def) {
        if (s == null || s.isEmpty()) return def;
        try { return Long.parseLong(s); } catch (NumberFormatException e) { return def; }
    }
}
