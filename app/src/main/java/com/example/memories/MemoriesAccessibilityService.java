package com.example.memories;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * Memories 无障碍服务 - 核心保活组件。
 *
 * 设计依据（参考向日葵远程控制等长期存活应用）：
 * Android 系统为无障碍服务分配了极高的进程优先级（oom_adj 极低），
 * 使其成为系统最不愿杀死的组件。启用了无障碍服务的应用在内存紧张时
 * 比普通前台服务更不容易被 LMK（Low Memory Killer）回收。
 *
 * 此服务不读取任何用户隐私数据，仅使用无障碍事件回调来：
 * 1. 维持服务活跃状态（系统会定期发送事件）
 * 2. 检测服务是否被异常终止并自动恢复
 * 3. 通过 onServiceConnected 确保系统绑定成功
 *
 * 特别注意：国内厂商（vivo/OPPO/华为/小米）ROM 即使有前台服务也会在
 * 8 小时左右强制杀死进程，无障碍服务是绕过此限制的关键手段。
 */
public class MemoriesAccessibilityService extends AccessibilityService {
    private static final String TAG = "MemoriesAccessibility";
    private static final String CHANNEL_ID = "accessibility_channel";
    private static final int NOTIFICATION_ID = 10001;

    // 上次保活检查时间，防止高频操作
    private long lastKeepAliveCheck = 0;
    private static final long KEEP_ALIVE_CHECK_INTERVAL = 30_000L; // 30 秒

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "AccessibilityService created - app is now in high-priority mode");
        ServiceChecker.markAlive(MemoriesAccessibilityService.class);

        // 创建通知渠道（低调通知，仅在需要前台展示时使用）
        createNotificationChannel();
    }

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        Log.i(TAG, "AccessibilityService connected successfully");

        // 配置服务信息（动态设置以兼容不同 Android 版本）
        AccessibilityServiceInfo info = getServiceInfo();
        if (info == null) {
            info = new AccessibilityServiceInfo();
        }
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.DEFAULT
                | AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
                | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            info.flags |= AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            info.flags |= AccessibilityServiceInfo.FLAG_REQUEST_2_FINGER_PASSTHROUGH;
        }
        setServiceInfo(info);

        // 绑定成功后立即确保其他服务在运行
        ensureAllServicesRunning();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // 收到任何无障碍事件都说明服务存活，利用此机会做保活检查
        if (event == null) return;

        long now = System.currentTimeMillis();
        if (now - lastKeepAliveCheck > KEEP_ALIVE_CHECK_INTERVAL) {
            lastKeepAliveCheck = now;
            ensureAllServicesRunning();
        }
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "AccessibilityService interrupted - system may be killing us");
        // 被中断时尝试恢复所有服务
        ensureAllServicesRunning();
    }

    @Override
    public void onDestroy() {
        Log.w(TAG, "AccessibilityService destroyed - attempting immediate restart");
        // 系统杀死了无障碍服务，尝试通过 AlarmManager 或 WorkManager 重启
        scheduleRestart();
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 如果系统尝试重启此服务，确保所有服务正常运行
        ensureAllServicesRunning();
        return START_STICKY;
    }

    /**
     * 确保所有 Memories 核心服务在运行
     */
    private void ensureAllServicesRunning() {
        try {
            // 检查并重启 ServerService
            if (!ServiceChecker.isServiceRunning(this, ServerService.class)) {
                Log.w(TAG, "ServerService not running, restarting...");
                Intent svc = new Intent(this, ServerService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
            }

            // 检查并重启 KeepAliveService
            if (!ServiceChecker.isServiceRunning(this, KeepAliveService.class)) {
                Log.w(TAG, "KeepAliveService not running, restarting...");
                Intent ka = new Intent(this, KeepAliveService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(ka);
                } else {
                    startService(ka);
                }
            }

            // 检查并重启 FloatingWindow (需要悬浮窗权限)
            if (!ServiceChecker.isServiceRunning(this, FloatingWindow.class)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && android.provider.Settings.canDrawOverlays(this)) {
                    Log.w(TAG, "FloatingWindow not running, restarting...");
                    Intent fw = new Intent(this, FloatingWindow.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(fw);
                    } else {
                        startService(fw);
                    }
                }
            }

            // 确保 FRPC 在运行
            try {
                FrpcManager frpc = new FrpcManager(this);
                DatabaseHelper db = new DatabaseHelper(this);
                String config = db.getConfig("frpc_config");
                if (config != null && !config.trim().isEmpty()) {
                    frpc.ensureRunning(config);
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to check FRPC", e);
            }

        } catch (Exception e) {
            Log.e(TAG, "Error in ensureAllServicesRunning", e);
        }
    }

    /**
     * 通过 WorkManager 安排服务重启
     */
    private void scheduleRestart() {
        try {
            androidx.work.OneTimeWorkRequest work = new androidx.work.OneTimeWorkRequest
                .Builder(BootStartupWorker.class)
                .setInitialDelay(2, java.util.concurrent.TimeUnit.SECONDS)
                .addTag("memories_accessibility_restart")
                .build();
            androidx.work.WorkManager.getInstance(getApplicationContext())
                .enqueueUniqueWork("memories_accessibility_restart",
                    androidx.work.ExistingWorkPolicy.REPLACE, work);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule restart", e);
        }
    }

    /**
     * 创建通知渠道（低调，不打扰用户）
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Memories 保活服务",
                NotificationManager.IMPORTANCE_MIN  // 最低优先级，不显示图标
            );
            channel.setDescription("用于维持 Memories 后台服务正常运行");
            channel.setShowBadge(false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    /**
     * 检查无障碍服务是否已启用
     */
    public static boolean isAccessibilityServiceEnabled(android.content.Context context) {
        String serviceName = context.getPackageName() + "/"
                + MemoriesAccessibilityService.class.getCanonicalName();
        try {
            String enabledServices = android.provider.Settings.Secure.getString(
                context.getContentResolver(),
                android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            );
            if (enabledServices == null) return false;
            // 服务名可能包含简写形式
            return enabledServices.contains(serviceName)
                    || enabledServices.contains(MemoriesAccessibilityService.class.getCanonicalName());
        } catch (Exception e) {
            Log.w(TAG, "Failed to check accessibility service status", e);
            return false;
        }
    }
}
