package com.mrcwoods.memories;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class LocalStore {
    private static final String PREFS = "memories_store";
    private final SharedPreferences prefs;

    public LocalStore(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public SharedPreferences prefs() {
        return prefs;
    }

    public UserSession loadSession() {
        String raw = prefs.getString("session", "");
        if (raw.isEmpty()) {
            return new UserSession();
        }
        try {
            return UserSession.fromJson(new JSONObject(raw));
        } catch (Exception ignored) {
            return new UserSession();
        }
    }

    public void saveSession(UserSession session) {
        prefs.edit().putString("session", session.toJson().toString()).apply();
    }

    public void clearSession() {
        prefs.edit().remove("session").apply();
    }

    public void appendUploadRecord(String url) {
        JSONArray records = getArray("upload_records");
        JSONObject item = new JSONObject();
        try {
            item.put("url", url);
            item.put("time", System.currentTimeMillis());
            records.put(item);
        } catch (Exception ignored) {
        }
        prefs.edit().putString("upload_records", records.toString()).apply();
    }

    public void saveImageUrlCache(List<ImageItem> items) {
        JSONArray array = new JSONArray();
        for (ImageItem item : items) {
            JSONObject json = new JSONObject();
            try {
                json.put("id", item.id);
                json.put("url", item.url);
                json.put("uploaded_at", item.uploadedAt);
                array.put(json);
            } catch (Exception ignored) {
            }
        }
        prefs.edit().putString("image_url_cache", array.toString()).apply();
    }

    public List<ImageItem> loadImageUrlCache() {
        JSONArray array = getArray("image_url_cache");
        List<ImageItem> items = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) {
            JSONObject json = array.optJSONObject(index);
            if (json != null) {
                items.add(new ImageItem(json.optLong("id"), json.optString("url"), json.optInt("status", 0), json.optLong("uploaded_at")));
            }
        }
        return items;
    }

    public long preferenceBytes(String key) {
        String value = prefs.getString(key, "");
        return value == null ? 0 : value.getBytes().length;
    }

    public void clearKey(String key) {
        prefs.edit().remove(key).apply();
    }

    public String downloadFolderUri() {
        return prefs.getString("download_folder_uri", "");
    }

    public void saveDownloadFolderUri(String uri) {
        prefs.edit().putString("download_folder_uri", uri == null ? "" : uri).apply();
    }

    public void saveUploadTasks(List<UploadTask> tasks) {
        prefs.edit().putString("upload_tasks", UploadTask.toJsonArray(tasks).toString()).apply();
    }

    public List<UploadTask> loadUploadTasks() {
        JSONArray array = getArray("upload_tasks");
        return UploadTask.fromJsonArray(array);
    }

    private JSONArray getArray(String key) {
        try {
            return new JSONArray(prefs.getString(key, "[]"));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }
}