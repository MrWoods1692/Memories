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
import android.os.PowerManager;
import android.util.Log;

import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class ServerService extends Service {
    private EmbeddedServer server;
    private AdminServer adminServer;
    private static final String CHANNEL_ID = "memories_service_channel";
    private static final int NOTIFICATION_ID = 1;
    private int apiPort = 8080;
    private int adminPort = 8081;
    private boolean serversStarted = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 先读取端口配置（快速）
        DatabaseHelper db = new DatabaseHelper(this);
        String portStr = db.getConfig("server_port");
        if (portStr != null) {
            try { apiPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }
        String adminPortStr = db.getConfig("admin_port");
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }

        // ⚠️ 关键：必须立即调用 startForeground()（5 秒内），否则系统杀死服务
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Memories 启动中")
                .setContentText("正在启动服务...")
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(Notification.PRIORITY_LOW)
                .build();
        startForeground(NOTIFICATION_ID, n);

        // 前台通知已就绪，在后台线程启动服务器（避免阻塞主线程）
        new Thread(this::startServers).start();

        // 获取 WakeLock 防止 CPU 休眠导致服务中断
        acquireWakeLock();
    }

    private void startServers() {
        // 启动主 API 服务器
        server = new EmbeddedServer(apiPort, this);
        try {
            server.start();
            serversStarted = true;
            Log.i("ServerService", "API server started on port " + apiPort);
        } catch (Exception e) {
            Log.e("ServerService", "Failed to start API server", e);
        }

        // 启动管理面板服务器
        adminServer = new AdminServer(adminPort, apiPort, this);
        try {
            adminServer.start();
            Log.i("ServerService", "Admin server started on port " + adminPort);
        } catch (Exception e) {
            Log.e("ServerService", "Failed to start admin server", e);
        }

        // 更新通知为实际端口信息
        updateNotification();
    }

    private void updateNotification() {
        String lanIp = EmbeddedServer.getLanIpAddress();
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Memories 服务运行中")
                .setContentText("API:" + apiPort + " | 管理:" + adminPort + " | " + lanIp)
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .setPriority(Notification.PRIORITY_LOW)
                .setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, n);
        }
    }

    /** 获取 WakeLock 防止 CPU 深度休眠 */
    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wl = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Memories:ServerWakeLock"
                );
                if (wl != null && !wl.isHeld()) {
                    wl.setReferenceCounted(false);
                    wl.acquire(30 * 60 * 1000L); // 30 分钟超时
                }
            }
        } catch (Exception e) {
            Log.w("ServerService", "Failed to acquire wake lock", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 如果服务器挂了但服务还活着，尝试重启服务器
        if (!serversStarted) {
            new Thread(this::startServers).start();
        }
        // START_REDELIVER_INTENT：如果服务在被杀后重启，系统会重新传递 Intent
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.i("ServerService", "onTaskRemoved - scheduling restart");

        // 方案 1: WorkManager（Android 12+ 合规方式）
        try {
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(BootStartupWorker.class)
                    .setInitialDelay(500, TimeUnit.MILLISECONDS)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .addTag("memories_restart")
                    .build();
            WorkManager.getInstance(this)
                    .enqueueUniqueWork("memories_restart", ExistingWorkPolicy.REPLACE, work);
            Log.i("ServerService", "Restart scheduled via WorkManager");
        } catch (Exception e) {
            Log.e("ServerService", "WorkManager restart failed", e);
        }

        // 方案 2: AlarmManager 兜底（1 秒后精确唤醒）
        scheduleAlarmRestart(1000);

        // 方案 3: AlarmManager 二次兜底（5 秒后再次唤醒，防止第一次被系统丢弃）
        scheduleAlarmRestart(5000);

        // 方案 4: 设置周期性保活检查（每 15 分钟）
        KeepAliveService.scheduleKeepAlive(this);
    }

    private void scheduleAlarmRestart(long delayMs) {
        try {
            Intent restartIntent = new Intent(getApplicationContext(), ServerService.class);
            PendingIntent pi = PendingIntent.getService(
                getApplicationContext(), (int) (delayMs / 1000), restartIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                    : PendingIntent.FLAG_UPDATE_CURRENT
            );
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // Android 12+：如果权限不足，用 setAndAllowWhileIdle
                    if (am.canScheduleExactAlarms()) {
                        am.setExact(AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + delayMs, pi);
                    } else {
                        am.set(AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + delayMs, pi);
                    }
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP,
                        System.currentTimeMillis() + delayMs, pi);
                }
                Log.i("ServerService", "Alarm restart scheduled in " + delayMs + "ms");
            }
        } catch (Exception e) {
            Log.e("ServerService", "Failed to schedule alarm restart", e);
        }
    }

    @Override
    public void onDestroy() {
        // 在销毁前尝试最后一次重启
        if (!isFinishing()) {
            scheduleAlarmRestart(1000);
        }
        super.onDestroy();
        if (server != null) server.stop();
        if (adminServer != null) adminServer.stop();
    }

    /** 判断服务是否正在被系统主动终止（非用户操作） */
    private boolean isFinishing() {
        // 简单判断：如果服务器之前已成功启动，可能是异常终止
        return !serversStarted;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Memories 服务",
                NotificationManager.IMPORTANCE_LOW  // LOW 避免发出声音，但仍显示在通知栏
            );
            channel.setDescription("Memories 服务器运行状态");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
