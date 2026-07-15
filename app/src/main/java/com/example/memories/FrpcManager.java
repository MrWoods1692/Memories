package com.example.memories;

import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;

/**
 * 管理本地 frpc 进程，将 API 服务转发到公网
 */
public class FrpcManager {
    private static final String TAG = "FrpcManager";
    private Process frpcProcess;
    private boolean running = false;

    /**
     * 生成 frpc.ini 配置文件并启动 frpc
     * @param configContent frpc.ini 的完整内容
     * @param frpcBinaryPath frpc 可执行文件路径
     * @param workDir 工作目录（用于存放 frpc.ini）
     */
    public boolean startFrpc(String configContent, String frpcBinaryPath, File workDir) {
        if (running) {
            Log.w(TAG, "frpc already running");
            return true;
        }

        try {
            // 写入 frpc.ini
            File configFile = new File(workDir, "frpc.ini");
            FileOutputStream fos = new FileOutputStream(configFile);
            fos.write(configContent.getBytes("UTF-8"));
            fos.close();

            // 启动 frpc 进程
            ProcessBuilder pb = new ProcessBuilder(frpcBinaryPath, "-c", configFile.getAbsolutePath());
            pb.directory(workDir);
            pb.redirectErrorStream(true);
            frpcProcess = pb.start();
            running = true;

            // 后台读取日志
            new Thread(() -> {
                try {
                    BufferedReader br = new BufferedReader(new InputStreamReader(frpcProcess.getInputStream()));
                    String line;
                    while ((line = br.readLine()) != null) {
                        Log.d(TAG, "frpc: " + line);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "frpc log read error", e);
                }
            }).start();

            Log.i(TAG, "frpc started successfully");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to start frpc", e);
            running = false;
            return false;
        }
    }

    /**
     * 停止 frpc 进程
     */
    public void stopFrpc() {
        if (frpcProcess != null) {
            frpcProcess.destroy();
            frpcProcess = null;
        }
        running = false;
        Log.i(TAG, "frpc stopped");
    }

    public boolean isRunning() {
        return running && frpcProcess != null && frpcProcess.isAlive();
    }
}