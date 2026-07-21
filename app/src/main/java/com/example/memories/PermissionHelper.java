package com.example.memories;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.role.RoleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

/**
 * 全面的权限请求助手。
 *
 * 覆盖国产手机（vivo/OPPO/华为/小米等）上所有可能需要手动开启的权限：
 * - 基础运行时权限（摄像头、麦克风、定位、存储等）
 * - 特殊权限（悬浮窗、电池优化、修改系统设置、通知等）
 * - 厂商 ROM 特定权限（自启动、关联启动、锁屏显示等）
 * - 无障碍服务权限（保活关键）
 *
 * 使用示例：
 *   PermissionHelper.requestAllPermissions(activity);
 *   PermissionHelper.requestAccessibilityPermission(activity);
 */
public class PermissionHelper {
    private static final String TAG = "PermissionHelper";

    // ================================================================
    // 运行时权限组（需要在代码中动态申请）
    // ================================================================

    /** Android 13+ 需要分别请求的通知权限 */
    public static final String PERMISSION_NOTIFICATIONS = Manifest.permission.POST_NOTIFICATIONS;

    /** 摄像头权限 */
    public static final String PERMISSION_CAMERA = Manifest.permission.CAMERA;

    /** 麦克风权限 */
    public static final String PERMISSION_RECORD_AUDIO = Manifest.permission.RECORD_AUDIO;

    /** 定位权限（精确） */
    public static final String PERMISSION_FINE_LOCATION = Manifest.permission.ACCESS_FINE_LOCATION;

    /** 定位权限（粗略） */
    public static final String PERMISSION_COARSE_LOCATION = Manifest.permission.ACCESS_COARSE_LOCATION;

    /** 后台定位（Android 10+） */
    public static final String PERMISSION_BACKGROUND_LOCATION = Manifest.permission.ACCESS_BACKGROUND_LOCATION;

    /** 读取存储（Android 12 及以下） */
    public static final String PERMISSION_READ_STORAGE = Manifest.permission.READ_EXTERNAL_STORAGE;

    /** 附近设备 - 蓝牙连接 (Android 12+) */
    public static final String PERMISSION_BLUETOOTH_CONNECT = Manifest.permission.BLUETOOTH_CONNECT;

    /** 附近设备 - 蓝牙扫描 (Android 12+) */
    public static final String PERMISSION_BLUETOOTH_SCAN = Manifest.permission.BLUETOOTH_SCAN;

    /** 附近设备 - Wi-Fi 附近设备 (Android 13+) */
    public static final String PERMISSION_NEARBY_WIFI_DEVICES = Manifest.permission.NEARBY_WIFI_DEVICES;

    /** 读取电话号码/设备信息（呼叫转移需要） */
    public static final String PERMISSION_READ_PHONE_STATE = Manifest.permission.READ_PHONE_STATE;

    // ================================================================
    // 运行时权限请求码
    // ================================================================
    public static final int REQ_RUNTIME_ALL = 2001;
    public static final int REQ_NOTIFICATIONS = 2002;
    public static final int REQ_CAMERA_MIC = 2003;
    public static final int REQ_LOCATION = 2004;
    public static final int REQ_STORAGE = 2005;
    public static final int REQ_NEARBY = 2006;

    // ================================================================
    // 特殊权限（通过 Settings Intent 跳转）
    // ================================================================
    public static final int REQ_OVERLAY = 2101;
    public static final int REQ_WRITE_SETTINGS = 2102;
    public static final int REQ_BATTERY_OPTIMIZATION = 2103;
    public static final int REQ_USAGE_STATS = 2104;
    public static final int REQ_INSTALL_UNKNOWN_APP = 2105;
    public static final int REQ_ACCESSIBILITY = 2106;
    public static final int REQ_NOTIFICATION_LISTENER = 2107;
    public static final int REQ_ALARM_EXACT = 2108;

    // ================================================================
    // 检查方法
    // ================================================================

    /** 检查通知权限是否已授权 */
    public static boolean hasNotificationPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ctx.checkSelfPermission(PERMISSION_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true; // Android 12 及以下默认有通知权限
    }

