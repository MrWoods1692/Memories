package com.example.memories;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

public class ServerService extends Service {
    private EmbeddedServer server;
    private AdminServer adminServer;
    private static final String CHANNEL_ID = "memories_service_channel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 从配置读取端口
        DatabaseHelper db = new DatabaseHelper(this);
        String portStr = db.getConfig("server_port");
        int apiPort = 8080;
        if (portStr != null) {
            try { apiPort = Integer.parseInt(portStr); } catch (NumberFormatException ignored) {}
        }

        String adminPortStr = db.getConfig("admin_port");
        int adminPort = 8081;
        if (adminPortStr != null) {
            try { adminPort = Integer.parseInt(adminPortStr); } catch (NumberFormatException ignored) {}
        }

        // 启动主 API 服务器
        server = new EmbeddedServer(apiPort, this);
        try {
            server.start();
            Log.i("ServerService", "API server started on port " + apiPort);
        } catch (Exception e) {
            Log.e("ServerService", "Failed to start API server", e);
        }

        // 启动管理面板服务器（单独端口，仅局域网）
        adminServer = new AdminServer(adminPort, apiPort, this);
        try {
            adminServer.start();
            Log.i("ServerService", "Admin server started on port " + adminPort);
        } catch (Exception e) {
            Log.e("ServerService", "Failed to start admin server", e);
        }

        String lanIp = EmbeddedServer.getLanIpAddress();
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Memories Server")
                .setContentText("API:" + apiPort + " | 管理:" + adminPort + " | " + lanIp)
                .setSmallIcon(android.R.drawable.ic_menu_upload)
                .setOngoing(true)
                .build();
        startForeground(1, n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (server != null) server.stop();
        if (adminServer != null) adminServer.stop();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Memories Service", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
