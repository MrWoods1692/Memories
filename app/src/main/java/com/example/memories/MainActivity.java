package com.example.memories;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.widget.EditText;
import android.widget.TextView;

import java.io.File;

public class MainActivity extends android.app.Activity {
    private FrpcManager frpcManager;
    private DatabaseHelper dbHelper;
    private EditText editFrpcPath;
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

        frpcManager = new FrpcManager();
        dbHelper = new DatabaseHelper(this);

        // 绑定视图
        editFrpcPath = findViewById(R.id.edit_frpc_path);
        editFrpcConfig = findViewById(R.id.edit_frpc_config);
        textFrpcStatus = findViewById(R.id.text_frpc_status);
        textServerInfo = findViewById(R.id.text_server_info);
        textAdminUrl = findViewById(R.id.text_admin_url);

        // 加载已保存的 frpc 配置
        loadFrpcConfig();

        // 启动服务器服务
        Intent svc = new Intent(this, ServerService.class);
        startForegroundService(svc);

        // 更新服务器信息
        updateServerInfo();

        // 输入框变化监听：保存配置并尝试自动启动
        TextWatcher configWatcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override
            public void afterTextChanged(Editable s) {
                scheduleAutoStart();
            }
        };
        editFrpcPath.addTextChangedListener(configWatcher);
        editFrpcConfig.addTextChangedListener(configWatcher);

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
        String path = dbHelper.getConfig("frpc_path");
        String config = dbHelper.getConfig("frpc_config");
        if (path != null) editFrpcPath.setText(path);
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

    private void tryAutoStartFrpc() {
        String path = editFrpcPath.getText().toString().trim();
        String config = editFrpcConfig.getText().toString().trim();

        // 配置不完整则不启动
        if (path.isEmpty() || config.isEmpty()) {
            if (frpcManager.isRunning()) {
                frpcManager.stopFrpc();
                textFrpcStatus.setText("FRPC: 配置不完整，已停止");
            } else {
                textFrpcStatus.setText("FRPC: 等待配置");
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

        // 保存配置到数据库
        dbHelper.setConfig("frpc_path", path);
        dbHelper.setConfig("frpc_config", config);

        // 如果已经在运行且配置没变，不重复启动
        if (frpcManager.isRunning()) {
            textFrpcStatus.setText("FRPC: 运行中 ✓ (端口 " + serverPort + ")");
            return;
        }

        // 启动 frpc
        File workDir = getFilesDir();
        boolean ok = frpcManager.startFrpc(config, path, workDir);
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

    @Override
    protected void onDestroy() {
        super.onDestroy();
        frpcManager.stopFrpc();
        handler.removeCallbacksAndMessages(null);
    }
}