    /** 检查摄像头权限 */
    public static boolean hasCameraPermission(Context ctx) {
        return ctx.checkSelfPermission(PERMISSION_CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** 检查麦克风权限 */
    public static boolean hasRecordAudioPermission(Context ctx) {
        return ctx.checkSelfPermission(PERMISSION_RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** 检查定位权限 */
    public static boolean hasLocationPermission(Context ctx) {
        return ctx.checkSelfPermission(PERMISSION_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
            || ctx.checkSelfPermission(PERMISSION_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** 检查后台定位权限 (Android 10+) */
    public static boolean hasBackgroundLocationPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return ctx.checkSelfPermission(PERMISSION_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return hasLocationPermission(ctx);
    }

    /** 检查存储权限 */
    public static boolean hasStoragePermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ 使用 MANAGE_EXTERNAL_STORAGE
            return android.os.Environment.isExternalStorageManager();
        } else {
            return ctx.checkSelfPermission(PERMISSION_READ_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }
    }

    /** 检查悬浮窗权限 */
    public static boolean hasOverlayPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(ctx);
        }
        return true;
    }

    /** 检查修改系统设置权限 */
    public static boolean hasWriteSettingsPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.System.canWrite(ctx);
        }
        return true;
    }

    /** 检查电池优化白名单 */
    public static boolean hasBatteryOptimizationPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        }
        return true;
    }

    /** 检查安装未知应用权限 (Android 8+) */
    public static boolean hasInstallUnknownAppPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return ctx.getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    /** 检查无障碍服务是否已启用 */
    public static boolean hasAccessibilityPermission(Context ctx) {
        return MemoriesAccessibilityService.isAccessibilityServiceEnabled(ctx);
    }

    /** 检查通知监听权限 */
    public static boolean hasNotificationListenerPermission(Context ctx) {
        String flat = Settings.Secure.getString(ctx.getContentResolver(),
                "enabled_notification_listeners");
        if (flat == null) return false;
        return flat.contains(ctx.getPackageName());
    }

