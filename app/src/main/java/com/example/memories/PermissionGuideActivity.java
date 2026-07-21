package com.example.memories;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.graphics.Color;
import android.graphics.Typeface;
import android.util.TypedValue;
import android.view.Gravity;

/**
 * 权限引导页面 - 引导用户逐一开启所有必要权限。
 *
 * 使用方式：从 MainActivity 通过 Intent 启动此页面，
 * 或在 WebView 中通过 js 接口打开。
 */
public class PermissionGuideActivity extends Activity {

    private LinearLayout permissionListContainer;
    private TextView summaryText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 动态构建布局
        ScrollView scrollView = new ScrollView(this);
        LinearLayout rootLayout = new LinearLayout(this);
        rootLayout.setOrientation(LinearLayout.VERTICAL);
        rootLayout.setPadding(dp(16), dp(16), dp(16), dp(32));
        rootLayout.setBackgroundColor(Color.parseColor("#F5F5F5"));

        // 标题
        TextView title = new TextView(this);
        title.setText("🔐 权限管理");
        title.setTextSize(22);
        title.setTextColor(Color.BLACK);
        title.setTypeface(null, Typeface.BOLD);
        title.setPadding(0, 0, 0, dp(8));
        rootLayout.addView(title);

        // 说明文字
        TextView desc = new TextView(this);
        desc.setText("Memories 需要在后台持续运行以提供文件同步服务。\n"
                + "请确保以下权限均已开启，否则可能被系统（尤其是 vivo/OPPO/华为/小米）在后台清理时杀死进程。\n\n"
                + "⚠️ 最关键：无障碍权限 - 参考向日葵远程控制的做法，开启后系统将给予应用最高优先级，不会轻易杀死进程。");
        desc.setTextSize(14);
        desc.setTextColor(Color.parseColor("#666666"));
        desc.setPadding(0, 0, 0, dp(16));
        rootLayout.addView(desc);

        // 权限状态摘要
        summaryText = new TextView(this);
        summaryText.setTextSize(12);
        summaryText.setTextColor(Color.parseColor("#888888"));
        summaryText.setPadding(dp(8), dp(8), dp(8), dp(8));
        summaryText.setBackgroundColor(Color.WHITE);
        rootLayout.addView(summaryText);

        // 间距
        rootLayout.addView(createDivider());

        // 权限列表容器
        permissionListContainer = new LinearLayout(this);
        permissionListContainer.setOrientation(LinearLayout.VERTICAL);
        rootLayout.addView(permissionListContainer);

        scrollView.addView(rootLayout);
        setContentView(scrollView);

        // 构建权限列表
        buildPermissionList();

