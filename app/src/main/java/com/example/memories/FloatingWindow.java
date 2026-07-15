package com.example.memories;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.Toast;

/** 悬浮窗服务：显示一个小图标，点击快速打开 App */
public class FloatingWindow extends Service {
    private WindowManager windowManager;
    private ImageView floatView;
    private static final String CHANNEL_ID = "floating_channel";
    private static final int NOTIFICATION_ID = 100;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // 前台服务通知
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, openIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification n = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Memories 悬浮窗")
                .setContentText("点击悬浮图标快速打开管理面板")
                .setSmallIcon(android.R.drawable.ic_menu_manage)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
        startForeground(NOTIFICATION_ID, n);

        // 创建悬浮窗
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        LayoutInflater inflater = LayoutInflater.from(this);

        floatView = new ImageView(this);
        floatView.setImageResource(android.R.drawable.ic_menu_manage);
        floatView.setPadding(8, 8, 8, 8);
        floatView.setBackgroundColor(0xCC6366F1);
        ((ImageView) floatView).setColorFilter(0xFFFFFFFF);

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        params.x = 16;
        params.y = 0;

        floatView.setOnClickListener(v -> {
            // 打开主界面
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        });

        // 长按关闭悬浮窗
        floatView.setOnLongClickListener(v -> {
            stopSelf();
            Toast.makeText(this, "悬浮窗已关闭", Toast.LENGTH_SHORT).show();
            return true;
        });

        windowManager.addView(floatView, params);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 自动打开 WiFi
        try {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wifi != null && !wifi.isWifiEnabled()) {
                wifi.setWifiEnabled(true);
            }
        } catch (Exception ignored) {}
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatView != null && windowManager != null) {
            try { windowManager.removeView(floatView); } catch (Exception ignored) {}
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "悬浮窗", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
