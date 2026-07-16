package com.example.memories;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

public class DatabaseHelper extends SQLiteOpenHelper {
    private static final String DB_NAME = "memories.db";
    private static final int DB_VERSION = 1;

    public DatabaseHelper(Context ctx) {
        super(ctx, DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE images (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, status INTEGER DEFAULT 0, created_at INTEGER)");
        db.execSQL("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, qq TEXT, role INTEGER)");
        db.execSQL("CREATE TABLE config (k TEXT PRIMARY KEY, v TEXT)");
        db.execSQL("CREATE TABLE banned_users (qq TEXT PRIMARY KEY, reason TEXT, banned_at INTEGER)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // noop for now
    }

    public long addImage(String url) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("url", url);
        cv.put("created_at", System.currentTimeMillis());
        return db.insert("images", null, cv);
    }

    public String listImagesJson() {
        SQLiteDatabase db = getReadableDatabase();
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
     * 分页查询图片列表
     * @param page 页码，从 1 开始
     * @param limit 每页条数，默认 20
     * @return JSON: {"items":[...], "total":N, "page":1, "limit":20, "totalPages":N}
     */
    public String listImagesPaginatedJson(int page, int limit) {
        if (page < 1) page = 1;
        if (limit < 1) limit = 20;
        int offset = (page - 1) * limit;

        SQLiteDatabase db = getReadableDatabase();

        // 查总数
        Cursor countCur = db.rawQuery("SELECT COUNT(*) FROM images", null);
        long total = 0;
        if (countCur.moveToFirst()) total = countCur.getLong(0);
        countCur.close();

        int totalPages = (int) Math.ceil((double) total / limit);

        // 查分页数据
        Cursor c = db.rawQuery(
            "SELECT id, url, status, created_at FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?",
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
        SQLiteDatabase db = getWritableDatabase();
        int rows = db.delete("images", "id=?", new String[]{String.valueOf(id)});
        return rows > 0;
    }

    public boolean updateImageStatus(long id, int status) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("status", status);
        int rows = db.update("images", cv, "id=?", new String[]{String.valueOf(id)});
        return rows > 0;
    }

    public long getImageCount() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT COUNT(*) FROM images", null);
        long cnt = 0;
        if (c.moveToFirst()) cnt = c.getLong(0);
        c.close();
        return cnt;
    }

    public void addUser(String qq, int role) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("qq", qq);
        cv.put("role", role);
        db.insertWithOnConflict("users", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public int getUserRole(String qq) {
        if (qq == null) return 0;
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT role FROM users WHERE qq=?", new String[]{qq});
        int role = 0;
        if (c.moveToFirst()) role = c.getInt(0);
        c.close();
        return role;
    }

    public String getConfigJson() {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT k, v FROM config", null);
        JSONObject o = new JSONObject();
        while (c.moveToNext()) {
            try { o.put(c.getString(0), c.getString(1)); } catch (Exception ignored) {}
        }
        c.close();
        return o.toString();
    }

    public void setConfig(String k, String v) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("k", k);
        cv.put("v", v);
        db.insertWithOnConflict("config", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public String getConfig(String k) {
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT v FROM config WHERE k=?", new String[]{k});
        String v = null;
        if (c.moveToFirst()) v = c.getString(0);
        c.close();
        return v;
    }

    public String listUsersJson() {
        SQLiteDatabase db = getReadableDatabase();
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
        SQLiteDatabase db = getWritableDatabase();
        int rows = db.delete("users", "qq=?", new String[]{qq});
        return rows > 0;
    }

    // --- 封禁用户管理 ---

    public void banUser(String qq, String reason) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues cv = new ContentValues();
        cv.put("qq", qq);
        cv.put("reason", reason != null ? reason : "");
        cv.put("banned_at", System.currentTimeMillis());
        db.insertWithOnConflict("banned_users", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public boolean unbanUser(String qq) {
        SQLiteDatabase db = getWritableDatabase();
        int rows = db.delete("banned_users", "qq=?", new String[]{qq});
        return rows > 0;
    }

    public boolean isUserBanned(String qq) {
        if (qq == null) return false;
        SQLiteDatabase db = getReadableDatabase();
        Cursor c = db.rawQuery("SELECT 1 FROM banned_users WHERE qq=?", new String[]{qq});
        boolean banned = c.moveToFirst();
        c.close();
        return banned;
    }

    public String listBannedUsersJson() {
        SQLiteDatabase db = getReadableDatabase();
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

    public String getDatabasePathString() {
        return getReadableDatabase().getPath();
    }

    // ==================== 数据库可视化管理 ====================

    /**
     * 列出所有用户表及其结构信息
     */
    public String listTablesJson() {
        SQLiteDatabase db = getReadableDatabase();
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

        SQLiteDatabase db = getReadableDatabase();

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

        SQLiteDatabase db = getReadableDatabase();
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
        SQLiteDatabase db = getReadableDatabase();
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
        SQLiteDatabase db = getWritableDatabase();
        try {
            db.beginTransaction();
            db.execSQL(sql);
            // 尝试获取影响行数（仅对 INSERT/UPDATE/DELETE 有效）
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
        SQLiteDatabase db = getWritableDatabase();
        int deleted = db.delete("images", "status=?", new String[]{"2"});
        return deleted;
    }
}
