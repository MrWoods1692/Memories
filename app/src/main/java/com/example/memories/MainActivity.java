package com.example.memories;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.work.WorkManager;

public class MainActivity extends android.app.Activity {
    private static final int REQUEST_NOTIFICATIONS = 1001;
    private static final int REQUEST_OVERLAY = 1002;

    private FrpcManager frpcManager;
    private DatabaseHelper dbHelper;
    private WebView webView;
    private Handler handler = new Handler(Looper.getMainLooper());

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        frpcManager = new FrpcManager(this);
        dbHelper = new DatabaseHelper(this);

        // 绑定 WebView
        webView = findViewById(R.id.webview_admin);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(android.webkit.WebView view, android.webkit.WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                // 网页加载失败，可能是服务没启动 → 重新确保服务运行并重试
                handler.post(() -> {
                    startMemoriesService();
                    startKeepAliveService();
                });
                // 2 秒后重新加载
                handler.postDelayed(() -> {
                    String adminPortStr = dbHelper.getConfig("admin_port");
                    int adminPort = 8081;
                    if (adminPortStr != null) {
                        try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
                    }
                    String lanIp = EmbeddedServer.getLanIpAddress();
                    view.loadUrl("http://" + lanIp + ":" + adminPort + "/admin");
                }, 2000);
            }

