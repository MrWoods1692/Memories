package com.mrcwoods.memories;

import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class UploadTask {
    public static final int WAITING = 0;
    public static final int UPLOADING = 1;
    public static final int DONE = 2;
    public static final int FAILED = 3;

    public final Uri uri;
    public int status = WAITING;
    public float progress;
    public String message = "等待上传";
    public String url = "";

    public UploadTask(Uri uri) {
        this.uri = uri;
    }

    public JSONObject toJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("uri", uri.toString());
            json.put("status", status);
            json.put("progress", (double) progress);
            json.put("message", message);
            json.put("url", url);
        } catch (Exception ignored) {
        }
        return json;
    }

    public static UploadTask fromJson(JSONObject json) {
        UploadTask task = new UploadTask(Uri.parse(json.optString("uri", "")));
        task.status = json.optInt("status", WAITING);
        task.progress = (float) json.optDouble("progress", 0);
        task.message = json.optString("message", "等待上传");
        task.url = json.optString("url", "");
        return task;
    }

    public static JSONArray toJsonArray(List<UploadTask> tasks) {
        JSONArray array = new JSONArray();
        for (UploadTask task : tasks) {
            array.put(task.toJson());
        }
        return array;
    }

    public static List<UploadTask> fromJsonArray(JSONArray array) {
        List<UploadTask> tasks = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            JSONObject json = array.optJSONObject(i);
            if (json != null) {
                tasks.add(fromJson(json));
            }
        }
        return tasks;
    }
}