        // 设置返回按钮
        Button backBtn = new Button(this);
        backBtn.setText("← 返回管理面板");
        backBtn.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(24), 0, 0);
        backBtn.setLayoutParams(params);
        rootLayout.addView(backBtn);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 每次回到此页面刷新状态
        refreshAllStatus();
    }

    private void buildPermissionList() {
        // ====== 关键权限（无障碍 - 最重要的） ======
        addPermissionItem("♿ 无障碍服务",
                "【最关键的保活设置】开启后系统给予最高进程优先级，\n"
                + "参考向日葵远程控制的做法，这是防止被 vivo/OPPO 等手机 8 小时杀后台的关键。\n"
                + "此权限不会读取您的隐私数据。",
                () -> PermissionHelper.hasAccessibilityPermission(this),
                () -> PermissionHelper.requestAccessibilityPermission(this));

        // ====== 悬浮窗 ======
        addPermissionItem("🪟 悬浮窗权限",
                "允许在其他应用上方显示悬浮图标，便于快速访问。",
                () -> PermissionHelper.hasOverlayPermission(this),
                () -> requestOverlayPermission());

        // ====== 电池优化白名单 ======
        addPermissionItem("🔋 电池优化白名单",
                "允许在后台持续运行，不被系统电池优化功能限制。\n"
                + "vivo 手机需额外在 i管家 → 省电管理 → 高耗电 中开启。",
                () -> PermissionHelper.hasBatteryOptimizationPermission(this),
                () -> requestBatteryOptimization());

        // ====== 通知权限 ======
        addPermissionItem("📢 通知权限",
                "允许发送通知，保持前台服务正常显示。",
                () -> PermissionHelper.hasNotificationPermission(this),
                () -> requestNotificationPermission());

        // ====== 修改系统设置 ======
        addPermissionItem("⚙️ 修改系统设置",
                "允许自动开启 Wi-Fi 等系统功能。",
                () -> PermissionHelper.hasWriteSettingsPermission(this),
                () -> requestWriteSettingsPermission());

        // ====== 精确闹钟 ======
        addPermissionItem("⏰ 精确闹钟",
                "允许精准定时唤醒看门狗服务，防止 Doze 模式下服务被冻结。",
                () -> PermissionHelper.hasExactAlarmPermission(this),
                () -> requestExactAlarmPermission());

        // ====== 完全存储访问 ======
        addPermissionItem("💾 完全存储访问",
                "允许访问所有文件以进行备份和同步。",
                () -> PermissionHelper.hasStoragePermission(this),
                () -> PermissionHelper.requestManageStoragePermission(this));

        // ====== 安装未知应用 ======
        addPermissionItem("📦 安装未知应用",
                "允许应用自行更新（未来功能）。",
                () -> Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                    || PermissionHelper.hasInstallUnknownAppPermission(this),
                () -> requestInstallUnknownAppPermission());

        // ====== 摄像头 ======
        addPermissionItem("📷 摄像头",
                "拍照和扫描功能（未来功能）。",
                () -> PermissionHelper.hasCameraPermission(this),
                () -> requestRuntimePermission(new String[]{android.Manifest.permission.CAMERA},
                    PermissionHelper.REQ_CAMERA_MIC));

        // ====== 麦克风 ======
        addPermissionItem("🎤 麦克风",
                "录音功能（未来功能）。",
                () -> PermissionHelper.hasRecordAudioPermission(this),
                () -> requestRuntimePermission(
                    new String[]{android.Manifest.permission.RECORD_AUDIO},
                    PermissionHelper.REQ_CAMERA_MIC));

        // ====== 定位 ======
        addPermissionItem("📍 定位",
                "获取位置信息用于地理标记（未来功能）。",
                () -> PermissionHelper.hasLocationPermission(this),
                () -> requestRuntimePermission(
                    new String[]{
                        android.Manifest.permission.ACCESS_FINE_LOCATION,
                        android.Manifest.permission.ACCESS_COARSE_LOCATION
                    }, PermissionHelper.REQ_LOCATION));

        // ====== 附近设备 ======
        addPermissionItem("📡 附近设备",
                "蓝牙和 Wi-Fi 设备发现（未来功能）。",
                () -> Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || PermissionHelper.hasNearbyDevicePermission(this),
                () -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        requestRuntimePermission(new String[]{
                            android.Manifest.permission.BLUETOOTH_CONNECT,
                            android.Manifest.permission.BLUETOOTH_SCAN
                        }, PermissionHelper.REQ_NEARBY);
                    }
                });

        // ====== 自启动（厂商 ROM） ======
        addPermissionItem("🚀 自启动（厂商设置）",
                "跳转到系统自启动管理页面，允许 Memories 开机自启。\n"
                + "vivo: i管家 → 权限管理 → 自启动\n"
                + "OPPO: 手机管家 → 权限隐私 → 自启动管理\n"
                + "小米: 安全中心 → 应用管理 → 自启动\n"
                + "华为: 手机管家 → 应用启动管理",
                () -> true, // 此权限无法通过 API 检测
                () -> PermissionHelper.openAutoStartSettings(this));

        // ====== 应用详情（综合入口） ======
        addPermissionItem("📋 应用详情（综合入口）",
                "打开系统应用信息页面，可在此管理所有权限。\n"
                + "包括：后台弹出界面、锁屏显示、关联启动等 ROM 特定权限。",
                () -> true,
                () -> PermissionHelper.openAppInfoSettings(this));

        // ====== 电池优化设置列表 ======
        addPermissionItem("🔌 电池优化设置列表",
                "打开系统电池优化白名单列表，找到 Memories 并设为不优化。",
                () -> PermissionHelper.hasBatteryOptimizationPermission(this),
                () -> PermissionHelper.openBatteryOptimizationSettings(this));

        // ====== 通知栏常驻（通知监听） ======
        addPermissionItem("🔔 通知监听",
                "常驻通知栏权限，增强后台保活能力。",
                () -> PermissionHelper.hasNotificationListenerPermission(this),
                () -> PermissionHelper.requestNotificationListenerPermission(this));
    }

    // ================================================================
    // 辅助 UI 方法
    // ================================================================

    private void addPermissionItem(String title, String description,
                                    PermissionStatusChecker checker,
                                    Runnable action) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setPadding(dp(12), dp(12), dp(12), dp(12));
        item.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams itemParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        itemParams.setMargins(0, 0, 0, dp(8));
        item.setLayoutParams(itemParams);

        // 标题行
        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextSize(15);
        titleView.setTextColor(Color.BLACK);
        titleView.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleView.setLayoutParams(titleParams);

        // 状态标签
        TextView statusView = new TextView(this);
        statusView.setText(checker.check() ? "✅ 已开启" : "❌ 未开启");
        statusView.setTextSize(13);
        statusView.setTextColor(checker.check() ?
            Color.parseColor("#4CAF50") : Color.parseColor("#F44336"));
        titleRow.addView(titleView);
        titleRow.addView(statusView);
        item.addView(titleRow);

        // 描述
        TextView descView = new TextView(this);
        descView.setText(description);
        descView.setTextSize(12);
        descView.setTextColor(Color.parseColor("#666666"));
        descView.setPadding(0, dp(4), 0, dp(8));
        item.addView(descView);

        // 操作按钮（仅未开启时显示）
        if (!checker.check()) {
            Button actionBtn = new Button(this);
            actionBtn.setText("去开启");
            actionBtn.setTextSize(13);
            actionBtn.setOnClickListener(v -> {
                action.run();
                // 延迟刷新状态
                v.postDelayed(this::refreshAllStatus, 1000);
            });
            item.addView(actionBtn);
        }

        permissionListContainer.addView(item);
    }

    private View createDivider() {
        View divider = new View(this);
        divider.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        divider.setBackgroundColor(Color.parseColor("#E0E0E0"));
        return divider;
    }

    private void refreshAllStatus() {
        // 重建权限列表
        permissionListContainer.removeAllViews();
        buildPermissionList();

        // 更新摘要
        summaryText.setText(PermissionHelper.getPermissionSummary(this));
    }

    // ================================================================
    // 权限请求实现
    // ================================================================

    private void requestOverlayPermission() {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "无法打开悬浮窗设置", Toast.LENGTH_SHORT).show();
        }
    }

    private void requestBatteryOptimization() {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(android.net.Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "无法打开电池优化设置", Toast.LENGTH_SHORT).show();
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(
                new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                PermissionHelper.REQ_NOTIFICATIONS);
        }
    }

    private void requestWriteSettingsPermission() {
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_WRITE_SETTINGS,
                android.net.Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "无法打开修改系统设置", Toast.LENGTH_SHORT).show();
        }
    }

    private void requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    android.net.Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(this, "无法打开精确闹钟设置", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void requestInstallUnknownAppPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    android.net.Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(this, "无法打开安装未知应用设置", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void requestRuntimePermission(String[] permissions, int requestCode) {
        requestPermissions(permissions, requestCode);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        refreshAllStatus();
    }

    private int dp(int dp) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp,
            getResources().getDisplayMetrics());
    }

    /** 权限状态检查器接口 */
    private interface PermissionStatusChecker {
        boolean check();
    }
}
