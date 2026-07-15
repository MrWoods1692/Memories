package com.example.memories;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

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

        // 请求权限
        requestPermissions();

        // 绑定 WebView
        webView = findViewById(R.id.webview_admin);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.setWebViewClient(new WebViewClient());

        // 启动服务
        startMemoriesService();
        startFloatingWindow();

        // 自动加载 FRPC 配置
        tryAutoStartFrpc();

        // 加载管理页面
        handler.postDelayed(this::loadAdminPage, 1500);
    }

    private void loadAdminPage() {
        String adminPortStr = dbHelper.getConfig("admin_port");
        int adminPort = 8081;
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }
        String lanIp = EmbeddedServer.getLanIpAddress();
        String url = "http://" + lanIp + ":" + adminPort + "/admin";
        webView.loadUrl(url);
    }

    private void tryAutoStartFrpc() {
        String config = dbHelper.getConfig("frpc_config");
        if (config == null || config.trim().isEmpty()) return;
        if (frpcManager.isRunning()) return;

        String portStr = dbHelper.getConfig("server_port");
        int serverPort = 8080;
        if (portStr != null) {
            try { serverPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }
        String portError = FrpcManager.validatePort(config, serverPort);
        if (portError != null) return;
        frpcManager.startFrpc(config);
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

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            Toast.makeText(this, grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
                ? "通知权限已授予" : "建议授予通知权限以保持服务运行", Toast.LENGTH_SHORT).show();
        }
    }
}
