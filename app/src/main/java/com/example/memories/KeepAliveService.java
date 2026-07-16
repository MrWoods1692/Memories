package com.example.memories;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * 周期性保活看门狗服务。
 * 每 15 分钟通过 AlarmManager 唤醒自己，检查主服务和悬浮窗是否存活，
 * 如果未运行则自动重启它们。
 *
 * 设计要点：
 * 1. 本服务本身也作为前台服务运行，具有少量通知（或不显示通知）
 * 2. 使用 AlarmManager.setInexactRepeating 降低电量消耗
 * 3. 每次唤醒时检查 ServerService 和 FloatingWindow 是否存活
 */
public class KeepAliveService extends Service {
    private static final String TAG = "KeepAliveService";
    private static final String CHANNEL_ID = "keepalive_channel";
    private static final int NOTIFICATION_ID = 999;
    private static final long KEEP_ALIVE_INTERVAL_MS = 15 * 60 * 1000L; // 15 分钟
    private static final String ALARM_ACTION = "com.example.memories.KEEP_ALIVE";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 低调的前台通知（不打扰用户）
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, openIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification n;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            n = new Notification.Builder(this, CHANNEL_ID)
                    .setContentTitle("Memories")
                    .setContentText("服务保活中")
                    .setSmallIcon(android.R.drawable.ic_menu_manage)
                    .setOngoing(true)
                    .setContentIntent(pi)
                    .setPriority(Notification.PRIORITY_MIN) // 最低优先级，不显示图标在状态栏
                    .build();
        } else {
            n = new Notification.Builder(this)
                    .setContentTitle("Memories")
                    .setContentText("服务保活中")
                    .setSmallIcon(android.R.drawable.ic_menu_manage)
                    .setOngoing(true)
                    .setContentIntent(pi)
                    .setPriority(Notification.PRIORITY_MIN)
                    .build();
        }
        startForeground(NOTIFICATION_ID, n);

        // 设置周期性唤醒
        scheduleKeepAlive(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Keep-alive check triggered");

        // 检查并重启各个服务
        checkAndRestartServices();

        // 确保周期性闹钟仍在
        scheduleKeepAlive(this);

        return START_STICKY;
    }

    /** 检查各服务是否存活，如果挂了就重启 */
    private void checkAndRestartServices() {
        // 检查主服务是否在运行
        if (!ServiceChecker.isServiceRunning(this, ServerService.class)) {
            Log.w(TAG, "ServerService not running, restarting...");
            try {
                Intent svc = new Intent(this, ServerService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart ServerService", e);
            }
        }

        // 检查悬浮窗是否在运行
        if (!ServiceChecker.isServiceRunning(this, FloatingWindow.class)) {
            Log.w(TAG, "FloatingWindow not running, restarting...");
            try {
                Intent fw = new Intent(this, FloatingWindow.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(fw);
                } else {
                    startService(fw);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to restart FloatingWindow", e);
            }
        }
    }

    /**
     * 设置周期性保活闹钟（静态方法，可从 ServerService 等处调用）
     */
    public static void scheduleKeepAlive(Context context) {
        Intent alarmIntent = new Intent(context, KeepAliveService.class);
        alarmIntent.setAction(ALARM_ACTION);
        PendingIntent pendingIntent = PendingIntent.getService(
            context, 0, alarmIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            try {
                // 先取消旧的闹钟
                am.cancel(pendingIntent);

                // 设置周期性闹钟
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        && !am.canScheduleExactAlarms()) {
                    // Android 12+ 无精确闹钟权限，用 setInexactRepeating
                    am.setInexactRepeating(
                        AlarmManager.RTC_WAKEUP,
                        System.currentTimeMillis() + KEEP_ALIVE_INTERVAL_MS,
                        KEEP_ALIVE_INTERVAL_MS,
                        pendingIntent
                    );
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    // Android 4.4+: setInexactRepeating 已被优化为低功耗
                    am.setInexactRepeating(
                        AlarmManager.RTC_WAKEUP,
                        System.currentTimeMillis() + KEEP_ALIVE_INTERVAL_MS,
                        KEEP_ALIVE_INTERVAL_MS,
                        pendingIntent
                    );
                } else {
                    am.setRepeating(
                        AlarmManager.RTC_WAKEUP,
                        System.currentTimeMillis() + KEEP_ALIVE_INTERVAL_MS,
                        KEEP_ALIVE_INTERVAL_MS,
                        pendingIntent
                    );
                }

                Log.i(TAG, "Keep-alive alarm scheduled (interval: "
                    + (KEEP_ALIVE_INTERVAL_MS / 60000) + " min)");
            } catch (Exception e) {
                Log.e(TAG, "Failed to schedule keep-alive alarm", e);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        // 如果被销毁，立即尝试重启自己和所有服务
        Log.w(TAG, "KeepAliveService destroyed, attempting restart");
        // 通过 setAlarm 方式重启（因为 onDestroy 中不能 startService）
        Intent restartIntent = new Intent(getApplicationContext(), KeepAliveService.class);
        PendingIntent pi = PendingIntent.getService(
            getApplicationContext(), 1, restartIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am != null) {
            am.set(AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + 2000, pi);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "保活服务",
                NotificationManager.IMPORTANCE_MIN); // MIN 级别：不显示通知图标
            channel.setShowBadge(false);
            channel.setDescription("Memories 后台保活");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
