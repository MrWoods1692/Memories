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

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.File;

/**
 * 周期性保活看门狗服务。
 * 每 15 秒通过 AlarmManager 唤醒自己，检查主服务、悬浮窗和 FRPC 是否存活，
 * 如果未运行则自动重启它们。
 *
 * 设计要点：
 * 1. 本服务本身也作为前台服务运行，具有少量通知（或不显示通知）
 * 2. 使用 AlarmManager.setInexactRepeating 降低电量消耗
 * 3. 每次唤醒时检查 ServerService、FloatingWindow 和 FRPC 是否存活
 * 4. 每 60 秒对 FRPC 做一次深度检查（强制重启），防止"假在线"
 */
public class KeepAliveService extends Service {
    private static final String TAG = "KeepAliveService";
    private static final String CHANNEL_ID = "keepalive_channel";
    private static final int NOTIFICATION_ID = 999;
    private static final long KEEP_ALIVE_INTERVAL_MS = 30 * 1000L; // 每 30 秒检查一次
    private static final String ALARM_ACTION = "com.example.memories.KEEP_ALIVE";

    // FRPC 连续失败计数器
    private int frpcFailCount = 0;

    // API 健康检查连续失败计数器（避免单次网络抖动误杀服务）
    private int apiHealthFailCount = 0;
    private static final int API_HEALTH_FAIL_THRESHOLD = 2; // 连续 2 次失败才重启

    // WakeLock 持续持有，防止 CPU 深度休眠导致服务挂起/被杀
    private android.os.PowerManager.WakeLock wakeLock;
    private static final String WAKE_LOCK_TAG = "Memories:KeepAliveWakeLock";

