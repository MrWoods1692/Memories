package com.example.memories;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.io.File;

public class MainActivity extends AppCompatActivity {
    private FrpcManager frpcManager;
    private DatabaseHelper dbHelper;
    private EditText editFrpcPath;
    private EditText editFrpcConfig;
    private TextView textFrpcStatus;
    private TextView textServerInfo;
    private Handler handler = new Handler(Looper.getMainLooper());

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
        Button btnStart = findViewById(R.id.btn_frpc_start);
        Button btnStop = findViewById(R.id.btn_frpc_stop);

        // 加载已保存的 frpc 配置
        loadFrpcConfig();

        // 启动服务器服务
        Intent svc = new Intent(this, ServerService.class);
        startForegroundService(svc);

        // 更新服务器信息
        updateServerInfo();

        // 启动 FRPC 按钮
        btnStart.setOnClickListener(v -> {
            String path = editFrpcPath.getText().toString().trim();
            String config = editFrpcConfig.getText().toString().trim();

            if (path.isEmpty()) {
                textFrpcStatus.setText("FRPC: 请填写可执行文件路径");
                return;
            }
            if (config.isEmpty()) {
                textFrpcStatus.setText("FRPC: 请填写配置内容");
                return;
            }

            // 保存配置到数据库
            dbHelper.setConfig("frpc_path", path);
            dbHelper.setConfig("frpc_config", config);

            File workDir = getFilesDir();
            boolean ok = frpcManager.startFrpc(config, path, workDir);
            if (ok) {
                textFrpcStatus.setText("FRPC: 启动成功 ✓");
            } else {
                textFrpcStatus.setText("FRPC: 启动失败 ✗");
            }
        });

        // 停止 FRPC 按钮
        btnStop.setOnClickListener(v -> {
            frpcManager.stopFrpc();
            textFrpcStatus.setText("FRPC: 已停止");
        });

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

    private void updateServerInfo() {
        long count = dbHelper.getImageCount();
        textServerInfo.setText("端口: 8080 | 图片数: " + count);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        frpcManager.stopFrpc();
        handler.removeCallbacksAndMessages(null);
    }
}
