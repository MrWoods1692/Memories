package com.example.memories;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextWatcher;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends android.app.Activity {
    private static final int REQUEST_NOTIFICATIONS = 1001;
    private static final int REQUEST_OVERLAY = 1002;

    private FrpcManager frpcManager;
    private DatabaseHelper dbHelper;
    private EditText editFrpcConfig;
    private TextView textFrpcStatus;
    private TextView textServerInfo;
    private TextView textAdminUrl;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean autoStartPending = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        frpcManager = new FrpcManager(this);
        dbHelper = new DatabaseHelper(this);

        // 请求权限
        requestPermissions();

        // 绑定视图
        editFrpcConfig = findViewById(R.id.edit_frpc_config);
        textFrpcStatus = findViewById(R.id.text_frpc_status);
        textServerInfo = findViewById(R.id.text_server_info);
        textAdminUrl = findViewById(R.id.text_admin_url);

        // 加载已保存的 frpc 配置
        loadFrpcConfig();

        // 启动服务器服务（自动开 WiFi）
        startMemoriesService();

        // 启动悬浮窗
        startFloatingWindow();

        // 延迟打开管理页面（等待服务启动）
        handler.postDelayed(this::openAdminPage, 1000);

        // 更新服务器信息
        updateServerInfo();

        // 输入框变化监听：粘贴配置后立即保存并尝试自动启动
        editFrpcConfig.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override
            public void afterTextChanged(Editable s) {
                // 立即持久化保存到数据库，确保粘贴的配置不丢失
                saveConfigImmediately();
                scheduleAutoStart();
            }
        });

        // 页面加载后尝试自动启动（如果已有有效配置）
        scheduleAutoStart();

        // 定时刷新状态
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (frpcManager.isRunning()) {
                    textFrpcStatus.setText("FRPC: 运行中 ✓");
                }
                updateServerInfo();
                handler.postDelayed(this, 5000);
            }
        }, 5000);
    }

    private void loadFrpcConfig() {
        String config = dbHelper.getConfig("frpc_config");
        if (config != null) editFrpcConfig.setText(config);
    }

    /**
     * 延迟自动启动：用户停止输入 2 秒后自动校验并启动 frpc
     */
    private void scheduleAutoStart() {
        autoStartPending = true;
        handler.removeCallbacks(autoStartRunnable);
        handler.postDelayed(autoStartRunnable, 2000);
    }

    private final Runnable autoStartRunnable = new Runnable() {
        @Override
        public void run() {
            if (!autoStartPending) return;
            autoStartPending = false;
            tryAutoStartFrpc();
        }
    };

    /**
     * 立即将 frpc 配置持久化到数据库（永久储存），不等待启动校验
     */
    private void saveConfigImmediately() {
        String config = editFrpcConfig.getText().toString().trim();
        if (!config.isEmpty()) {
            dbHelper.setConfig("frpc_config", config);
        }
    }

    private void tryAutoStartFrpc() {
        String config = editFrpcConfig.getText().toString().trim();

        // 配置为空则不启动
        if (config.isEmpty()) {
            if (frpcManager.isRunning()) {
                frpcManager.stopFrpc();
                textFrpcStatus.setText("FRPC: 配置为空，已停止");
            } else {
                textFrpcStatus.setText("FRPC: 等待粘贴配置");
            }
            return;
        }

        // 获取当前服务器端口
        String portStr = dbHelper.getConfig("server_port");
        int serverPort = 8080;
        if (portStr != null) {
            try { serverPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }

        // 校验 frpc local_port 与服务器端口一致
        String portError = FrpcManager.validatePort(config, serverPort);
        if (portError != null) {
            textFrpcStatus.setText("FRPC: " + portError);
            if (frpcManager.isRunning()) {
                frpcManager.stopFrpc();
            }
            return;
        }

        // 如果已经在运行且配置没变，不重复启动
        if (frpcManager.isRunning()) {
            textFrpcStatus.setText("FRPC: 运行中 ✓ (端口 " + serverPort + ")");
            return;
        }

        // 启动 frpc（使用 frp_android 库）
        boolean ok = frpcManager.startFrpc(config);
        if (ok) {
            textFrpcStatus.setText("FRPC: 启动成功 ✓ (端口 " + serverPort + ")");
        } else {
            textFrpcStatus.setText("FRPC: 启动失败 ✗");
        }
    }

    private void updateServerInfo() {
        long count = dbHelper.getImageCount();
        String portStr = dbHelper.getConfig("server_port");
        int port = 8080;
        if (portStr != null) {
            try { port = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }
        String adminPortStr = dbHelper.getConfig("admin_port");
        int adminPort = 8081;
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }
        String lanIp = EmbeddedServer.getLanIpAddress();
        String adminUrl = "http://" + lanIp + ":" + adminPort + "/admin";
        textServerInfo.setText("API端口: " + port + " | 图片数: " + count);
        textAdminUrl.setText("管理页面: " + adminUrl);
    }

    private void openAdminPage() {
        String adminPortStr = dbHelper.getConfig("admin_port");
        int adminPort = 8081;
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }
        String lanIp = EmbeddedServer.getLanIpAddress();
        String url = "http://" + lanIp + ":" + adminPort + "/admin";
        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(browserIntent);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        frpcManager.stopFrpc();
        handler.removeCallbacksAndMessages(null);
    }

    // --- 权限请求 ---

    private void requestPermissions() {
        // Android 13+ 通知权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    REQUEST_NOTIFICATIONS
                );
            }
        }
        // 悬浮窗权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
                startActivityForResult(intent, REQUEST_OVERLAY);
            }
        }
        // 电池优化白名单
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
        // 自动打开 WiFi
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
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "通知权限已授予", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "建议授予通知权限以保持服务运行", Toast.LENGTH_LONG).show();
            }
        }
    }
}