    @Override
    public void onCreate() {
        super.onCreate();
        ServiceChecker.markAlive(KeepAliveService.class);
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

        // 获取持续 WakeLock，防止 CPU 深度休眠导致服务被杀
        acquireWakeLock();

        // 设置周期性唤醒
        scheduleKeepAlive(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Keep-alive check triggered");

        // 每次唤醒时刷新 WakeLock，防止 30 分钟超时后 CPU 深度休眠
        refreshWakeLock();

        // 检查并重启各个服务
        checkAndRestartServices();

        // 确保周期性闹钟仍在
        scheduleKeepAlive(this);

        return START_STICKY;
    }

    /** 检查各服务是否存活，如果挂了就重启 */
    private void checkAndRestartServices() {
        // ========== 凌晨 4 点日志自动清理 ==========
        runDailyLogCleanup();

        // ========== WebDAV 自动备份 ==========
        runBackupCheck();

        boolean apiHealthy = false;
        int serverPort = 8080;
        try {
            DatabaseHelper db = new DatabaseHelper(this);
            String portStr = db.getConfig("server_port");
            if (portStr != null) {
                try {
                    serverPort = Integer.parseInt(portStr);
                } catch (NumberFormatException ignored) {
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to read server port, using default", e);
        }

        boolean serverRunning = ServiceChecker.isServiceRunning(this, ServerService.class);
        if (!serverRunning) {
            Log.w(TAG, "ServerService not running, restarting...");
            apiHealthFailCount = 0;
            restartServerService();
        } else {
            boolean healthy = isApiHealthy(serverPort);
            if (!healthy) {
                apiHealthFailCount++;
                Log.w(TAG, "API health check failed (" + apiHealthFailCount + "/"
                    + API_HEALTH_FAIL_THRESHOLD + ") on port " + serverPort);
                if (apiHealthFailCount >= API_HEALTH_FAIL_THRESHOLD) {
                    Log.w(TAG, "API unhealthy for " + apiHealthFailCount
                        + " consecutive checks, restarting ServerService...");
                    apiHealthFailCount = 0;
                    restartServerService();
                }
                // 未达阈值时不重启，等下一轮检查（避免单次网络抖动误杀）
            } else {
                apiHealthFailCount = 0;
                apiHealthy = true;
                // 服务健康时，主动 ping 一次 ServerService，触发其 onStartCommand 刷新 WakeLock
                // 防止长时间运行后 WakeLock 被系统异常释放导致 CPU 休眠
                try {
                    Intent ping = new Intent(this, ServerService.class);
                    startService(ping);
                } catch (Exception ignored) {}
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
        } else {
            // 悬浮窗在运行时，主动 ping 一次刷新其 WakeLock
            try {
                Intent ping = new Intent(this, FloatingWindow.class);
                startService(ping);
            } catch (Exception ignored) {}
        }

        if (!apiHealthy && !serverRunning) {
            Log.w(TAG, "ServerService restart attempted but API still unhealthy");
        }

        ensureFrpcRunning();
    }

    /**
     * 每天凌晨 4 点执行日志自动清理：
     * - api_requests 表全部清空
     * - api_stats_daily 表保留最近 30 天
     * KeepAliveService 每 15 秒唤醒一次，通过记录上次清理日期避免重复执行。
     */
    private void runDailyLogCleanup() {
        try {
            DatabaseHelper db = new DatabaseHelper(this);
            java.text.SimpleDateFormat dayFmt = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
            String today = dayFmt.format(new java.util.Date());

            String lastCleanupDay = db.getConfig("last_log_cleanup_day");
            if (today.equals(lastCleanupDay)) {
                return; // 今天已经清理过
            }

            java.util.Calendar cal = java.util.Calendar.getInstance();
            int hour = cal.get(java.util.Calendar.HOUR_OF_DAY);

            // 仅在凌晨 4 点及之后执行（如果设备在 4 点关机，开机后也会执行）
            if (hour < 4) {
                return;
            }

            Log.i(TAG, "Running daily log cleanup at " + today + " " + hour + ":00");

            int logDeleted = db.cleanupRequestLogs();
            int statsDeleted = db.cleanupOldDailyStats(30);

            // 记录本次清理日期，防止当天重复执行
            db.setConfig("last_log_cleanup_day", today);

            Log.i(TAG, "Daily log cleanup done: logs=" + logDeleted + ", old_stats=" + statsDeleted);
        } catch (Exception e) {
            Log.e(TAG, "Daily log cleanup failed", e);
        }
    }

    // ==================== WebDAV 滚动备份 ====================

    /** 上次执行滚动备份检查的时间戳 */
    private long lastRollingCheckTs = 0;

    /**
     * WebDAV 滚动备份调度检查。
     * KeepAliveService 每 30 秒触发一次。
     * - 每 12 小时自动备份到 backups/rolling/memories-12h.db（覆盖）
     * - 每 24 小时自动备份到 backups/rolling/memories-24h.db（覆盖）
     */
    private void runBackupCheck() {
        long now = System.currentTimeMillis();
        // 最多每 60 秒检查一次，避免过于频繁的 DB 读取
        if (now - lastRollingCheckTs < 60000) return;
        lastRollingCheckTs = now;

        try {
            DatabaseHelper db = new DatabaseHelper(this);

            String webdavUrl = db.getConfig("webdav_url");
            if (webdavUrl == null || webdavUrl.isEmpty()) return;
            String webdavUser = db.getConfig("webdav_user");
            String webdavPass = db.getConfig("webdav_pass");

            File dbFile = DatabaseHelper.getDatabaseFile();
            if (!dbFile.exists()) return;

            // ===== 12 小时滚动备份 =====
            long last12h = parseConfigLong(db, "last_12h_backup_ts", 0);
            if (now - last12h >= 12L * 3600 * 1000) {
                performRollingBackup(db, webdavUrl, webdavUser, webdavPass,
                        dbFile, "backups/rolling/memories-12h.db", "last_12h_backup_ts");
            }

            // ===== 24 小时滚动备份 =====
            long last24h = parseConfigLong(db, "last_24h_backup_ts", 0);
            if (now - last24h >= 24L * 3600 * 1000) {
                performRollingBackup(db, webdavUrl, webdavUser, webdavPass,
                        dbFile, "backups/rolling/memories-24h.db", "last_24h_backup_ts");
            }
        } catch (Exception e) {
            Log.e(TAG, "Backup check failed", e);
        }
    }

    private long parseConfigLong(DatabaseHelper db, String key, long def) {
        String v = db.getConfig(key);
        if (v == null || v.isEmpty()) return def;
        try { return Long.parseLong(v); } catch (NumberFormatException e) { return def; }
    }

    /**
     * 执行滚动备份（覆盖式上传）
     */
    private void performRollingBackup(DatabaseHelper db, String webdavUrl,
                                       String webdavUser, String webdavPass,
                                       File dbFile, String remotePath, String configKey) {
        new Thread(() -> {
            try {
                boolean ok = WebDavBackup.uploadFile(webdavUrl, webdavUser, webdavPass, dbFile, remotePath);
                if (ok) {
                    db.setConfig(configKey, String.valueOf(System.currentTimeMillis()));
                    Log.i(TAG, "Rolling backup OK: " + remotePath + " (" + dbFile.length() + " bytes)");
                } else {
                    Log.e(TAG, "Rolling backup FAILED: " + remotePath);
                }
            } catch (Throwable e) {
                Log.e(TAG, "Rolling backup error", e);
            }
        }, "memories-rolling-backup").start();
    }

    private void restartServerService() {
        try {
            Intent svc = new Intent(this, ServerService.class);
            // 优先直接 startForegroundService：
            // - 如果服务还活着，会触发 onStartCommand（内部检测 serversStarted=false 会重启服务器）
            // - 如果服务已死，系统会重新创建服务
            // 避免 stopService + 立即 startForegroundService 的竞态（旧服务未完全销毁导致启动失败）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to restart ServerService, trying stop+start", e);
            // 兜底：stop 后再 start
            try {
                Intent svc = new Intent(this, ServerService.class);
                stopService(svc);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            } catch (Exception e2) {
                Log.e(TAG, "Stop+start also failed", e2);
            }
        }
    }

    private boolean isApiHealthy(int port) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL("http://127.0.0.1:" + port + "/health");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2000);
            conn.setReadTimeout(2000);
            conn.setRequestMethod("GET");
            int code = conn.getResponseCode();
            return code >= 200 && code < 500;
        } catch (Exception e) {
            Log.w(TAG, "API health check failed", e);
            return false;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void ensureFrpcRunning() {
        try {
            DatabaseHelper db = new DatabaseHelper(this);
            String config = db.getConfig("frpc_config");
            if (config == null || config.trim().isEmpty()) {
                FrpcManager manager = FrpcManager.getInstance();
                if (manager != null) {
                    manager.stopFrpc();
                }
                return;
            }

            String portStr = db.getConfig("server_port");
            int serverPort = 8080;
            if (portStr != null) {
                try {
                    serverPort = Integer.parseInt(portStr);
                } catch (NumberFormatException ignored) {
                }
            }

            String portError = FrpcManager.validatePort(config, serverPort);
            if (portError != null) {
                Log.w(TAG, "Skip FRPC watchdog: " + portError);
                return;
            }

            FrpcManager manager = FrpcManager.getInstance();
            if (manager == null) {
                manager = new FrpcManager(this);
            }

            boolean ok = manager.ensureRunning(config);
            if (ok) {
                if (frpcFailCount > 0) {
                    Log.i(TAG, "FRPC recovered after " + frpcFailCount + " failures");
                }
                frpcFailCount = 0;
            } else {
                frpcFailCount++;
                if (frpcFailCount <= 3 || frpcFailCount % 10 == 0) {
                    Log.w(TAG, "FRPC watchdog failed to ensure running (fail #" + frpcFailCount + ")");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to check FRPC status", e);
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

                long triggerAt = System.currentTimeMillis() + KEEP_ALIVE_INTERVAL_MS;
                boolean scheduled = false;

                // 优先使用 setExactAndAllowWhileIdle：在 Doze 模式下也能准时唤醒
                // 注意：该 API 为单次闹钟，每次 onStartCommand 时重新调度（见 onStartCommand）
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                                && !am.canScheduleExactAlarms()) {
                            // Android 12+ 无精确闹钟权限，降级为不精确（仍允许 Doze 唤醒）
                            am.setAndAllowWhileIdle(
                                AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
                        } else {
                            am.setExactAndAllowWhileIdle(
                                AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
                        }
                        scheduled = true;
                    } catch (SecurityException se) {
                        Log.w(TAG, "setExactAndAllowWhileIdle denied, fallback", se);
                    }
                }

                if (!scheduled) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        am.setInexactRepeating(
                            AlarmManager.RTC_WAKEUP,
                            triggerAt,
                            KEEP_ALIVE_INTERVAL_MS,
                            pendingIntent
                        );
                    } else {
                        am.setRepeating(
                            AlarmManager.RTC_WAKEUP,
                            triggerAt,
                            KEEP_ALIVE_INTERVAL_MS,
                            pendingIntent
                        );
                    }
                }

                Log.i(TAG, "Keep-alive alarm scheduled (interval: "
                    + (KEEP_ALIVE_INTERVAL_MS / 1000) + " s, exact="
                    + scheduled + ")");
            } catch (Exception e) {
                Log.e(TAG, "Failed to schedule keep-alive alarm", e);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        ServiceChecker.markDead(KeepAliveService.class);
        // 释放 WakeLock
        releaseWakeLock();
        // 如果被销毁，立即尝试重启自己和所有服务
        Log.w(TAG, "KeepAliveService destroyed, attempting restart");
        // 通过 setExactAndAllowWhileIdle 重启（Doze 模式下也能唤醒）
        Intent restartIntent = new Intent(getApplicationContext(), KeepAliveService.class);
        PendingIntent pi = PendingIntent.getService(
            getApplicationContext(), 1, restartIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT
        );
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (am != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                            && !am.canScheduleExactAlarms()) {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + 2000, pi);
                    } else {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,
                            System.currentTimeMillis() + 2000, pi);
                    }
                } else {
                    am.set(AlarmManager.RTC_WAKEUP,
                        System.currentTimeMillis() + 2000, pi);
                }
            } catch (SecurityException se) {
                Log.w(TAG, "Exact alarm denied in onDestroy, fallback", se);
                am.set(AlarmManager.RTC_WAKEUP,
                    System.currentTimeMillis() + 2000, pi);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ==================== WakeLock 管理 ====================

    /** 获取 WakeLock 防止 CPU 深度休眠 */
    private void acquireWakeLock() {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(
                    android.os.PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG);
                if (wakeLock != null) {
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire(30 * 60 * 1000L); // 兜底 30 分钟，每 15 秒刷新
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wake lock", e);
        }
    }

    /** 刷新 WakeLock：先释放再重新获取，避免超时后 CPU 休眠 */
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

    // ==================== 通知渠道 ====================

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