            @Override
            public void onReceivedError(android.webkit.WebView view, int errorCode,
                                        String description, String failingUrl) {
                // 旧版 API 兼容
                handler.post(() -> {
                    startMemoriesService();
                    startKeepAliveService();
                });
                handler.postDelayed(() -> {
                    String adminPortStr = dbHelper.getConfig("admin_port");
                    int adminPort = 8081;
                    if (adminPortStr != null) {
                        try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
                    }
                    String lanIp = EmbeddedServer.getLanIpAddress();
                    view.loadUrl("http://" + lanIp + ":" + adminPort + "/admin");
                }, 2000);
            }
        });

        // ⚠️ 关键：清理上次被杀时残留的 WorkManager / AlarmManager 重启任务，
        //    防止残留状态阻塞本次服务启动（这就是"杀后台后无法启动"的根因）
        cleanupStaleState();

        // ⚠️ 先启动服务（必须在 requestPermissions 之前，否则跳转设置页后
        //    Activity 进入后台，Android 12+ 会禁止 startForegroundService）
        startMemoriesService();
        startFloatingWindow();
        startKeepAliveService();

        // 自动加载 FRPC 配置
        tryAutoStartFrpc();

        // 延迟请求权限（避免覆盖服务启动）
        handler.postDelayed(this::requestPermissions, 500);

        // 引导开启国产 ROM 自启动权限（仅首次）
        SharedPreferences prefs = getSharedPreferences("memories_prefs", MODE_PRIVATE);
        if (!prefs.getBoolean("autostart_guide_shown", false)) {
            handler.postDelayed(() -> {
                if (AutoStartHelper.tryOpenAutoStartSettings(this)) {
                    prefs.edit().putBoolean("autostart_guide_shown", true).apply();
                }
            }, 2500);
        }

        // 加载管理页面（带重试，等待 LAN IP 就绪）
        loadAdminPageWithRetry();
    }

    /** 带重试的管理页面加载：先等 LAN IP，再等服务端口就绪 */
    private void loadAdminPageWithRetry() {
        String adminPortStr = dbHelper.getConfig("admin_port");
        int adminPort = 8081;
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }
        final int port = adminPort;
        // 第一步：等 LAN IP（WiFi 可能正在连接）
        handler.postDelayed(new Runnable() {
            private int attempts = 0;
            @Override
            public void run() {
                attempts++;
                String lanIp = EmbeddedServer.getLanIpAddress();
                if (!"127.0.0.1".equals(lanIp) || attempts >= 10) {
                    // 第二步：等服务器端口就绪
                    waitForServer(lanIp, port, 0);
                    return;
                }
                handler.postDelayed(this, 500);
            }
        }, 1000);
    }

    /** 后台探测端口是否在监听，就绪后加载页面 */
    private void waitForServer(String lanIp, int port, int attempts) {
        if (attempts >= 20) {
            // 10 秒超时 → 尝试重启服务，再给一次机会
            startMemoriesService();
            startKeepAliveService();
            // 再等 3 秒后强制加载
            handler.postDelayed(() -> {
                final String url = "http://" + lanIp + ":" + port + "/admin";
                webView.loadUrl(url);
            }, 3000);
            return;
        }
        new Thread(() -> {
            try {
                java.net.Socket s = new java.net.Socket();
                s.connect(new java.net.InetSocketAddress(lanIp, port), 800);
                s.close();
                // 端口已监听 → 加载管理页面
                final String url = "http://" + lanIp + ":" + port + "/admin";
                handler.post(() -> webView.loadUrl(url));
            } catch (Exception e) {
                // 服务器还没就绪 → 尝试拉活服务 + 重试
                if (attempts == 5 || attempts == 10 || attempts == 15) {
                    handler.post(() -> {
                        startMemoriesService();
                        startKeepAliveService();
                    });
                }
                handler.postDelayed(() -> waitForServer(lanIp, port, attempts + 1), 500);
            }
        }).start();
    }

    private void tryAutoStartFrpc() {
        String config = dbHelper.getConfig("frpc_config");
        if (config == null || config.trim().isEmpty()) return;

        String portStr = dbHelper.getConfig("server_port");
        int serverPort = 8080;
        if (portStr != null) {
            try { serverPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }
        String portError = FrpcManager.validatePort(config, serverPort);
        if (portError != null) return;
        frpcManager.ensureRunning(config);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }

    // --- 权限 ---
    private void requestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, REQUEST_OVERLAY);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_OVERLAY) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                startFloatingWindow();
            }
        }
    }

    private void startFloatingWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return;
        Intent fw = new Intent(this, FloatingWindow.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(fw);
        } else {
            startService(fw);
        }
    }

    private void startMemoriesService() {
        try {
            android.net.wifi.WifiManager wifi = (android.net.wifi.WifiManager)
                getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wifi != null && !wifi.isWifiEnabled()) {
                wifi.setWifiEnabled(true);
            }
        } catch (Exception ignored) {}
        Intent svc = new Intent(this, ServerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(svc);
        } else {
            startService(svc);
        }
    }

    /** 启动保活看门狗服务（确保被杀后能自动恢复） */
    private void startKeepAliveService() {
        Intent ka = new Intent(this, KeepAliveService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(ka);
        } else {
            startService(ka);
        }
    }

    /**
     * 清理上次被杀时残留的 WorkManager 任务和 AlarmManager 闹钟。
     * 这是修复"杀后台再打开无法启动"的关键：
     * onTaskRemoved 中安排的 WorkManager / AlarmManager 重启在进程被杀后变成
     * 残留状态，会阻塞 MainActivity 的新启动流程。
     */
    private void cleanupStaleState() {
        // 1. 取消 WorkManager 中所有 memories 相关的待执行任务
        try {
            WorkManager.getInstance(this).cancelAllWorkByTag("memories_restart");
            WorkManager.getInstance(this).cancelUniqueWork("memories_restart");
            WorkManager.getInstance(this).cancelAllWorkByTag("memories_boot_startup");
            WorkManager.getInstance(this).cancelUniqueWork("memories_boot_startup");
            Log.i("MainActivity", "Stale WorkManager tasks cancelled");
        } catch (Exception e) {
            Log.w("MainActivity", "Failed to cancel WorkManager tasks", e);
        }

        // 2. 取消 onTaskRemoved 中安排的 ServerService 重启闹钟
        cancelAlarmForService(ServerService.class, 1);
        cancelAlarmForService(ServerService.class, 5);

        // 3. 取消 onTaskRemoved 中安排的 FloatingWindow 重启闹钟
        cancelAlarmForService(FloatingWindow.class, 1001);
        cancelAlarmForService(FloatingWindow.class, 1005);

        // 4. 取消 KeepAliveService 的周期性闹钟和 onDestroy 重启闹钟
        cancelAlarmForService(KeepAliveService.class, 0);
        cancelAlarmForService(KeepAliveService.class, 1);
    }

    private void cancelAlarmForService(Class<?> serviceClass, int requestCode) {
        try {
            Intent intent = new Intent(this, serviceClass);
            PendingIntent pi = PendingIntent.getService(
                this, requestCode, intent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE
                    : PendingIntent.FLAG_NO_CREATE
            );
            if (pi != null) {
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                if (am != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        } catch (Exception e) {
            Log.w("MainActivity", "Failed to cancel alarm for " + serviceClass.getSimpleName(), e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            Toast.makeText(this, grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                ? "通知权限已授予" : "建议授予通知权限以保持服务运行", Toast.LENGTH_SHORT).show();
        }
    }
}
