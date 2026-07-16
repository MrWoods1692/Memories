package com.example.memories;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

/** 悬浮窗服务：显示一个小图标，点击快速打开 App */
public class FloatingWindow extends Service {
    private WindowManager windowManager;
    private ImageView floatView;
    private static final String CHANNEL_ID = "floating_channel";
    private static final int NOTIFICATION_ID = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 前台服务通知（Android 5 秒规则：必须在 onCreate 中尽早调用）
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, openIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Memories 悬浮窗")
                .setContentText("点击悬浮图标快速打开管理面板")
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
        startForeground(NOTIFICATION_ID, n);

        // 创建悬浮窗（需要 SYSTEM_ALERT_WINDOW 权限）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                && !android.provider.Settings.canDrawOverlays(this)) {
            Log.w("FloatingWindow", "No overlay permission, skipping float view");
            return;
        }
        createFloatView();
    }

    private void createFloatView() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        floatView = new ImageView(this);
        floatView.setImageResource(android.R.drawable.ic_menu_manage);
        floatView.setPadding(8, 8, 8, 8);
        floatView.setBackgroundColor(0xCC6366F1);
        floatView.setColorFilter(0xFFFFFFFF);

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        params.x = 16;
        params.y = 0;

        floatView.setOnClickListener(v -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        });

        floatView.setOnLongClickListener(v -> {
            stopSelf();
            Toast.makeText(this, "悬浮窗已关闭", Toast.LENGTH_SHORT).show();
            return true;
        });

        try {
            windowManager.addView(floatView, params);
        } catch (Exception e) {
            Log.w("FloatingWindow", "Failed to add float view", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 如果悬浮窗被系统移除，且权限允许，重新创建
        if (floatView == null || (windowManager != null && !floatView.isAttachedToWindow())) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    && !android.provider.Settings.canDrawOverlays(this)) {
                Log.w("FloatingWindow", "No overlay permission, cannot recreate float view");
            } else {
                try {
                    if (floatView != null && windowManager != null) {
                        windowManager.removeView(floatView);
                    }
                } catch (Exception ignored) {}
                createFloatView();
            }
        }
        // 自动打开 WiFi
        try {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wifi != null && !wifi.isWifiEnabled()) {
                wifi.setWifiEnabled(true);
            }
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // App 被划掉后自动重启
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+：通过 WorkManager 合规重启，避免 ForegroundServiceStartNotAllowedException
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(BootStartupWorker.class)
                    .setInitialDelay(1, TimeUnit.SECONDS)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .addTag("memories_restart")
                    .build();
            WorkManager.getInstance(this)
                    .enqueueUniqueWork("memories_restart", ExistingWorkPolicy.REPLACE, work);
            Log.i("FloatingWindow", "Restart scheduled via WorkManager");
        } else {
            // Android 11 及以下：AlarmManager 直接重启
            Intent restartIntent = new Intent(getApplicationContext(), FloatingWindow.class);
            PendingIntent pi = PendingIntent.getService(
                getApplicationContext(), 0, restartIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
            );
            android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) {
                am.set(android.app.AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pi);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatView != null && windowManager != null) {
            try { windowManager.removeView(floatView); } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "悬浮窗", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
