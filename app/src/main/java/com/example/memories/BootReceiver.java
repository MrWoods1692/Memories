package com.example.memories;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        // 开机自启：BOOT_COMPLETED, LOCKED_BOOT_COMPLETED, QUICKBOOT_POWERON
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {

            // 自动打开 WiFi
            try {
                WifiManager wifi = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifi != null && !wifi.isWifiEnabled()) {
                    wifi.setWifiEnabled(true);
                }
            } catch (Exception ignored) {}

            // 启动主服务
            Intent svc = new Intent(context, ServerService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }

            // 启动悬浮窗
            Intent fw = new Intent(context, FloatingWindow.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(fw);
            } else {
                context.startService(fw);
            }
        }
    }
}
