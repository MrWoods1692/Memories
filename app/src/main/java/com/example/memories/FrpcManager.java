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

    /**
     * 从 frpc.ini 配置内容中提取 local_port
     * 解析 [xxx] 段中的 local_port = 数字
     */
    public static int extractLocalPort(String configContent) {
        if (configContent == null) return -1;
        java.util.regex.Pattern p = java.util.regex.Pattern.compile("local_port\\s*=\\s*(\\d+)");
        java.util.regex.Matcher m = p.matcher(configContent);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return -1; }
        }
        return -1;
    }

    /**
     * 校验 frpc 配置中的 local_port 是否与服务器端口一致
     * @return null 表示一致，否则返回错误信息
     */
    public static String validatePort(String configContent, int serverPort) {
        int frpcPort = extractLocalPort(configContent);
        if (frpcPort == -1) {
            return "frpc 配置中未找到 local_port，请检查配置";
        }
        if (frpcPort != serverPort) {
            return "端口不匹配！frpc local_port=" + frpcPort + "，服务器端口=" + serverPort + "，请修改一致";
        }
        return null; // 一致
    }
}