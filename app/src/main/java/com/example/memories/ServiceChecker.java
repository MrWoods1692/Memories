package com.example.memories;

import android.app.ActivityManager;
import android.content.Context;
import android.util.Log;

/**
 * 服务存活检查工具类。
 * 通过 ActivityManager 检查指定服务是否正在运行。
 */
public class ServiceChecker {
    private static final String TAG = "ServiceChecker";

    /**
     * 检查指定服务是否正在运行。
     * @param context 上下文
     * @param serviceClass 要检查的服务类
     * @return true 表示服务正在运行
     */
    public static boolean isServiceRunning(Context context, Class<?> serviceClass) {
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;

        try {
            for (ActivityManager.RunningServiceInfo service : am.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to check service status", e);
        }
        return false;
    }
}
