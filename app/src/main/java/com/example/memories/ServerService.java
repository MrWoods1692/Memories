package com.example.memories;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
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
    }

    private void startServers() {
        // 启动主 API 服务器
        server = new EmbeddedServer(apiPort, this);
        try {
            server.start();
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
                .build();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, n);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
            Log.i("ServerService", "Restart scheduled via WorkManager");
        } else {
            // Android 11 及以下：AlarmManager 直接重启
            Intent restartIntent = new Intent(getApplicationContext(), ServerService.class);
            PendingIntent pi = PendingIntent.getService(
                getApplicationContext(), 0, restartIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
            );
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) {
                am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, pi);
            }
        }
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
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Memories 服务器运行状态");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
