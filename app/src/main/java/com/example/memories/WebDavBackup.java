package com.example.memories;

import android.util.Log;

import com.github.sardine.Sardine;
import com.github.sardine.SardineFactory;

import java.io.File;
import java.io.FileInputStream;

public class WebDavBackup {
    private static final String TAG = "WebDavBackup";

    public static boolean uploadFile(String webdavUrl, String username, String password, File file, String remotePath) {
        try {
            Sardine sardine;
            if (username != null && password != null) {
                sardine = SardineFactory.begin(username, password);
            } else {
                sardine = SardineFactory.begin();
            }

            String dest = webdavUrl;
            if (!dest.endsWith("/")) dest += "/";
            dest += remotePath;

            FileInputStream fis = new FileInputStream(file);
            sardine.put(dest, fis);
            fis.close();
            return true;
        } catch (Throwable e) {
            // Throwable 捕获 Error（如 NoSuchFieldError），防止 Sardine/Apache HTTP 库崩溃导致进程退出
            Log.e(TAG, "WebDAV upload failed", e);
            return false;
        }
    }
}
