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

    public String getDatabasePathString() {
        return getReadableDatabase().getPath();
    }
}
