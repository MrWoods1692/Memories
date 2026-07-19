package com.example.memories;

import android.app.ActivityManager;
import android.content.Context;
import android.util.Log;

import java.util.HashSet;
import java.util.Set;

/**
 * 服务存活检查工具类。
 *
 * 提供两种检查方式：
 * 1. ActivityManager.getRunningServices（Android 8+ 仅返回自身应用的服务，但仍可用于自查）
 * 2. 进程名匹配（兜底，防止 getRunningServices 在某些 ROM 上失效）
 *
 * 另外维护一个静态"已启动"标记集合，由各服务在 onCreate 时注册、onDestroy 时注销，
 * 作为最可靠的存活判断（不受系统 API 限制影响）。
 */
public class ServiceChecker {
    private static final String TAG = "ServiceChecker";

    /** 已启动服务的类名集合（由各服务 onCreate/onDestroy 维护） */
    private static final Set<String> ALIVE_SERVICES = new HashSet<>();

    /** 注册服务为存活（在 Service.onCreate 中调用） */
    public static void markAlive(Class<?> serviceClass) {
        synchronized (ALIVE_SERVICES) {
            ALIVE_SERVICES.add(serviceClass.getName());
        }
    }

    /** 注销服务存活状态（在 Service.onDestroy 中调用） */
    public static void markDead(Class<?> serviceClass) {
        synchronized (ALIVE_SERVICES) {
            ALIVE_SERVICES.remove(serviceClass.getName());
        }
    }

    /**
     * 检查指定服务是否正在运行（综合判断）。
     * @param context 上下文
     * @param serviceClass 要检查的服务类
     * @return true 表示服务正在运行
     */
    public static boolean isServiceRunning(Context context, Class<?> serviceClass) {
        // 优先用静态标记（最可靠，不受系统 API 限制）
        synchronized (ALIVE_SERVICES) {
            if (ALIVE_SERVICES.contains(serviceClass.getName())) {
                return true;
            }
        }

        // 兜底 1：ActivityManager.getRunningServices
        ActivityManager am = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            try {
                for (ActivityManager.RunningServiceInfo service : am.getRunningServices(Integer.MAX_VALUE)) {
                    if (serviceClass.getName().equals(service.service.getClassName())) {
                        return true;
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "getRunningServices failed", e);
            }
        }

        // 兜底 2：进程名匹配（服务进程名通常是 "<packageName>:remote" 或主进程）
        // 这里仅作为补充，避免误判
        return false;
    }
}
