package com.example.memories;

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

        // 先读取端口配置（带容错：如果数据库损坏，使用默认端口）
        try {
            DatabaseHelper db = new DatabaseHelper(this);
            String portStr = db.getConfig("server_port");
            if (portStr != null) {
                try { apiPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
            }
            String adminPortStr = db.getConfig("admin_port");
            if (adminPortStr != null) {
                try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
            }
        } catch (Exception e) {
            Log.e("ServerService", "Failed to read config from database, using defaults", e);
            // 数据库损坏时使用默认端口，不影响服务启动
        }

        // ⚠️ 关键：必须立即调用 startForeground()（5 秒内），否则系统杀死服务
        try {
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
        } catch (Exception e) {
            Log.e("ServerService", "Failed to start foreground", e);
            // 如果前台启动失败，服务无法存活，停止自身以避免僵尸状态
            stopSelf();
            return;
        }

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

        // 方案 1: WorkManager 延迟重启（唯一合规的 Android 12+ 方式）
        try {
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(BootStartupWorker.class)
                    .setInitialDelay(2, TimeUnit.SECONDS)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .addTag("memories_restart")
                    .build();
            WorkManager.getInstance(this)
                    .enqueueUniqueWork("memories_restart", ExistingWorkPolicy.REPLACE, work);
            Log.i("ServerService", "Restart scheduled via WorkManager");
        } catch (Exception e) {
            Log.e("ServerService", "WorkManager restart failed", e);
        }

        // 方案 2: 设置周期性保活检查（每 15 分钟，作为长期兜底）
        KeepAliveService.scheduleKeepAlive(this);

        // 注意：不再使用 AlarmManager 直启（requestCode=1/5），
        // 因为 MainActivity.cleanupStaleState() 会清理这些残留闹钟，
        // 避免"杀后台再打开无法启动"的问题
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (server != null) server.stop();
        if (adminServer != null) adminServer.stop();
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
