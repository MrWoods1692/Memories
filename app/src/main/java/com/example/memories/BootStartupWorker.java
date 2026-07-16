package com.example.memories;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * 开机自启 Worker：通过 WorkManager 合规启动前台服务。
 * Android 12+ 不允许从后台直接 startForegroundService，
 * 必须通过 WorkManager.setExpedited() + setForegroundAsync() 唤醒。
 */
public class BootStartupWorker extends Worker {
    private static final String TAG = "BootStartupWorker";
    private static final String CHANNEL_ID = "boot_startup_channel";
    private static final int NOTIFICATION_ID = 999;

    public BootStartupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.i(TAG, "Boot startup worker running");

        // Android 12+ 必须先将自己提升为前台服务，才能合规启动其他前台服务
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                setForegroundAsync(createForegroundInfo());
            } catch (Exception e) {
                Log.e(TAG, "Failed to promote to foreground", e);
            }
        }

        Context context = getApplicationContext();

        // 启动主服务
        try {
            Intent svc = new Intent(context, ServerService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
            Log.i(TAG, "ServerService started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ServerService", e);
        }

        // 启动悬浮窗
        try {
            Intent fw = new Intent(context, FloatingWindow.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(fw);
            } else {
                context.startService(fw);
            }
            Log.i(TAG, "FloatingWindow started");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start FloatingWindow", e);
        }

        return Result.success();
    }

    private ForegroundInfo createForegroundInfo() {
        // 创建通知渠道（Android 8+ 必须）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "开机自启",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getApplicationContext()
                    .getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }

        Notification notification = new Notification.Builder(getApplicationContext(), CHANNEL_ID)
                .setContentTitle("Memories 启动中")
                .setContentText("正在启动服务...")
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setOngoing(true)
                .build();

        return new ForegroundInfo(NOTIFICATION_ID, notification);
    }
}
