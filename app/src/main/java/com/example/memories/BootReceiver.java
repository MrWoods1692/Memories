package com.example.memories;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Log;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";
    private static final String BOOT_WORK_NAME = "memories_boot_startup";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        // 开机自启：BOOT_COMPLETED, LOCKED_BOOT_COMPLETED, QUICKBOOT_POWERON
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            Log.i(TAG, "Boot event received: " + action);

            // 自动打开 WiFi
            tryEnableWifi(context);

            // Android 12+ 必须通过 WorkManager 启动前台服务，否则会抛
            // ForegroundServiceStartNotAllowedException
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                scheduleBootWork(context);
            } else {
                startServicesDirectly(context);
            }
        }
    }

    /** Android 12+ 合规方式：通过 WorkManager 唤醒 */
    private void scheduleBootWork(Context context) {
        try {
            OneTimeWorkRequest workRequest = new OneTimeWorkRequest.Builder(BootStartupWorker.class)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .addTag(BOOT_WORK_NAME)
                    .build();
            WorkManager.getInstance(context)
                    .enqueueUniqueWork(BOOT_WORK_NAME, ExistingWorkPolicy.REPLACE, workRequest);
            Log.i(TAG, "Boot work scheduled via WorkManager");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule boot work, fallback to direct start", e);
            // WorkManager 不可用时降级为直接启动（部分旧设备可能仍可用）
            startServicesDirectly(context);
        }
    }

    /** Android 11 及以下：直接启动前台服务 */
    private void startServicesDirectly(Context context) {
        try {
            // 启动主服务
            Intent svc = new Intent(context, ServerService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
            Log.i(TAG, "ServerService started directly");

            // 启动悬浮窗
            Intent fw = new Intent(context, FloatingWindow.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(fw);
            } else {
                context.startService(fw);
            }
            Log.i(TAG, "FloatingWindow started directly");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start services directly", e);
        }
    }

    private void tryEnableWifi(Context context) {
        try {
            WifiManager wifi = (WifiManager) context.getApplicationContext()
                    .getSystemService(Context.WIFI_SERVICE);
            if (wifi != null && !wifi.isWifiEnabled()) {
                wifi.setWifiEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}
