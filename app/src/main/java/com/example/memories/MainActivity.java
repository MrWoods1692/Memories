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
import java.io.FileOutputStream;
import java.io.InputStream;

public class MainActivity extends android.app.Activity {
    private FrpcManager frpcManager;
    private DatabaseHelper dbHelper;
    private EditText editFrpcConfig;
    private TextView textFrpcStatus;
    private TextView textServerInfo;
    private TextView textAdminUrl;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean autoStartPending = false;
    private String frpcBinaryPath = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        frpcManager = new FrpcManager();
        dbHelper = new DatabaseHelper(this);

        // 绑定视图
        editFrpcConfig = findViewById(R.id.edit_frpc_config);
        textFrpcStatus = findViewById(R.id.text_frpc_status);
        textServerInfo = findViewById(R.id.text_server_info);
        textAdminUrl = findViewById(R.id.text_admin_url);

        // 从 assets 提取内置 frpc 二进制
        frpcBinaryPath = extractFrpcBinary();

        // 加载已保存的 frpc 配置
        loadFrpcConfig();

        // 启动服务器服务
        Intent svc = new Intent(this, ServerService.class);
        startForegroundService(svc);

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
     * 从 assets 提取内置 frpc 二进制到内部存储，首次提取后缓存复用
     * @return frpc 可执行文件路径，提取失败返回 null
     */
    private String extractFrpcBinary() {
        File frpcFile = new File(getFilesDir(), "frpc");

        // 如果已提取过且文件存在，直接复用
        if (frpcFile.exists() && frpcFile.canExecute()) {
            return frpcFile.getAbsolutePath();
        }

        // 从 assets 提取
        try {
            InputStream in = getAssets().open("frpc");
            FileOutputStream out = new FileOutputStream(frpcFile);
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) {
                out.write(buf, 0, len);
            }
            out.close();
            in.close();

            // 设置可执行权限
            frpcFile.setExecutable(true);

            return frpcFile.getAbsolutePath();
        } catch (Exception e) {
            // assets 中没有 frpc 文件，降级到数据库中的自定义路径
            String savedPath = dbHelper.getConfig("frpc_path");
            if (savedPath != null && !savedPath.isEmpty()) {
                return savedPath;
            }
            return null;
        }
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

        // frpc 二进制未就绪或配置为空则不启动
        if (frpcBinaryPath == null) {
            textFrpcStatus.setText("FRPC: 未找到 frpc 可执行文件，请在 assets 中放置 frpc");
            return;
        }
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

        // 启动 frpc（使用内置二进制路径）
        File workDir = getFilesDir();
        boolean ok = frpcManager.startFrpc(config, frpcBinaryPath, workDir);
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