    /** 检查精确闹钟权限 (Android 12+) */
    public static boolean hasExactAlarmPermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        }
        return true;
    }

    /** 检查附近设备权限 (蓝牙) */
    public static boolean hasNearbyDevicePermission(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ctx.checkSelfPermission(PERMISSION_BLUETOOTH_CONNECT)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true; // Android 11 及以下使用位置权限
    }

    // ================================================================
    // 权限请求方法
    // ================================================================

    /**
     * 请求所有运行时权限（一次性弹窗）。
     * 建议在首次启动时调用。
     */
    public static void requestAllRuntimePermissions(Activity activity) {
        java.util.ArrayList<String> permissions = new java.util.ArrayList<>();

        // 通知（Android 13+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!hasNotificationPermission(activity)) {
                permissions.add(PERMISSION_NOTIFICATIONS);
            }
        }

        // 摄像头
        if (!hasCameraPermission(activity)) {
            permissions.add(PERMISSION_CAMERA);
        }

        // 麦克风
        if (!hasRecordAudioPermission(activity)) {
            permissions.add(PERMISSION_RECORD_AUDIO);
        }

        // 定位
        if (!hasLocationPermission(activity)) {
            permissions.add(PERMISSION_FINE_LOCATION);
            permissions.add(PERMISSION_COARSE_LOCATION);
        }

        // 后台定位（Android 10+，单独申请）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (!hasBackgroundLocationPermission(activity) && hasLocationPermission(activity)) {
                permissions.add(PERMISSION_BACKGROUND_LOCATION);
            }
        }

        // 存储（Android 12 及以下）
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.S_V2) {
            if (activity.checkSelfPermission(PERMISSION_READ_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                permissions.add(PERMISSION_READ_STORAGE);
            }
        }

        // 附近设备（蓝牙，Android 12+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (!hasNearbyDevicePermission(activity)) {
                permissions.add(PERMISSION_BLUETOOTH_CONNECT);
                permissions.add(PERMISSION_BLUETOOTH_SCAN);
            }
        }

        // 读取电话状态
        if (activity.checkSelfPermission(PERMISSION_READ_PHONE_STATE)
                != PackageManager.PERMISSION_GRANTED) {
            permissions.add(PERMISSION_READ_PHONE_STATE);
        }

        if (!permissions.isEmpty()) {
            activity.requestPermissions(
                permissions.toArray(new String[0]), REQ_RUNTIME_ALL);
        }
    }

    /**
     * 请求所有特殊权限（每个都会跳转到系统设置页面）。
     * 建议在权限引导页面中逐个引导用户开启。
     *
     * @return 返回仍需要开启的权限数量
     */
    public static int requestAllSpecialPermissions(Activity activity) {
        int pendingCount = 0;

        // 1. 悬浮窗权限
        if (!hasOverlayPermission(activity)) {
            pendingCount++;
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, REQ_OVERLAY);
            } catch (Exception e) {
                Log.w(TAG, "Failed to open overlay settings", e);
            }
        }

        // 2. 修改系统设置
        if (!hasWriteSettingsPermission(activity)) {
            pendingCount++;
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                    Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, REQ_WRITE_SETTINGS);
            } catch (Exception e) {
                Log.w(TAG, "Failed to open write settings", e);
            }
        }

        // 3. 电池优化白名单
        if (!hasBatteryOptimizationPermission(activity)) {
            pendingCount++;
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, REQ_BATTERY_OPTIMIZATION);
            } catch (Exception e) {
                Log.w(TAG, "Failed to open battery optimization", e);
            }
        }

        // 4. 安装未知应用 (Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !hasInstallUnknownAppPermission(activity)) {
            pendingCount++;
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, REQ_INSTALL_UNKNOWN_APP);
            } catch (Exception e) {
                Log.w(TAG, "Failed to open unknown app sources", e);
            }
        }

        // 5. 精确闹钟 (Android 12+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasExactAlarmPermission(activity)) {
            pendingCount++;
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + activity.getPackageName()));
                activity.startActivityForResult(intent, REQ_ALARM_EXACT);
            } catch (Exception e) {
                Log.w(TAG, "Failed to open exact alarm settings", e);
            }
        }

        return pendingCount;
    }

    /**
     * 请求无障碍权限（跳转到系统无障碍设置页）。
     * 这是保活的关键 - 参考向日葵远程控制的做法。
     */
    public static void requestAccessibilityPermission(Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            activity.startActivityForResult(intent, REQ_ACCESSIBILITY);
        } catch (Exception e) {
            Log.w(TAG, "Failed to open accessibility settings", e);
        }
    }

    /**
     * 请求通知监听权限
     */
    public static void requestNotificationListenerPermission(Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            activity.startActivityForResult(intent, REQ_NOTIFICATION_LISTENER);
        } catch (Exception e) {
            Log.w(TAG, "Failed to open notification listener settings", e);
        }
    }

    /**
     * 请求完全存储访问权限 (Android 11+ MANAGE_EXTERNAL_STORAGE)
     */
    public static void requestManageStoragePermission(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!android.os.Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                        Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivityForResult(intent, REQ_STORAGE);
                } catch (Exception e) {
                    // 降级到通用管理页面
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        activity.startActivityForResult(intent, REQ_STORAGE);
                    } catch (Exception e2) {
                        Log.w(TAG, "Failed to open storage settings", e2);
                    }
                }
            }
        }
    }

    /**
     * 跳转到厂商自启动管理页面
     */
    public static boolean openAutoStartSettings(Activity activity) {
        return AutoStartHelper.tryOpenAutoStartSettings(activity);
    }

    /**
     * 跳转到应用详情页（用户可手动管理所有权限）
     */
    public static void openAppInfoSettings(Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "Failed to open app info settings", e);
        }
    }

    /**
     * 跳转到电池优化设置（应用列表页）
     */
    public static void openBatteryOptimizationSettings(Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "Failed to open battery optimization settings", e);
        }
    }

    /**
     * 跳转到开发者选项（部分 ROM 在这里有"后台进程限制"等设置）
     */
    public static void openDeveloperSettings(Activity activity) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS);
            activity.startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "Failed to open developer settings", e);
        }
    }

    /**
     * 获取所有权限状态的摘要字符串
     */
    public static String getPermissionSummary(Context ctx) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== 权限状态 ===\n");
        sb.append("通知: ").append(hasNotificationPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("摄像头: ").append(hasCameraPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("麦克风: ").append(hasRecordAudioPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("定位: ").append(hasLocationPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("后台定位: ").append(hasBackgroundLocationPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("存储: ").append(hasStoragePermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("悬浮窗: ").append(hasOverlayPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("修改系统设置: ").append(hasWriteSettingsPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("电池优化白名单: ").append(hasBatteryOptimizationPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("安装未知应用: ").append(hasInstallUnknownAppPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("精确闹钟: ").append(hasExactAlarmPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("附近设备: ").append(hasNearbyDevicePermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("无障碍服务: ").append(hasAccessibilityPermission(ctx) ? "✓" : "✗").append("\n");
        sb.append("通知监听: ").append(hasNotificationListenerPermission(ctx) ? "✓" : "✗").append("\n");
        return sb.toString();
    }
}
