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
    private volatile boolean starting = false; // 防止 onCreate 和 onStartCommand 重复启动

    // WakeLock 持续持有，防止 CPU 深度休眠导致服务挂起/被杀
    private PowerManager.WakeLock wakeLock;
    private static final String WAKE_LOCK_TAG = "Memories:ServerWakeLock";

    @Override
    public void onCreate() {
        super.onCreate();
        ServiceChecker.markAlive(ServerService.class);
        createNotificationChannel();

        // ⚠️ 关键：必须最先调用 startForeground()（5 秒内），否则系统杀死服务
        // 数据库初始化可能因迁移而耗时，所以移到 startForeground 之后
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
            stopSelf();
            return;
        }

        // 前台通知已就绪，在后台线程完成数据库初始化和服务器启动
        starting = true;
        new Thread(() -> {
            // 读取端口配置（带容错：如果数据库损坏，使用默认端口）
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
            }

            startServers();
        }).start();

        // 获取 WakeLock 防止 CPU 休眠导致服务中断
        acquireWakeLock();
    }

    private void startServers() {
        try {
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
        } finally {
            starting = false;
        }
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

    /** 获取 WakeLock 防止 CPU 深度休眠（持久持有，无超时，onDestroy 时释放） */
    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    WAKE_LOCK_TAG
                );
                if (wakeLock != null) {
                    wakeLock.setReferenceCounted(false);
                    // 不带超时：服务存活期间持续持有，避免 30 分钟后 CPU 休眠导致接口掉线
                    wakeLock.acquire();
                }
            }
        } catch (Exception e) {
            Log.w("ServerService", "Failed to acquire wake lock", e);
        }
    }

    /** 刷新 WakeLock：释放后重新获取，兜底防止异常状态导致 WakeLock 丢失 */
    private void refreshWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        acquireWakeLock();
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        wakeLock = null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 每次 onStartCommand 刷新 WakeLock，防止长时间运行后 WakeLock 异常丢失
        refreshWakeLock();

        // 互相监控：如果看门狗 KeepAliveService 挂了，主动拉起（防止看门狗被系统强杀后整条保活链断裂）
        ensureKeepAliveRunning();

        // 如果服务器挂了但服务还活着，尝试重启服务器
        // starting 标志防止与 onCreate 中的后台线程重复启动
        if (!serversStarted && !starting) {
            starting = true;
            new Thread(() -> {
                startServers();
            }).start();
        }
        return START_STICKY;
    }

    /** 确保看门狗 KeepAliveService 在运行，否则拉起它 */
    private void ensureKeepAliveRunning() {
        try {
            if (!ServiceChecker.isServiceRunning(this, KeepAliveService.class)) {
                Log.w("ServerService", "KeepAliveService not running, starting it");
                Intent ka = new Intent(this, KeepAliveService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(ka);
                } else {
                    startService(ka);
                }
            }
        } catch (Exception e) {
            Log.w("ServerService", "Failed to start KeepAliveService", e);
        }
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
        ServiceChecker.markDead(ServerService.class);
        if (server != null) server.stop();
        if (adminServer != null) adminServer.stop();
        releaseWakeLock();
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
