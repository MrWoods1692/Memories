package com.example.memories;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * 国内厂商 ROM 自动启动权限引导。
 * 很多国产系统（MIUI、EMUI、ColorOS、Funtouch OS 等）即使声明了
 * RECEIVE_BOOT_COMPLETED，仍需用户手动在系统设置中开启"自启动"。
 * 本工具类尝试跳转到各厂商的自动启动管理页面。
 */
public class AutoStartHelper {
    private static final String TAG = "AutoStartHelper";

    /**
     * 尝试跳转到当前系统的自动启动权限管理页面。
     * 建议在 MainActivity.onCreate 中调用。
     * @return true 表示已尝试跳转，false 表示无法识别当前 ROM
     */
    public static boolean tryOpenAutoStartSettings(Activity activity) {
        String manufacturer = Build.MANUFACTURER != null
                ? Build.MANUFACTURER.toLowerCase() : "";
        Log.i(TAG, "Device manufacturer: " + manufacturer);

        Intent intent = null;

        if (manufacturer.contains("xiaomi") || manufacturer.contains("redmi")) {
            // 小米 / Redmi
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"));
        } else if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
            // 华为 / 荣耀
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
        } else if (manufacturer.contains("oppo") || manufacturer.contains("oneplus")
                || manufacturer.contains("realme")) {
            // OPPO / 一加 / realme
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
        } else if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
            // vivo / iQOO
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"));
            intent.putExtra("packagename", activity.getPackageName());
        } else if (manufacturer.contains("samsung")) {
            // 三星
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.samsung.android.sm_cn",
                    "com.samsung.android.sm_cn.ui.ProcessManageActivity"));
        } else if (manufacturer.contains("meizu")) {
            // 魅族
            intent = new Intent();
            intent.setComponent(new ComponentName(
                    "com.meizu.safe",
                    "com.meizu.safe.security.AppAutoRunSettingActivity"));
        }

        if (intent != null) {
            try {
                activity.startActivity(intent);
                Log.i(TAG, "Opened autostart settings for " + manufacturer);
                return true;
            } catch (Exception e) {
                Log.w(TAG, "Failed to open autostart settings for " + manufacturer, e);
            }
        }

        Log.i(TAG, "No known autostart settings page for this ROM");
        return false;
    }
}
