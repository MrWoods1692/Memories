package com.mrcwoods.memories;

import android.Manifest;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.WallpaperManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.ClipDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintManager;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int REQUEST_PERMISSIONS = 10;
    private static final int REQUEST_PICK_IMAGES = 11;
    private static final int REQUEST_DOWNLOAD_FOLDER = 12;
    private static final String UPLOAD_CHANNEL_ID = "memories_uploads";
    private static final int UPLOAD_NOTIFICATION_ID = 1207;
    private static final String DOWNLOAD_CHANNEL_ID = "memories_downloads";
    private static final int DOWNLOAD_NOTIFICATION_ID = 1208;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ApiClient api = new ApiClient();
    private final RateLimitedQueue galleryQueue = new RateLimitedQueue();
    private final RateLimitedQueue uploadQueue = new RateLimitedQueue();
    private final List<ImageItem> galleryItems = new ArrayList<>();
    private final List<UploadTask> uploadTasks = new ArrayList<>();

    private LocalStore store;
    private ImageCache imageCache;
    private ThemeConfig theme;
    private UserSession session;
    private LinearLayout root;
    private FrameLayout shellWrapper;
    private FrameLayout content;
    private TextView title;
    private long nextAfterId = 0;
    private boolean galleryLoading;
    private Button loadMoreButton;
    private final java.util.Set<String> syncedUrls = new java.util.HashSet<>();
    private String selectedOutputFormat = AppConfig.DEFAULT_OUTPUT_FORMAT;
    private ServerSocket oauthServer;
    private FrameLayout previewOverlay;
    private FrameLayout webViewOverlay;
    private int previewIndex;
    private Bitmap previewBitmap;
    private ImageItem previewItem;
    private ImageView previewImageView;
    private View previewMenuDim;
    private Bitmap pendingDownloadBitmap;
    private ImageItem pendingDownloadItem;
    private boolean waitingForDownloadFolder;
    private float previewScale = 1f;
    private float previewRotation = 0f;
    private boolean previewFlippedHorizontal;
    private boolean previewFlippedVertical;
    private float previewTranslateX;
    private float previewTranslateY;
    private long lastBackPressTime;
    private int currentTab;
    private boolean batchSelectMode;
    private final java.util.Set<Integer> batchSelectedIndices = new java.util.HashSet<>();
    private GridLayout galleryGrid;
    private LinearLayout shellHeader;
    private ValueAnimator navBorderAnim;

    @Override
    public void onBackPressed() {
        if (previewMenuDim != null && previewMenuDim.getParent() != null) {
            previewOverlay.removeView(previewMenuDim);
            previewMenuDim = null;
            return;
        }
        if (webViewOverlay != null && webViewOverlay.getParent() != null) {
            hideWebViewOverlay();
            return;
        }
        if (batchSelectMode) {
            exitBatchMode();
            return;
        }
        if (previewOverlay != null && previewOverlay.getVisibility() == View.VISIBLE) {
            hidePreview();
            return;
        }
        if (currentTab == 2 && !title.getText().equals("个人")) {
            showProfile();
            return;
        }
        if (currentTab != 0) {
            showShell(0);
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPressTime < 2000) {
            super.onBackPressed();
        } else {
            lastBackPressTime = now;
            toast("再按一次退出");
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 状态栏透明，内容延伸到状态栏下方
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
        }
        AppConfig.load(this);
        store = new LocalStore(this);
        imageCache = new ImageCache(this);
        session = store.loadSession();
        theme = ThemeConfig.load(store.prefs(), session.qq);
        List<UploadTask> saved = store.loadUploadTasks();
        for (UploadTask t : saved) {
            // 重启后 UPLOADING 状态的任务重置为 WAITING
            if (t.status == UploadTask.UPLOADING) {
                t.status = UploadTask.WAITING;
                t.progress = 0;
                t.message = "等待上传";
            }
        }
        uploadTasks.addAll(saved);
        createUploadNotificationChannel();
        requestInitialPermissions();
        showSplash();
        checkHealth();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PICK_IMAGES && resultCode == RESULT_OK && data != null) {
            addPickedImages(data);
            showUpload();
        } else if (requestCode == REQUEST_DOWNLOAD_FOLDER) {
            waitingForDownloadFolder = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                getContentResolver().takePersistableUriPermission(uri, flags);
                store.saveDownloadFolderUri(uri.toString());
                if (pendingDownloadBitmap != null && pendingDownloadItem != null) {
                    saveBitmapToDownloadFolder(pendingDownloadBitmap, pendingDownloadItem);
                    pendingDownloadBitmap = null;
                    pendingDownloadItem = null;
                } else {
                    showProfileStoragePage();
                }
            } else {
                // 用户取消选择下载目录，清除等待状态
                pendingDownloadBitmap = null;
                pendingDownloadItem = null;
            }
        }
    }

    private void requestInitialPermissions() {
        if (Build.VERSION.SDK_INT < 23) {
            return;
        }
        List<String> permissions = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.ACCESS_NETWORK_STATE) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_NETWORK_STATE);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
            if (checkSelfPermission(Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.READ_MEDIA_VIDEO);
            }
        } else if (checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if (!permissions.isEmpty()) {
            requestPermissions(permissions.toArray(new String[0]), REQUEST_PERMISSIONS);
        }
    }

    private void showSplash() {
        root = vertical();
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(24), dp(24), dp(24), dp(24));
        applyBackground(root);
        ImageView icon = new ImageView(this);
        icon.setImageResource(getResources().getIdentifier("ic_app", "drawable", getPackageName()));
        root.addView(icon, new LinearLayout.LayoutParams(dp(92), dp(92)));
        TextView name = text(AppConfig.APP_NAME, 30, true);
        name.setGravity(Gravity.CENTER);
        root.addView(name, matchWrap());
        TextView status = text("正在检查服务状态", 15, false);
        status.setGravity(Gravity.CENTER);
        root.addView(status, matchWrap());
        root.addView(statusPill("服务健康检查中", theme.primaryButton), compactWrap());
        ProgressBar progress = new ProgressBar(this);
        root.addView(progress, new LinearLayout.LayoutParams(dp(48), dp(48)));
        setContentView(root);
    }

    private void checkHealth() {
        if (!hasNetwork()) {
            showBlocked("网络不可用", "请连接网络后重试。", this::checkHealth);
            return;
        }
        api.health(uiCallback(ok -> {
            if (ok) {
                if (session.isLoggedIn()) {
                    showShell(0);
                } else {
                    showLogin();
                }
            } else {
                showBlocked("服务未就绪", "健康检查没有返回 ok=true。", this::checkHealth);
            }
        }, message -> showBlocked("健康检查失败", message, this::checkHealth)));
    }

    private void showBlocked(String heading, String message, Runnable retry) {
        root = vertical();
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(28), dp(28), dp(28), dp(28));
        applyBackground(root);
        TextView head = text(heading, 24, true);
        head.setGravity(Gravity.CENTER);
        root.addView(head, matchWrap());
        TextView body = text(message, 15, false);
        body.setGravity(Gravity.CENTER);
        root.addView(body, matchWrap());
        root.addView(statusPill("等待恢复", Color.rgb(205, 93, 61)), compactWrap());
        root.addView(button("重试", "ic_link", view -> retry.run()), matchWrap());
        setContentView(root);
    }

    private void showLogin() {
        root = vertical();
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(32), dp(48), dp(32), dp(32));
        applyBackground(root);

        // App 图标
        ImageView appIcon = new ImageView(this);
        appIcon.setImageResource(getResources().getIdentifier("ic_app", "drawable", getPackageName()));
        LinearLayout iconRow = horizontal();
        iconRow.setGravity(Gravity.CENTER);
        iconRow.addView(appIcon, new LinearLayout.LayoutParams(dp(80), dp(80)));
        root.addView(iconRow, matchWrap());

        // 标题
        TextView head = text(AppConfig.APP_NAME, 32, true);
        head.setGravity(Gravity.CENTER);
        root.addView(head, matchWrap());

        // 副标题
        TextView subhead = text("记录美好 · 分享感动", 15, false);
        subhead.setGravity(Gravity.CENTER);
        subhead.setPadding(0, 0, 0, dp(12));
        root.addView(subhead, matchWrap());

        // 装饰分割线
        View divider = new View(this);
        divider.setBackground(gradientDrawable(theme.primaryButton, Color.TRANSPARENT, 0));
        LinearLayout dividerRow = horizontal();
        dividerRow.setGravity(Gravity.CENTER);
        dividerRow.addView(divider, new LinearLayout.LayoutParams(dp(60), dp(2)));
        LinearLayout.LayoutParams dividerParams = matchWrap();
        dividerParams.setMargins(0, 0, 0, dp(16));
        root.addView(dividerRow, dividerParams);

        // 介绍卡片
        LinearLayout introCard = vertical();
        introCard.setPadding(dp(16), dp(14), dp(16), dp(14));
        introCard.setBackground(glassDrawable());
        introCard.addView(text(AppConfig.SCHOOL_NAME, 16, true), matchWrap());
        introCard.addView(text("使用校园墙 OAuth 安全登录，获取个人资料并在本机保存登录状态。", 14, false), matchWrap());
        LinearLayout.LayoutParams cardParams = matchWrap();
        cardParams.setMargins(0, 0, 0, dp(16));
        root.addView(introCard, cardParams);

        // 安全标识
        LinearLayout badges = horizontal();
        badges.setGravity(Gravity.CENTER);
        badges.addView(statusPill("PKCE 安全登录", theme.primaryButton), compactWrap());
        TextView versionPill = text("v" + getVersionName(), 11, false);
        versionPill.setGravity(Gravity.CENTER);
        versionPill.setPadding(dp(10), dp(3), dp(10), dp(3));
        versionPill.setBackground(roundedDrawable(theme.secondaryButton, dp(999)));
        badges.addView(versionPill, compactWrap());
        LinearLayout.LayoutParams badgesParams = matchWrap();
        badgesParams.setMargins(0, 0, 0, dp(20));
        root.addView(badges, badgesParams);

        // 协议勾选
        android.widget.CheckBox agreeBox = new android.widget.CheckBox(this);
        agreeBox.setText("已阅读并同意");
        agreeBox.setTextColor(theme.secondaryText);
        agreeBox.setTextSize(13 * theme.fontScale);
        agreeBox.setTypeface(Typeface.create(theme.fontFamily, Typeface.NORMAL));
        agreeBox.setButtonTintList(android.content.res.ColorStateList.valueOf(theme.primaryButton));
        LinearLayout agreeRow = horizontal();
        agreeRow.setGravity(Gravity.CENTER);
        agreeRow.addView(agreeBox, compactWrap());
        root.addView(agreeRow, matchWrap());

        // 可点击的协议链接
        LinearLayout linkRow = horizontal();
        linkRow.setGravity(Gravity.CENTER);
        linkRow.setPadding(0, 0, 0, dp(8));
        TextView privacyLink = text("《隐私协议》", 13, false);
        privacyLink.setTextColor(theme.primaryButton);
        privacyLink.setPadding(dp(4), 0, dp(6), 0);
        privacyLink.setOnClickListener(v -> showPolicyDialog("隐私协议",
                "Memories 客户端会在本机保存登录令牌、QQ号、用户名、图片URL缓存、上传记录、主题偏好和下载目录授权，用于维持登录状态、加速广场浏览、恢复上传进度以及保存下载图片。\n\n应用会按你的操作访问 Memories API、校园墙 OAuth 服务和图床查询接口。除完成登录、图片上传、图片查询和健康检查外，客户端不会主动收集通讯录、短信、精确位置或与功能无关的文件。"));
        addPressEffect(privacyLink);
        linkRow.addView(privacyLink, compactWrap());
        TextView sep = text("·", 13, false);
        sep.setPadding(dp(2), 0, dp(2), 0);
        linkRow.addView(sep, compactWrap());
        TextView termsLink = text("《服务条款》", 13, false);
        termsLink.setTextColor(theme.primaryButton);
        termsLink.setPadding(dp(6), 0, dp(4), 0);
        termsLink.setOnClickListener(v -> showPolicyDialog("服务条款",
                "使用本应用上传图片前，请确认你拥有图片的上传、公开展示和分享权限，不上传侵犯他人权益、含敏感隐私或违反学校/平台规则的内容。\n\n图片上传会调用配置中的图床与 Memories API；网络服务可用性、响应速度和外部存储策略可能受服务端、网络环境和 Android 系统版本影响。\n\n继续使用本应用即表示你理解这些本地和网络行为。"));
        addPressEffect(termsLink);
        linkRow.addView(termsLink, compactWrap());
        root.addView(linkRow, matchWrap());

        // 登录按钮
        Button loginBtn = button("校园墙登录", "ic_profile", view -> startOAuth());
        loginBtn.setGravity(Gravity.CENTER);
        loginBtn.setEnabled(false);
        loginBtn.setAlpha(0.45f);
        agreeBox.setOnCheckedChangeListener((buttonView, isChecked) -> {
            loginBtn.setEnabled(isChecked);
            loginBtn.setAlpha(isChecked ? 1f : 0.45f);
        });
        LinearLayout loginRow = horizontal();
        loginRow.setGravity(Gravity.CENTER);
        loginRow.addView(loginBtn, new LinearLayout.LayoutParams(dp(220), dp(48)));
        root.addView(loginRow, matchWrap());

        // 底部提示
        TextView footer = text("登录即表示同意上述协议", 11, false);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(0, dp(8), 0, 0);
        root.addView(footer, matchWrap());

        setContentView(root);
    }

    private void showPolicyDialog(String title, String body) {
        LinearLayout layout = vertical();
        layout.setPadding(dp(4), dp(2), dp(4), dp(2));
        layout.addView(text(body, 14, false), matchWrap());
        showGlassDialog(title, layout);
    }

    private void startOAuth() {
        api.oauthStart(uiCallback(url -> {
            if (url.isEmpty()) {
                toast("获取授权地址失败");
                return;
            }
            Uri uri = Uri.parse(url);
            String state = uri.getQueryParameter("state");
            String redirectUri = uri.getQueryParameter("redirect_uri");
            showWebViewOverlay(url, state != null ? state : "", redirectUri != null ? redirectUri : "");
        }, message -> {
            new AlertDialog.Builder(MainActivity.this)
                    .setTitle("OAuth 配置错误")
                    .setMessage("获取授权地址失败: " + message + "\n\n请确认服务端已配置 OAuth 参数（prefix、client_id、redirect_uri）。")
                    .setPositiveButton("确定", null)
                    .show();
        }));
    }

    private void showWebViewOverlay(String url, String expectedState, String redirectUri) {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.argb(200, 0, 0, 0));
        overlay.setClickable(true);

        int screenW = getResources().getDisplayMetrics().widthPixels;
        int screenH = getResources().getDisplayMetrics().heightPixels;
        int cardW = screenW - dp(48);
        int cardH = (int) (screenH * 0.72f);

        // WebView（圆角白色卡片）
        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setBuiltInZoomControls(false);
        webView.setBackgroundColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= 21) {
            webView.setClipToOutline(true);
            GradientDrawable wvBg = new GradientDrawable();
            wvBg.setColor(Color.WHITE);
            wvBg.setCornerRadius(dp(20));
            webView.setBackground(wvBg);
        }

        FrameLayout.LayoutParams wvParams = new FrameLayout.LayoutParams(cardW, cardH);
        wvParams.gravity = Gravity.CENTER;
        overlay.addView(webView, wvParams);

        // 右上角关闭按钮（浮动在卡片上方）
        ImageView closeBtn = new ImageView(this);
        closeBtn.setImageResource(getResources().getIdentifier("ic_close", "drawable", getPackageName()));
        closeBtn.setColorFilter(Color.WHITE, android.graphics.PorterDuff.Mode.SRC_IN);
        closeBtn.setPadding(dp(6), dp(6), dp(6), dp(6));
        closeBtn.setBackground(roundedDrawable(Color.argb(140, 0, 0, 0), dp(999)));
        closeBtn.setOnClickListener(v -> hideWebViewOverlay());
        closeBtn.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(dp(36), dp(36));
        closeParams.gravity = Gravity.TOP | Gravity.END;
        // 定位到卡片右上角外侧
        int closeMarginTop = (screenH - cardH) / 2 - dp(12);
        int closeMarginRight = (screenW - cardW) / 2 - dp(12);
        closeParams.setMargins(0, Math.max(0, closeMarginTop), Math.max(0, closeMarginRight), 0);
        overlay.addView(closeBtn, closeParams);

        // 加载指示器
        ProgressBar progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        if (Build.VERSION.SDK_INT >= 21) {
            progress.setIndeterminateTintList(ColorStateList.valueOf(theme.primaryButton));
        }
        FrameLayout.LayoutParams progParams = new FrameLayout.LayoutParams(dp(40), dp(40));
        progParams.gravity = Gravity.CENTER;
        overlay.addView(progress, progParams);

        webView.setWebViewClient(new WebViewClient() {
            private boolean codeExchanged;

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String requestUrl = request.getUrl().toString();
                if (redirectUri.isEmpty() || requestUrl.startsWith(redirectUri)) {
                    if (codeExchanged) return true;
                    codeExchanged = true;
                    Uri callbackUri = Uri.parse(requestUrl);
                    String code = callbackUri.getQueryParameter("code");
                    String state = callbackUri.getQueryParameter("state");
                    if (code == null || code.isEmpty() || !expectedState.equals(state)) {
                        mainHandler.post(() -> {
                            toast("OAuth 回调无效");
                            hideWebViewOverlay();
                        });
                        return true;
                    }
                    mainHandler.post(() -> {
                        webView.setVisibility(View.GONE);
                        progress.setVisibility(View.VISIBLE);
                    });
                    api.oauthCallback(code, state, uiCallback(user -> {
                        session = user;
                        store.saveSession(user);
                        theme = ThemeConfig.load(store.prefs(), session.qq);
                        mainHandler.post(() -> {
                            toast("登录成功");
                            hideWebViewOverlay();
                            shellWrapper = null;
                            showShell(0);
                        });
                    }, message -> {
                        mainHandler.post(() -> {
                            toast("登录失败: " + message);
                            hideWebViewOverlay();
                        });
                    }));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
            }
        });

        webView.loadUrl(url);

        // 将 overlay 添加到 DecorView 的内容层
        ViewGroup contentParent = (ViewGroup) getWindow().getDecorView().findViewById(android.R.id.content);
        contentParent.addView(overlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        webViewOverlay = overlay;
    }

    private void hideWebViewOverlay() {
        if (webViewOverlay == null) return;
        // 清除 WebView cookie，确保下次登录是全新会话
        if (Build.VERSION.SDK_INT >= 21) {
            android.webkit.CookieManager.getInstance().removeAllCookies(null);
        } else {
            android.webkit.CookieManager.getInstance().removeAllCookie();
        }
        View parent = (View) webViewOverlay.getParent();
        if (parent instanceof ViewGroup) {
            ((ViewGroup) parent).removeView(webViewOverlay);
        }
        webViewOverlay = null;
    }

    private void listenForOAuth(String expectedState, String codeVerifier) {
        new Thread(() -> {
            closeOAuthServer();
            try (ServerSocket server = new ServerSocket(AppConfig.OAUTH_CALLBACK_PORT, 1)) {
                server.setReuseAddress(true);
                oauthServer = server;
                Socket socket = server.accept();
                socket.setSoTimeout(5000);
                BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                // 读取请求行，然后跳过其余请求头
                String requestLine = reader.readLine();
                String line = requestLine;
                while (line != null && !line.isEmpty()) {
                    line = reader.readLine();
                }
                String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
                        "<title>授权完成</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;" +
                        "height:100vh;margin:0;background:#f5f5f5;color:#333;text-align:center}" +
                        "h2{color:#2a8a5c}</style></head><body><div><h2>✓ 授权完成</h2><p>请返回 Memories 应用。</p>" +
                        "<p style='color:#999;font-size:13px'>此页面可安全关闭</p></div>" +
                        "<script>setTimeout(function(){window.close();},600);</script></body></html>";
                byte[] body = html.getBytes(StandardCharsets.UTF_8);
                String header = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n";
                OutputStream out = socket.getOutputStream();
                out.write(header.getBytes(StandardCharsets.UTF_8));
                out.write(body);
                out.flush();
                socket.close();
                String path = requestLine == null ? "" : requestLine.split(" ")[1];
                String query = path.contains("?") ? path.substring(path.indexOf('?') + 1) : "";
                String code = queryValue(query, "code");
                String state = queryValue(query, "state");
                if (code.isEmpty() || !expectedState.equals(state)) {
                    mainHandler.post(() -> toast("OAuth 回调无效"));
                    return;
                }
                api.oauthCallback(code, state, uiCallback(user -> {
                    session = user;
                    store.saveSession(user);
                    theme = ThemeConfig.load(store.prefs(), session.qq);
                    showShell(0);
                }, this::toast));
            } catch (Exception exception) {
                mainHandler.post(() -> toast("无法监听 " + AppConfig.OAUTH_REDIRECT_URI + "：" + exception.getMessage()));
            } finally {
                closeOAuthServer();
            }
        }).start();
    }

    private void closeOAuthServer() {
        if (oauthServer == null) {
            return;
        }
        try {
            oauthServer.close();
        } catch (Exception ignored) {
        }
        oauthServer = null;
    }

    private String createCodeVerifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private String createCodeChallenge(String verifier) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.encodeToString(digest, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
        } catch (Exception exception) {
            return verifier;
        }
    }

    private void showShell(int selectedTab) {
        showShell(selectedTab, false, false);
    }

    private void showShell(int selectedTab, boolean slideLeft) {
        showShell(selectedTab, slideLeft, true);
    }

    private void showShell(int selectedTab, boolean slideLeft, boolean animate) {
        int screenW = getResources().getDisplayMetrics().widthPixels;
        View oldRoot = root;

        currentTab = selectedTab;
        root = vertical();
        applyBackground(root);
        // 状态栏高度
        int statusBarH = 0;
        if (Build.VERSION.SDK_INT >= 23) {
            android.graphics.Rect rect = new android.graphics.Rect();
            getWindow().getDecorView().getWindowVisibleDisplayFrame(rect);
            statusBarH = rect.top;
        }
        if (statusBarH <= 0) statusBarH = dp(24);
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(18), statusBarH + dp(4), dp(18), dp(4));
        title = text(tabTitle(selectedTab), 22, true);
        header.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        shellHeader = header;
        root.addView(header, matchWrap());
        content = new FrameLayout(this);
        addPageSwipe(content);
        root.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        FrameLayout navWrapper = new FrameLayout(this);
        LinearLayout nav = horizontal();
        nav.setPadding(dp(16), dp(4), dp(16), dp(4));
        nav.setBackground(navBarDrawable());
        LinearLayout leftBox = horizontal();
        leftBox.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        leftBox.addView(navButton("广场", "ic_plaza", selectedTab == 0, view -> showShell(0)), new LinearLayout.LayoutParams(dp(48), dp(48)));
        nav.addView(leftBox, new LinearLayout.LayoutParams(0, dp(48), 1));
        LinearLayout centerBox = horizontal();
        centerBox.setGravity(Gravity.CENTER);
        centerBox.addView(navButton("上传", "ic_upload", selectedTab == 1, view -> showShell(1)), new LinearLayout.LayoutParams(dp(48), dp(48)));
        nav.addView(centerBox, new LinearLayout.LayoutParams(0, dp(48), 1));
        LinearLayout rightBox = horizontal();
        rightBox.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        rightBox.addView(navButton("个人", "ic_profile", selectedTab == 2, view -> showShell(2)), new LinearLayout.LayoutParams(dp(48), dp(48)));
        nav.addView(rightBox, new LinearLayout.LayoutParams(0, dp(48), 1));
        navWrapper.addView(nav, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // 导航栏随主题颜色，玻璃质感
        navWrapper.setTag("nav_wrapper");
        navWrapper.setBackground(glassDrawable());

        FrameLayout.LayoutParams navWrapperParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        navWrapperParams.setMargins(0, dp(2), 0, 0);
        root.addView(navWrapper, navWrapperParams);

        if (animate && oldRoot != null && shellWrapper != null) {
            float startX = slideLeft ? screenW : -screenW;
            root.setTranslationX(startX);
            shellWrapper.addView(root);
            oldRoot.animate().translationX(slideLeft ? -screenW : screenW).setDuration(250)
                    .withEndAction(() -> shellWrapper.removeView(oldRoot)).start();
            root.animate().translationX(0).setDuration(250).start();
        } else {
            if (shellWrapper == null) {
                shellWrapper = new FrameLayout(this);
                setContentView(shellWrapper);
            }
            shellWrapper.removeAllViews();
            shellWrapper.addView(root);
        }

        if (selectedTab == 0) {
            showGallery();
        } else if (selectedTab == 1) {
            showUpload();
        } else {
            showProfile();
        }
    }

    private void addPageSwipe(FrameLayout content) {
        final float[] downX = new float[1];
        content.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                downX[0] = event.getX();
            } else if (event.getAction() == MotionEvent.ACTION_UP) {
                float dx = event.getX() - downX[0];
                if (Math.abs(dx) > dp(60)) {
                    int next = dx < 0 ? (currentTab + 1) % 3 : (currentTab + 2) % 3;
                    showShell(next, dx < 0);
                    return true;
                }
            }
            return false;
        });
    }

    private void showGallery() {
        title.setText("广场");
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = vertical();
        page.setPadding(dp(14), dp(4), dp(14), dp(16));
        page.addView(sectionTitle("流动广场"), matchWrap());
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(2);
        galleryGrid = grid;
        page.addView(grid, matchWrap());
        loadMoreButton = button("加载更多", "ic_load_more", view -> loadGallery(grid));
        GradientDrawable strokeBg = new GradientDrawable();
        strokeBg.setColor(Color.TRANSPARENT);
        strokeBg.setCornerRadius(dp(18));
        strokeBg.setStroke(dp(1), blend(theme.primaryButton, theme.primaryText, 0.35f));
        loadMoreButton.setBackground(strokeBg);
        loadMoreButton.setGravity(Gravity.CENTER);
        LinearLayout moreRow = horizontal();
        moreRow.setGravity(Gravity.CENTER);
        moreRow.addView(loadMoreButton, new LinearLayout.LayoutParams(dp(160), dp(44)));
        page.addView(moreRow, matchWrap());
        scroll.addView(page);
        content.addView(scroll);
        if (galleryItems.isEmpty()) {
            syncedUrls.clear();
            nextAfterId = 0;
            mergeGalleryItems(store.loadImageUrlCache());
            for (int i = 0; i < galleryItems.size(); i++) {
                queueImageCard(grid, galleryItems.get(i), i);
            }
            loadGallery(grid);
        } else {
            for (int i = 0; i < galleryItems.size(); i++) {
                queueImageCard(grid, galleryItems.get(i), i);
            }
        }
        // 如果处于批量选择模式，重建选择UI
        if (batchSelectMode) {
            updateBatchBar();
            refreshAllCardSelections(grid);
        }
    }

    // --- 批量选择模式 ---

    private void enterBatchMode(int firstIndex) {
        batchSelectMode = true;
        batchSelectedIndices.clear();
        batchSelectedIndices.add(firstIndex);
        updateBatchBar();
        refreshAllCardSelections(galleryGrid);
    }

    private void exitBatchMode() {
        batchSelectMode = false;
        batchSelectedIndices.clear();
        if (shellHeader != null) {
            shellHeader.removeAllViews();
            shellHeader.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        }
        if (galleryGrid != null) {
            refreshAllCardSelections(galleryGrid);
        }
    }

    private void toggleBatchSelection(int index) {
        if (batchSelectedIndices.contains(index)) {
            batchSelectedIndices.remove(index);
            if (batchSelectedIndices.isEmpty()) {
                exitBatchMode();
                return;
            }
        } else {
            batchSelectedIndices.add(index);
        }
        updateBatchBar();
        refreshAllCardSelections(galleryGrid);
    }

    private void updateBatchBar() {
        if (shellHeader == null) return;
        shellHeader.removeAllViews();

        int count = batchSelectedIndices.size();
        int total = galleryItems.size();

        // 已选数量
        TextView countText = new TextView(this);
        countText.setText(String.valueOf(count));
        countText.setTextColor(theme.primaryText);
        countText.setTextSize(17 * theme.fontScale);
        countText.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
        shellHeader.addView(countText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        // 全选/取消全选
        boolean allSelected = count == total && total > 0;
        Button selectAllBtn = new Button(this);
        selectAllBtn.setText(allSelected ? "取消全选" : "全选");
        selectAllBtn.setTextColor(theme.primaryButton);
        selectAllBtn.setTextSize(12 * theme.fontScale);
        selectAllBtn.setAllCaps(false);
        selectAllBtn.setPadding(dp(8), dp(2), dp(8), dp(2));
        selectAllBtn.setMinWidth(0);
        selectAllBtn.setMinHeight(0);
        selectAllBtn.setBackground(null);
        selectAllBtn.setOnClickListener(v -> {
            if (allSelected) {
                batchSelectedIndices.clear();
            } else {
                for (int i = 0; i < galleryItems.size(); i++) {
                    batchSelectedIndices.add(i);
                }
            }
            updateBatchBar();
            refreshAllCardSelections(galleryGrid);
        });
        shellHeader.addView(selectAllBtn, compactWrap());

        // 操作按钮组
        int btnSize = dp(36);

        // 下载
        Button downloadBtn = iconButton("ic_download", v -> batchDownload());
        shellHeader.addView(downloadBtn, new LinearLayout.LayoutParams(btnSize, btnSize));

        // 分享
        Button shareBtn = iconButton("ic_share", v -> batchShare());
        shellHeader.addView(shareBtn, new LinearLayout.LayoutParams(btnSize, btnSize));

        // 打印
        Button printBtn = iconButton("ic_print", v -> batchPrint());
        shellHeader.addView(printBtn, new LinearLayout.LayoutParams(btnSize, btnSize));

        // 复制URL
        Button copyBtn = iconButton("ic_copy_url", v -> batchCopyUrls());
        shellHeader.addView(copyBtn, new LinearLayout.LayoutParams(btnSize, btnSize));

        // 关闭
        Button closeBtn = iconButton("ic_close", v -> exitBatchMode());
        shellHeader.addView(closeBtn, new LinearLayout.LayoutParams(dp(36), dp(36)));
    }

    private void refreshAllCardSelections(GridLayout grid) {
        if (grid == null) return;
        for (int i = 0; i < grid.getChildCount(); i++) {
            View child = grid.getChildAt(i);
            if (child instanceof FrameLayout) {
                Object tag = child.getTag();
                int realIndex;
                if (tag instanceof Integer) {
                    realIndex = (Integer) tag;
                } else if (tag instanceof ImageItem) {
                    realIndex = galleryItems.indexOf(tag);
                } else {
                    continue;
                }
                refreshCardSelection((FrameLayout) child, realIndex);
            }
        }
    }

    private void refreshCardSelection(FrameLayout card, int index) {
        if (card.getChildCount() < 2) return;
        View overlay = card.getChildAt(1);
        if (!(overlay instanceof FrameLayout)) return;
        FrameLayout checkOverlay = (FrameLayout) overlay;

        boolean selected = batchSelectedIndices.contains(index);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.argb(selected ? 130 : 0, 0, 0, 0));
        bg.setCornerRadius(dp(14));
        checkOverlay.setBackground(bg);
        // 移除旧勾号，添加新勾号
        checkOverlay.removeAllViews();
        if (selected) {
            TextView checkMark = new TextView(this);
            checkMark.setText("✓");
            checkMark.setTextColor(Color.WHITE);
            checkMark.setTextSize(20 * theme.fontScale);
            checkMark.setTypeface(Typeface.DEFAULT_BOLD);
            checkMark.setGravity(Gravity.CENTER);
            checkMark.setBackground(roundedDrawable(theme.primaryButton, dp(16)));
            FrameLayout.LayoutParams checkParams = new FrameLayout.LayoutParams(dp(32), dp(32));
            checkParams.gravity = Gravity.TOP | Gravity.START;
            checkParams.setMargins(dp(8), dp(8), 0, 0);
            checkOverlay.addView(checkMark, checkParams);
        }
    }

    private void batchDownload() {
        List<Integer> indices = new ArrayList<>(batchSelectedIndices);
        if (indices.isEmpty()) return;
        int total = indices.size();
        final int[] finished = {0};
        final int[] failedCount = {0};
        showDownloadNotification(0, total, "正在准备下载...");
        for (int index : indices) {
            ImageItem item = galleryItems.get(index);
            imageCache.load(item.url, bitmapCallback(bitmap -> {
                downloadImage(bitmap, item);
                finished[0]++;
                int done = finished[0];
                showDownloadNotification(done, total,
                        "已完成 " + done + "/" + total + (failedCount[0] > 0 ? "（失败 " + failedCount[0] + "）" : ""));
                if (done >= total) {
                    int failCount = failedCount[0];
                    mainHandler.postDelayed(() -> finishDownloadNotification(total - failCount, failCount), 1500);
                }
            }, msg -> {
                failedCount[0]++;
                finished[0]++;
                int done = finished[0];
                showDownloadNotification(done, total,
                        "已完成 " + done + "/" + total + "（失败 " + failedCount[0] + "）");
                if (done >= total) {
                    int failCount = failedCount[0];
                    mainHandler.postDelayed(() -> finishDownloadNotification(total - failCount, failCount), 1500);
                }
            }));
        }
    }

    private void batchShare() {
        List<Integer> indices = new ArrayList<>(batchSelectedIndices);
        if (indices.isEmpty()) return;
        // 收集并分享所有选中图片
        List<Uri> uris = new java.util.ArrayList<>();
        int[] remaining = {indices.size()};
        toast("正在准备分享 " + indices.size() + " 张图片…");
        for (int index : indices) {
            ImageItem item = galleryItems.get(index);
            imageCache.load(item.url, bitmapCallback(bitmap -> {
                Uri uri = insertSharedBitmap(bitmap, item);
                if (uri != null) {
                    synchronized (uris) {
                        uris.add(uri);
                    }
                }
                remaining[0]--;
                if (remaining[0] <= 0) {
                    mainHandler.post(() -> {
                        if (uris.isEmpty()) {
                            toast("分享图片失败");
                            return;
                        }
                        Intent share = new Intent(uris.size() == 1
                                ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
                        share.setType("image/png");
                        if (uris.size() == 1) {
                            share.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                        } else {
                            share.putParcelableArrayListExtra(Intent.EXTRA_STREAM,
                                    new ArrayList<>(uris));
                        }
                        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(share, "分享 " + uris.size() + " 张图片"));
                    });
                }
            }, this::toast));
        }
    }

    private void batchPrint() {
        List<Integer> indices = new ArrayList<>(batchSelectedIndices);
        if (indices.isEmpty()) return;
        toast("正在准备打印 " + indices.size() + " 张图片…");
        for (int index : indices) {
            ImageItem item = galleryItems.get(index);
            imageCache.load(item.url, bitmapCallback(bitmap -> printImage(bitmap, item), this::toast));
        }
    }

    private void batchCopyUrls() {
        List<Integer> indices = new ArrayList<>(batchSelectedIndices);
        if (indices.isEmpty()) return;
        StringBuilder sb = new StringBuilder();
        for (int index : indices) {
            sb.append(galleryItems.get(index).url).append("\n");
        }
        ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        cm.setPrimaryClip(ClipData.newPlainText("Memories 图片链接", sb.toString().trim()));
        toast("已复制 " + indices.size() + " 个链接");
    }

    private void loadGallery(GridLayout grid) {
        if (galleryLoading) {
            return;
        }
        galleryLoading = true;
        final long requestAfterId = nextAfterId;
        api.images(requestAfterId, uiCallback(page -> {
            nextAfterId = page.nextAfterId == null ? nextAfterId : page.nextAfterId;
            if (page.nextAfterId == null && loadMoreButton != null) {
                loadMoreButton.setVisibility(View.GONE);
            }
            for (ImageItem item : page.items) {
                syncedUrls.add(item.url);
            }
            List<ImageItem> added = mergeGalleryItems(page.items);
            if (page.nextAfterId == null && !syncedUrls.isEmpty()) {
                int before = galleryItems.size();
                galleryItems.removeIf(item -> !syncedUrls.contains(item.url));
                if (galleryItems.size() < before) {
                    toast("已同步清理 " + (before - galleryItems.size()) + " 条失效记录");
                }
            }
            store.saveImageUrlCache(galleryItems);
            for (ImageItem item : added) {
                queueImageCard(grid, item, galleryItems.indexOf(item));
            }
            galleryLoading = false;
        }, message -> {
            galleryLoading = false;
            toast(message);
        }));
    }

    private List<ImageItem> mergeGalleryItems(List<ImageItem> incoming) {
        Map<String, ImageItem> byUrl = new LinkedHashMap<>();
        for (ImageItem item : galleryItems) {
            keepEarliest(byUrl, item);
        }
        List<ImageItem> added = new ArrayList<>();
        for (ImageItem item : incoming) {
            ImageItem previous = byUrl.get(item.url);
            if (previous == null) {
                byUrl.put(item.url, item);
                added.add(item);
            } else if (isEarlier(item, previous)) {
                int index = galleryItems.indexOf(previous);
                if (index >= 0) {
                    galleryItems.set(index, item);
                }
                byUrl.put(item.url, item);
            }
        }
        galleryItems.clear();
        galleryItems.addAll(byUrl.values());
        return added;
    }

    private void keepEarliest(Map<String, ImageItem> byUrl, ImageItem item) {
        ImageItem previous = byUrl.get(item.url);
        if (previous == null || isEarlier(item, previous)) {
            byUrl.put(item.url, item);
        }
    }

    private boolean isEarlier(ImageItem candidate, ImageItem current) {
        if (candidate.uploadedAt > 0 && current.uploadedAt > 0) {
            return candidate.uploadedAt < current.uploadedAt;
        }
        return candidate.id < current.id;
    }

    private void queueImageCard(GridLayout grid, ImageItem item, int index) {
        galleryQueue.add(() -> imageCache.load(item.url, bitmapCallback(bitmap -> addImageCard(grid, item, index, bitmap), this::toast)));
    }

    private void addImageCard(GridLayout grid, ImageItem item, int index, Bitmap bitmap) {
        // 外层容器，裁剪为圆角以匹配图片形状
        FrameLayout card = new FrameLayout(this);
        int cardSize = (getResources().getDisplayMetrics().widthPixels - dp(44)) / 2;
        card.setLayoutParams(new FrameLayout.LayoutParams(cardSize, cardSize));
        card.setTag(item);
        if (Build.VERSION.SDK_INT >= 21) {
            card.setClipToOutline(true);
            card.setOutlineProvider(new android.view.ViewOutlineProvider() {
                @Override
                public void getOutline(View view, android.graphics.Outline outline) {
                    outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), dp(14));
                }
            });
        }

        ImageView image = new ImageView(this);
        image.setImageBitmap(squareRoundedBitmap(bitmap, dp(14)));
        image.setScaleType(ImageView.ScaleType.FIT_XY);
        card.addView(image, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // 选择标记层 - 与图片框完全一致的圆角遮罩
        FrameLayout checkOverlay = new FrameLayout(this);
        GradientDrawable overlayBg = new GradientDrawable();
        int itemIndex = galleryItems.indexOf(item);
        overlayBg.setColor(Color.argb(batchSelectedIndices.contains(itemIndex) ? 130 : 0, 0, 0, 0));
        overlayBg.setCornerRadius(dp(14));
        checkOverlay.setBackground(overlayBg);
        checkOverlay.setClickable(false);

        // 选中勾号
        if (batchSelectedIndices.contains(itemIndex)) {
            TextView checkMark = new TextView(this);
            checkMark.setText("✓");
            checkMark.setTextColor(Color.WHITE);
            checkMark.setTextSize(20 * theme.fontScale);
            checkMark.setTypeface(Typeface.DEFAULT_BOLD);
            checkMark.setGravity(Gravity.CENTER);
            checkMark.setBackground(roundedDrawable(theme.primaryButton, dp(16)));
            FrameLayout.LayoutParams checkParams = new FrameLayout.LayoutParams(dp(32), dp(32));
            checkParams.gravity = Gravity.TOP | Gravity.START;
            checkParams.setMargins(dp(8), dp(8), 0, 0);
            checkOverlay.addView(checkMark, checkParams);
        }
        card.addView(checkOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        // 点击/长按事件 - 从 galleryItems 中查找真实索引
        card.setOnClickListener(view -> {
            ImageItem clickedItem = (ImageItem) view.getTag();
            int idx = galleryItems.indexOf(clickedItem);
            if (idx < 0) return;
            if (batchSelectMode) {
                toggleBatchSelection(idx);
            } else {
                showImageDialogAt(idx);
            }
        });
        card.setOnLongClickListener(view -> {
            if (!batchSelectMode) {
                ImageItem clickedItem = (ImageItem) view.getTag();
                int idx = galleryItems.indexOf(clickedItem);
                if (idx >= 0) {
                    enterBatchMode(idx);
                }
            }
            return true;
        });
        addPressEffect(image);

        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = cardSize;
        params.height = cardSize;
        params.setMargins(dp(4), dp(4), dp(4), dp(4));
        grid.addView(card, params);
    }

    private void showImageDialogAt(int index) {
        if (index < 0 || index >= galleryItems.size()) return;
        previewScale = 1f;
        previewRotation = 0f;
        previewFlippedHorizontal = false;
        previewFlippedVertical = false;
        previewTranslateX = 0;
        previewTranslateY = 0;
        previewMenuDim = null;
        ImageItem item = galleryItems.get(index);
        imageCache.load(item.url, bitmapCallback(bitmap -> {
            applyPreviewTransformToBitmap(bitmap);
            updateImageDialog(index, item, bitmap);
        }, this::toast));
    }

    private void applyPreviewTransformToBitmap(Bitmap bitmap) {
        // Reset transform on new image load
    }

    private void updateImageDialog(int index, ImageItem item, Bitmap bitmap) {
        if (previewOverlay == null) {
            previewOverlay = new FrameLayout(this);
            previewOverlay.setBackgroundColor(Color.argb(245, Color.red(theme.background), Color.green(theme.background), Color.blue(theme.background)));
            previewOverlay.setClickable(true);
        }
        // 保存菜单弹窗，避免 removeAllViews 把它也清掉
        View savedMenu = previewMenuDim;
        if (savedMenu != null && savedMenu.getParent() != null) {
            ((ViewGroup) savedMenu.getParent()).removeView(savedMenu);
        }
        previewOverlay.removeAllViews();
        LinearLayout page = vertical();
        LinearLayout topBar = horizontal();
        topBar.setGravity(Gravity.CENTER_VERTICAL);
        topBar.setPadding(dp(12), dp(8), dp(4), dp(8));
        TextView timeView = text(formatTime(item.uploadedAt), 14, false);
        timeView.setGravity(Gravity.CENTER_VERTICAL);
        topBar.addView(timeView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        topBar.addView(iconButton("ic_close", view -> hidePreview()), new LinearLayout.LayoutParams(dp(44), dp(44)));
        page.addView(topBar, matchWrap());
        FrameLayout imageBox = new FrameLayout(this);
        imageBox.setClipChildren(false);
        int screenW = getResources().getDisplayMetrics().widthPixels;
        // 当前图片
        ImageView curImage = new ImageView(this);
        curImage.setImageBitmap(roundedBitmap(bitmap, dp(5)));
        curImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        applyPreviewTransform(curImage);
        curImage.setTag("cur");
        imageBox.addView(curImage, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // 预加载相邻图片（放在屏幕外）
        if (galleryItems.size() > 1) {
            int prevIdx = (index - 1 + galleryItems.size()) % galleryItems.size();
            ImageView prevImage = new ImageView(this);
            prevImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
            prevImage.setTranslationX(-screenW);
            prevImage.setTag("prev:" + prevIdx);
            imageBox.addView(prevImage, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            imageCache.load(galleryItems.get(prevIdx).url, bitmapCallback(bmp ->
                    prevImage.setImageBitmap(roundedBitmap(bmp, dp(5))), msg -> {}));
            int nextIdx = (index + 1) % galleryItems.size();
            ImageView nextImage = new ImageView(this);
            nextImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
            nextImage.setTranslationX(screenW);
            nextImage.setTag("next:" + nextIdx);
            imageBox.addView(nextImage, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            imageCache.load(galleryItems.get(nextIdx).url, bitmapCallback(bmp ->
                    nextImage.setImageBitmap(roundedBitmap(bmp, dp(5))), msg -> {}));
        }
        attachPreviewSwipe(imageBox, index);
        page.addView(imageBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        LinearLayout bottomBar = horizontal();
        bottomBar.setGravity(Gravity.CENTER);
        bottomBar.setPadding(dp(12), dp(8), dp(12), dp(12));
        bottomBar.addView(iconButton("ic_menu", view -> showPreviewMenu(index, bitmap, item, curImage)), new LinearLayout.LayoutParams(dp(48), dp(48)));
        page.addView(bottomBar, matchWrap());
        previewOverlay.addView(page);

        // 非图片区域左右滑动切换图片（顶部栏、底部栏、左右边缘）
        // 逻辑：只有触摸点不在 imageBox（图片容器）上时，才触发左右滑动切换图片
        if (galleryItems.size() > 1) {
            final float[] swipeDownX = new float[1];
            final boolean[] swipeTrack = new boolean[1];
            previewOverlay.setOnTouchListener((v, event) -> {
                if (event.getPointerCount() > 1) return false;
                int action = event.getAction();
                if (action == MotionEvent.ACTION_DOWN) {
                    // 判断触摸点是否在图片区域（imageBox）内
                    int[] imgLoc = new int[2];
                    imageBox.getLocationOnScreen(imgLoc);
                    float rx = event.getRawX();
                    float ry = event.getRawY();
                    boolean onImageArea = rx >= imgLoc[0] && rx <= imgLoc[0] + imageBox.getWidth()
                                       && ry >= imgLoc[1] && ry <= imgLoc[1] + imageBox.getHeight();
                    if (onImageArea) {
                        // 在图片上，让 imageBox 处理缩放/拖动
                        swipeTrack[0] = false;
                        return false;
                    }
                    // 不在图片上（顶部栏/底部栏/边缘），开始滑动检测
                    swipeDownX[0] = event.getX();
                    swipeTrack[0] = true;
                    return false;
                } else if (action == MotionEvent.ACTION_MOVE && swipeTrack[0]) {
                    float dx = event.getX() - swipeDownX[0];
                    if (Math.abs(dx) > dp(30)) {
                        swipeTrack[0] = false;
                        int dir = dx > 0 ? -1 : 1;
                        int targetIndex = (previewIndex + dir + galleryItems.size()) % galleryItems.size();
                        float slideAnim = dx > 0 ? screenW : -screenW;
                        // 滑动动画
                        for (int i = 0; i < imageBox.getChildCount(); i++) {
                            View child = imageBox.getChildAt(i);
                            String tag = (String) child.getTag();
                            if (tag == null) continue;
                            float endTx;
                            if ("cur".equals(tag)) {
                                endTx = dx > 0 ? screenW : -screenW;
                            } else if (tag.startsWith("prev:")) {
                                endTx = -screenW + (dx > 0 ? screenW : -screenW);
                            } else if (tag.startsWith("next:")) {
                                endTx = screenW + (dx > 0 ? screenW : -screenW);
                            } else continue;
                            child.animate().translationX(endTx).setDuration(200).start();
                        }
                        mainHandler.postDelayed(() -> {
                            previewScale = 1f;
                            previewRotation = 0f;
                            previewFlippedHorizontal = false;
                            previewFlippedVertical = false;
                            previewTranslateX = 0;
                            previewTranslateY = 0;
                            previewMenuDim = null;
                            showImageDialogAt(targetIndex);
                        }, 220);
                        return true;
                    }
                    return false;
                } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                    swipeTrack[0] = false;
                    return false;
                }
                return false;
            });
        }
        if (previewOverlay.getParent() == null) {
            ((ViewGroup) getWindow().getDecorView()).addView(previewOverlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        }
        previewOverlay.setVisibility(View.VISIBLE);
        previewIndex = index;
        previewBitmap = bitmap;
        previewItem = item;
        previewImageView = curImage;
        // 恢复菜单弹窗
        if (savedMenu != null) {
            previewOverlay.addView(savedMenu, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            previewMenuDim = savedMenu;
        }
    }

    private void hidePreview() {
        if (previewOverlay != null) {
            previewOverlay.setVisibility(View.GONE);
        }
        previewMenuDim = null;
    }

    private void showPreviewMenu(int index, Bitmap bitmap, ImageItem item, ImageView image) {
        FrameLayout dim = new FrameLayout(this);
        dim.setBackgroundColor(Color.argb(120, 0, 0, 0));
        dim.setClickable(true);
        dim.setOnClickListener(v -> previewOverlay.removeView(dim));
        LinearLayout card = vertical();
        card.setPadding(dp(8), dp(4), dp(8), dp(14));
        card.setBackground(roundedDrawable(theme.background, dp(20)));
        LinearLayout menuTop = horizontal();
        menuTop.setGravity(Gravity.CENTER_VERTICAL);
        menuTop.addView(text("操作", 14, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        menuTop.addView(iconButton("ic_close", v -> previewOverlay.removeView(dim)), new LinearLayout.LayoutParams(dp(36), dp(36)));
        card.addView(menuTop, matchWrap());
        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(4);
        grid.setPadding(dp(4), dp(8), dp(4), 0);
        addMenuTile(grid, "分享", "ic_share", () -> shareImage(bitmap, item));
        addMenuTile(grid, "下载", "ic_download", () -> downloadImage(bitmap, item));
        addMenuTile(grid, "信息", "ic_info", () -> queryImageInfo(item.url));
        addMenuTile(grid, "复制URL", "ic_copy_url", () -> copyImageUrl(item.url));
        addMenuTile(grid, "放大", "ic_zoom_in", () -> {
            previewScale = Math.min(4f, previewScale * 1.25f);
            applyPreviewTransform(image);
        });
        addMenuTile(grid, "缩小", "ic_zoom_out", () -> {
            previewScale = Math.max(0.1f, previewScale * 0.8f);
            applyPreviewTransform(image);
        });
        addMenuTile(grid, "壁纸", "ic_wallpaper", () -> applyWallpaper(bitmap));
        addMenuTile(grid, "旋转", "ic_rotate", () -> { previewRotation = (previewRotation + 90) % 360; applyPreviewTransform(image); });
        addMenuTile(grid, "还原", "ic_reset", () -> {
            previewScale = 1f;
            previewRotation = 0f;
            previewFlippedHorizontal = false;
            previewFlippedVertical = false;
            previewTranslateX = 0;
            previewTranslateY = 0;
            applyPreviewTransform(image);
        });
        addMenuTile(grid, "左右翻转", "ic_flip_h", () -> { previewFlippedHorizontal = !previewFlippedHorizontal; applyPreviewTransform(image); });
        addMenuTile(grid, "上下翻转", "ic_flip_v", () -> { previewFlippedVertical = !previewFlippedVertical; applyPreviewTransform(image); });
        addMenuTile(grid, "打印", "ic_print", () -> printImage(bitmap, item));
        card.addView(grid, matchWrap());
        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cardParams.setMargins(dp(16), 0, dp(16), dp(16));
        cardParams.gravity = Gravity.BOTTOM;
        dim.addView(card, cardParams);
        previewMenuDim = dim;
        previewOverlay.addView(dim, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void addMenuTile(GridLayout grid, String label, String icon, Runnable action) {
        LinearLayout tile = vertical();
        tile.setGravity(Gravity.CENTER);
        tile.setPadding(dp(4), dp(8), dp(4), dp(8));
        tile.setOnClickListener(v -> action.run());
        addPressEffect(tile);
        ImageView glyph = new ImageView(this);
        glyph.setImageResource(getResources().getIdentifier(icon, "drawable", getPackageName()));
        tile.addView(glyph, new LinearLayout.LayoutParams(dp(26), dp(26)));
        TextView lbl = new TextView(this);
        lbl.setText(label);
        lbl.setTextColor(theme.secondaryText);
        lbl.setTextSize(10 * theme.fontScale);
        lbl.setGravity(Gravity.CENTER);
        lbl.setPadding(0, dp(2), 0, 0);
        tile.addView(lbl, matchWrap());
        int size = (getResources().getDisplayMetrics().widthPixels - dp(64)) / 4;
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = size;
        params.height = dp(64);
        grid.addView(tile, params);
    }

    private void attachPreviewSwipe(FrameLayout imageBox, int index) {
        final int screenW = getResources().getDisplayMetrics().widthPixels;

        ScaleGestureDetector detector = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            private float startScale;
            @Override
            public boolean onScaleBegin(ScaleGestureDetector sgd) {
                startScale = previewScale;
                return true;
            }
            @Override
            public boolean onScale(ScaleGestureDetector sgd) {
                previewScale = Math.max(0.1f, Math.min(4f, startScale * sgd.getScaleFactor()));
                for (int i = 0; i < imageBox.getChildCount(); i++) {
                    View child = imageBox.getChildAt(i);
                    if (child instanceof ImageView && "cur".equals(child.getTag())) {
                        applyPreviewTransform((ImageView) child);
                        break;
                    }
                }
                return true;
            }
        });

        final float[] downX = new float[1];
        final float[] downY = new float[1];
        final float[] panStartX = new float[1];
        final float[] panStartY = new float[1];
        final boolean[] isSwiping = {false};
        final boolean[] isPanning = {false};

        imageBox.setOnTouchListener((view, event) -> {
            detector.onTouchEvent(event);
            if (event.getPointerCount() > 1) {
                isSwiping[0] = false;
                isPanning[0] = false;
                return true;
            }

            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downX[0] = event.getX();
                    downY[0] = event.getY();
                    panStartX[0] = previewTranslateX;
                    panStartY[0] = previewTranslateY;
                    isSwiping[0] = false;
                    isPanning[0] = false;
                    break;
                case MotionEvent.ACTION_MOVE: {
                    float dx = event.getX() - downX[0];
                    float dy = event.getY() - downY[0];
                    if (!isSwiping[0] && !isPanning[0] && Math.abs(dx) + Math.abs(dy) > dp(10)) {
                        // 缩放时始终允许单指拖动平移
                        isPanning[0] = true;
                    }
                    if (isPanning[0]) {
                        previewTranslateX = panStartX[0] + dx;
                        previewTranslateY = panStartY[0] + dy;
                        for (int i = 0; i < imageBox.getChildCount(); i++) {
                            View child = imageBox.getChildAt(i);
                            if (child instanceof ImageView && "cur".equals(child.getTag())) {
                                applyPreviewTransform((ImageView) child);
                                break;
                            }
                        }
                    }
                    break;
                }
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    isSwiping[0] = false;
                    isPanning[0] = false;
                    break;
            }
            return true;
        });
    }

    private void applySwipeOffset(FrameLayout imageBox, float dx, float screenW) {
        for (int i = 0; i < imageBox.getChildCount(); i++) {
            View child = imageBox.getChildAt(i);
            String tag = (String) child.getTag();
            if (tag == null) continue;
            if ("cur".equals(tag)) {
                child.setTranslationX(dx);
            } else if (tag != null && tag.startsWith("prev:")) {
                child.setTranslationX(-screenW + dx);
            } else if (tag != null && tag.startsWith("next:")) {
                child.setTranslationX(screenW + dx);
            }
        }
    }

    private void animateSwipeCommit(FrameLayout imageBox, float targetOffset, int screenW, Runnable onEnd) {
        for (int i = 0; i < imageBox.getChildCount(); i++) {
            View child = imageBox.getChildAt(i);
            String tag = (String) child.getTag();
            if (tag == null) continue;
            float endTx;
            if ("cur".equals(tag)) {
                endTx = targetOffset;
            } else if (tag.startsWith("prev:")) {
                endTx = -screenW + targetOffset;
            } else if (tag.startsWith("next:")) {
                endTx = screenW + targetOffset;
            } else {
                continue;
            }
            child.animate().translationX(endTx).setDuration(200).start();
        }
        if (onEnd != null) {
            mainHandler.postDelayed(onEnd, 220);
        }
    }

    private void queryImageInfo(String url) {
        // 先显示加载弹窗
        LinearLayout loadingLayout = vertical();
        loadingLayout.setGravity(Gravity.CENTER);
        loadingLayout.setPadding(dp(16), dp(36), dp(16), dp(36));
        ProgressBar spinner = new ProgressBar(this);
        loadingLayout.addView(spinner, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView loadingText = text("查询中...", 14, false);
        loadingText.setGravity(Gravity.CENTER);
        loadingLayout.addView(loadingText, matchWrap());
        AlertDialog loadingDialog = showGlassDialog("图片信息", loadingLayout);

        String q = url.substring(url.lastIndexOf('/') + 1);
        api.queryImageHost(q, uiCallback(json -> {
            loadingDialog.dismiss();
            JSONObject data = json.optJSONObject("data");
            LinearLayout layout = vertical();
            layout.setPadding(dp(16), dp(12), dp(16), dp(12));
            layout.setBackground(glassDrawable());
            List<TextView> valueViews = new ArrayList<>();
            if (data == null) {
                valueViews.add(buildTypewriterRow(layout, "原始响应", json.toString()));
            } else {
                valueViews.add(buildTypewriterRow(layout, "文件名", data.optString("filename")));
                valueViews.add(buildTypewriterRow(layout, "存储", data.optString("storage_location")));
                valueViews.add(buildTypewriterRow(layout, "标签", data.optString("tags")));
                valueViews.add(buildTypewriterRow(layout, "描述", data.optString("content_description")));
            }
            showGlassDialog("图片信息", layout);
            // 打字机动画逐行显示
            typewriterSequence(valueViews, 0);
        }, message -> {
            loadingDialog.dismiss();
            toast(message);
        }));
    }

    private TextView buildTypewriterRow(LinearLayout parent, String label, String fullValue) {
        LinearLayout row = vertical();
        row.setPadding(dp(14), dp(10), dp(14), dp(10));
        row.setBackground(roundedDrawable(theme.secondaryButton, dp(18)));
        row.addView(text(label, 12, true), matchWrap());
        TextView valueView = text("", 14, false);
        valueView.setTag(fullValue);
        row.addView(valueView, matchWrap());
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(5), 0, dp(5));
        parent.addView(row, params);
        return valueView;
    }

    private void typewriterSequence(List<TextView> views, int index) {
        if (index >= views.size()) return;
        TextView view = views.get(index);
        String fullText = (String) view.getTag();
        if (fullText == null || fullText.isEmpty()) {
            view.setText("无");
            typewriterSequence(views, index + 1);
            return;
        }
        typewriterText(view, fullText, 0, () -> typewriterSequence(views, index + 1));
    }

    private void typewriterText(TextView view, String text, int pos, Runnable onDone) {
        if (pos >= text.length()) {
            if (onDone != null) onDone.run();
            return;
        }
        view.setText(text.substring(0, pos + 1));
        mainHandler.postDelayed(() -> typewriterText(view, text, pos + 1, onDone), 30);
    }

    private void showUpload() {
        title.setText("上传");
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = vertical();
        page.setPadding(dp(16), dp(4), dp(16), dp(16));
        // 大号上传按钮（替代原来的 heroPanel + 小按钮）
        LinearLayout uploadHero = new LinearLayout(this);
        uploadHero.setOrientation(LinearLayout.VERTICAL);
        uploadHero.setGravity(Gravity.CENTER);
        uploadHero.setPadding(dp(24), dp(28), dp(24), dp(24));
        uploadHero.setBackground(gradientDrawable(theme.primaryButton, blend(theme.primaryButton, theme.background, 0.55f), dp(22)));
        ImageView uploadIcon = new ImageView(this);
        uploadIcon.setImageResource(getResources().getIdentifier("ic_upload", "drawable", getPackageName()));
        uploadIcon.setColorFilter(theme.background, android.graphics.PorterDuff.Mode.SRC_IN);
        uploadHero.addView(uploadIcon, new LinearLayout.LayoutParams(dp(48), dp(48)));
        TextView uploadLabel = new TextView(this);
        uploadLabel.setText("选择图片上传");
        uploadLabel.setTextColor(theme.background);
        uploadLabel.setTextSize(18 * theme.fontScale);
        uploadLabel.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
        uploadLabel.setGravity(Gravity.CENTER);
        uploadLabel.setPadding(0, dp(10), 0, 0);
        uploadHero.addView(uploadLabel, matchWrap());
        TextView uploadHint = new TextView(this);
        uploadHint.setText("支持多选 · Telegram 存储 · 通知栏同步进度");
        uploadHint.setTextColor(blend(theme.background, theme.primaryButton, 0.3f));
        uploadHint.setTextSize(12 * theme.fontScale);
        uploadHint.setGravity(Gravity.CENTER);
        uploadHint.setPadding(0, dp(4), 0, 0);
        uploadHero.addView(uploadHint, matchWrap());
        uploadHero.setOnClickListener(v -> pickImages());
        addPressEffect(uploadHero);
        LinearLayout.LayoutParams heroParams = matchWrap();
        heroParams.setMargins(0, dp(6), 0, dp(14));
        page.addView(uploadHero, heroParams);
        LinearLayout queueView = vertical();
        page.addView(queueView, matchWrap());
        renderUploadQueue(queueView);
        scroll.addView(page);
        content.addView(scroll);
    }

    private void pickImages() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent, REQUEST_PICK_IMAGES);
    }

    private void addPickedImages(Intent data) {
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int index = 0; index < clip.getItemCount(); index++) {
                enqueueUpload(new UploadTask(clip.getItemAt(index).getUri()));
            }
        } else if (data.getData() != null) {
            enqueueUpload(new UploadTask(data.getData()));
        }
    }

    private void enqueueUpload(UploadTask task) {
        uploadTasks.add(task);
        saveUploadTasks();
        updateUploadNotification(task, "等待上传", 0, false);
        uploadQueue.add(() -> runUpload(task));
    }

    private void runUpload(UploadTask task) {
        task.status = UploadTask.UPLOADING;
        task.progress = 20;
        task.message = "上传到图床";
        updateUploadNotification(task, task.message, task.progress, false);
        mainHandler.post(() -> showUpload());
        long uploadAnimMs = 1000 + (long)(Math.random() * 3000);
        ValueAnimator uploadAnim = ValueAnimator.ofFloat(20f, 68f);
        uploadAnim.setDuration(uploadAnimMs);
        uploadAnim.addUpdateListener(animation -> {
            task.progress = (Float) animation.getAnimatedValue();
            updateUploadNotification(task, task.message, task.progress, false);
            mainHandler.post(() -> showUpload());
        });
        uploadAnim.start();
        Runnable uploadFloor = new Runnable() {
            public void run() {
                if (task.status != UploadTask.UPLOADING) return;
                if (task.progress < 68) {
                    task.progress = Math.min(68, task.progress + 0.1f);
                    updateUploadNotification(task, task.message, task.progress, false);
                    mainHandler.post(() -> showUpload());
                }
                mainHandler.postDelayed(this, 1000);
            }
        };
        mainHandler.postDelayed(uploadFloor, 1000);
        api.uploadToImageHost(this, task.uri, selectedOutputFormat, uiCallback(url -> {
            uploadAnim.cancel();
            mainHandler.removeCallbacks(uploadFloor);
            task.progress = 70;
            task.message = "写入 Memories API";
            updateUploadNotification(task, task.message, task.progress, false);
            mainHandler.post(() -> showUpload());
            long writeAnimMs = 500 + (long)(Math.random() * 1500);
            ValueAnimator writeAnim = ValueAnimator.ofFloat(70f, 99f);
            writeAnim.setDuration(writeAnimMs);
            writeAnim.addUpdateListener(animation -> {
                task.progress = (Float) animation.getAnimatedValue();
                updateUploadNotification(task, task.message, task.progress, false);
                mainHandler.post(() -> showUpload());
            });
            writeAnim.start();
            Runnable writeFloor = new Runnable() {
                public void run() {
                    if (task.status != UploadTask.UPLOADING) return;
                    if (task.progress < 99) {
                        task.progress = Math.min(99, task.progress + 0.1f);
                        updateUploadNotification(task, task.message, task.progress, false);
                        mainHandler.post(() -> showUpload());
                    }
                    mainHandler.postDelayed(this, 1000);
                }
            };
            mainHandler.postDelayed(writeFloor, 1000);
            api.createMemoryImage(url, uiCallback(item -> {
                writeAnim.cancel();
                mainHandler.removeCallbacks(writeFloor);
                task.status = UploadTask.DONE;
                task.progress = 100;
                task.url = item.url;
                task.message = "完成";
                updateUploadNotification(task, "上传完成", task.progress, true);
                store.appendUploadRecord(item.url);
                galleryItems.add(0, item);
                store.saveImageUrlCache(galleryItems);
                saveUploadTasks();
                showUpload();
            }, message -> {
                writeAnim.cancel();
                mainHandler.removeCallbacks(writeFloor);
                failTask(task, message);
            }));
        }, message -> {
            uploadAnim.cancel();
            mainHandler.removeCallbacks(uploadFloor);
            failTask(task, message);
        }));
    }

    private void failTask(UploadTask task, String message) {
        task.status = UploadTask.FAILED;
        task.message = message;
        updateUploadNotification(task, "上传失败：" + message, task.progress, true);
        saveUploadTasks();
        showUpload();
    }

    private void renderUploadQueue(LinearLayout queueView) {
        queueView.removeAllViews();
        if (uploadTasks.isEmpty()) {
            LinearLayout emptyBox = new LinearLayout(this);
            emptyBox.setOrientation(LinearLayout.VERTICAL);
            emptyBox.setGravity(Gravity.CENTER);
            emptyBox.setPadding(dp(24), dp(36), dp(24), dp(36));
            ImageView emptyIcon = new ImageView(this);
            emptyIcon.setImageResource(getResources().getIdentifier("ic_upload", "drawable", getPackageName()));
            emptyIcon.setAlpha(0.35f);
            emptyBox.addView(emptyIcon, new LinearLayout.LayoutParams(dp(56), dp(56)));
            TextView emptyText = text("暂无上传任务", 14, false);
            emptyText.setGravity(Gravity.CENTER);
            emptyText.setAlpha(0.5f);
            emptyBox.addView(emptyText, matchWrap());
            TextView hintText = text("点击上方按钮选择图片开始上传", 12, false);
            hintText.setGravity(Gravity.CENTER);
            hintText.setAlpha(0.35f);
            emptyBox.addView(hintText, matchWrap());
            queueView.addView(emptyBox, matchWrap());
            return;
        }

        // 统计
        int waiting = 0, uploading = 0, done = 0, failed = 0;
        for (UploadTask t : uploadTasks) {
            if (t.status == UploadTask.WAITING) waiting++;
            else if (t.status == UploadTask.UPLOADING) uploading++;
            else if (t.status == UploadTask.DONE) done++;
            else if (t.status == UploadTask.FAILED) failed++;
        }

        // 汇总栏
        LinearLayout summaryRow = new LinearLayout(this);
        summaryRow.setOrientation(LinearLayout.HORIZONTAL);
        summaryRow.setGravity(Gravity.CENTER_VERTICAL);
        summaryRow.setPadding(dp(16), dp(12), dp(14), dp(12));
        summaryRow.setBackground(gradientDrawable(theme.primaryButton, blend(theme.primaryButton, theme.background, 0.58f), dp(18)));

        LinearLayout summaryLeft = new LinearLayout(this);
        summaryLeft.setOrientation(LinearLayout.VERTICAL);
        TextView summaryTitle = text("上传队列", 16, true);
        summaryTitle.setTextColor(theme.background);
        summaryLeft.addView(summaryTitle, matchWrap());
        TextView summarySub = text("共 " + uploadTasks.size() + " 个任务", 11, false);
        summarySub.setTextColor(blend(theme.background, theme.primaryButton, 0.25f));
        summaryLeft.addView(summarySub, matchWrap());
        summaryRow.addView(summaryLeft, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

        LinearLayout badgesRow = new LinearLayout(this);
        badgesRow.setOrientation(LinearLayout.HORIZONTAL);
        badgesRow.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        if (uploading > 0) badgesRow.addView(summaryBadge("上传中 " + uploading, Color.rgb(219, 160, 55)), compactWrap());
        if (waiting > 0) badgesRow.addView(summaryBadge("等待 " + waiting, blend(theme.background, theme.primaryButton, 0.35f)), compactWrap());
        if (done > 0) badgesRow.addView(summaryBadge("完成 " + done, Color.rgb(42, 138, 92)), compactWrap());
        if (failed > 0) badgesRow.addView(summaryBadge("失败 " + failed, Color.rgb(205, 93, 61)), compactWrap());
        summaryRow.addView(badgesRow, compactWrap());

        LinearLayout.LayoutParams summaryParams = matchWrap();
        summaryParams.setMargins(0, dp(4), 0, dp(10));
        queueView.addView(summaryRow, summaryParams);

        // 批量操作栏
        if (failed > 0 || done > 0) {
            LinearLayout batchRow = new LinearLayout(this);
            batchRow.setOrientation(LinearLayout.HORIZONTAL);
            batchRow.setGravity(Gravity.CENTER);
            batchRow.setPadding(0, 0, 0, dp(4));
            if (failed > 0) {
                Button retryAll = compactButton("全部重试", "ic_upload", v -> {
                    for (UploadTask t : uploadTasks) {
                        if (t.status == UploadTask.FAILED) {
                            retryUpload(t);
                        }
                    }
                });
                retryAll.setGravity(Gravity.CENTER);
                batchRow.addView(retryAll, new LinearLayout.LayoutParams(dp(120), dp(34)));
            }
            if (done > 0) {
                Button clearDone = compactButton("清除已完成", "ic_clear", v -> {
                    uploadTasks.removeIf(t -> t.status == UploadTask.DONE);
                    saveUploadTasks();
                    showUpload();
                });
                clearDone.setGravity(Gravity.CENTER);
                LinearLayout.LayoutParams clearLp = new LinearLayout.LayoutParams(dp(120), dp(34));
                if (failed > 0) clearLp.setMargins(dp(8), 0, 0, 0);
                batchRow.addView(clearDone, clearLp);
            }
            queueView.addView(batchRow, matchWrap());
        }

        // 任务卡片列表
        for (int i = 0; i < uploadTasks.size(); i++) {
            UploadTask task = uploadTasks.get(i);
            String fileName = resolveFileName(task.uri);

            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(14), dp(12), dp(14), dp(12));
            card.setBackground(glassDrawable());

            // 顶部行：缩略图 + 文件信息 + 进度
            LinearLayout topRow = new LinearLayout(this);
            topRow.setOrientation(LinearLayout.HORIZONTAL);
            topRow.setGravity(Gravity.CENTER_VERTICAL);

            // 缩略图
            ImageView thumbnail = new ImageView(this);
            thumbnail.setScaleType(ImageView.ScaleType.CENTER_CROP);
            int thumbSize = dp(56);
            LinearLayout.LayoutParams thumbParams = new LinearLayout.LayoutParams(thumbSize, thumbSize);
            thumbParams.setMargins(0, 0, dp(14), 0);
            topRow.addView(thumbnail, thumbParams);

            boolean thumbLoaded = false;
            try {
                android.graphics.Bitmap thumbBmp = MediaStore.Images.Media.getBitmap(getContentResolver(), task.uri);
                if (thumbBmp != null) {
                    thumbnail.setImageBitmap(roundedBitmap(
                            Bitmap.createScaledBitmap(thumbBmp, thumbSize, thumbSize, true), dp(12)));
                    thumbLoaded = true;
                }
            } catch (Exception ignored) {
            }
            if (!thumbLoaded) {
                // 缩略图加载失败，根据状态显示不同占位图标
                int iconRes = task.status == UploadTask.DONE
                        ? getResources().getIdentifier("ic_gallery", "drawable", getPackageName())
                        : getResources().getIdentifier("ic_upload", "drawable", getPackageName());
                thumbnail.setImageResource(iconRes);
                thumbnail.setPadding(dp(12), dp(12), dp(12), dp(12));
                thumbnail.setBackground(roundedDrawable(
                        task.status == UploadTask.FAILED
                                ? blend(Color.rgb(205, 93, 61), theme.background, 0.6f)
                                : theme.secondaryButton,
                        dp(12)));
                thumbnail.setScaleType(ImageView.ScaleType.FIT_CENTER);
            }

            // 文件信息列
            LinearLayout infoCol = new LinearLayout(this);
            infoCol.setOrientation(LinearLayout.VERTICAL);
            infoCol.setGravity(Gravity.CENTER_VERTICAL);

            // 文件名
            TextView nameText = text(fileName, 14, true);
            nameText.setMaxLines(1);
            infoCol.addView(nameText, matchWrap());

            // 状态行：圆点 + 状态文字
            LinearLayout statusRow = new LinearLayout(this);
            statusRow.setOrientation(LinearLayout.HORIZONTAL);
            statusRow.setGravity(Gravity.CENTER_VERTICAL);
            statusRow.setPadding(0, dp(2), 0, 0);

            View dot = new View(this);
            int dotSize = dp(8);
            LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(dotSize, dotSize);
            dotParams.setMargins(0, 0, dp(6), 0);
            dotParams.gravity = Gravity.CENTER_VERTICAL;
            dot.setBackground(roundedDrawable(statusDotColor(task), dotSize / 2));
            statusRow.addView(dot, dotParams);

            TextView statusText = text(statusLabel(task), 12, false);
            statusText.setTextColor(statusTextColor(task));
            statusRow.addView(statusText, compactWrap());
            infoCol.addView(statusRow, matchWrap());

            // 额外信息行 - 完成时URL可点击复制
            if (task.status == UploadTask.DONE && !task.url.isEmpty()) {
                TextView urlText = text(truncateUrl(task.url), 11, false);
                urlText.setTextColor(blend(theme.primaryButton, theme.secondaryText, 0.6f));
                urlText.setMaxLines(1);
                urlText.setOnClickListener(v -> {
                    ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                    cm.setPrimaryClip(ClipData.newPlainText("图片链接", task.url));
                    toast("已复制图片链接");
                });
                addPressEffect(urlText);
                infoCol.addView(urlText, matchWrap());
            }
            if (task.status == UploadTask.FAILED) {
                TextView errText = text(task.message, 11, false);
                errText.setTextColor(Color.rgb(205, 93, 61));
                errText.setMaxLines(1);
                infoCol.addView(errText, matchWrap());
            }

            topRow.addView(infoCol, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));

            // 进度百分比（右上角）
            if (task.status == UploadTask.UPLOADING || task.status == UploadTask.WAITING) {
                String pct = task.progress == (int) task.progress
                        ? String.valueOf((int) task.progress) + "%"
                        : String.format("%.0f%%", task.progress);
                TextView pctText = new TextView(this);
                pctText.setText(pct);
                pctText.setTextColor(progressColor(task));
                pctText.setTextSize(18 * theme.fontScale);
                pctText.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
                pctText.setGravity(Gravity.CENTER);
                pctText.setPadding(dp(4), 0, 0, 0);
                topRow.addView(pctText, new LinearLayout.LayoutParams(dp(52), ViewGroup.LayoutParams.WRAP_CONTENT));
            } else if (task.status == UploadTask.DONE) {
                TextView doneMark = new TextView(this);
                doneMark.setText("✓");
                doneMark.setTextColor(Color.rgb(42, 138, 92));
                doneMark.setTextSize(22 * theme.fontScale);
                doneMark.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
                doneMark.setGravity(Gravity.CENTER);
                topRow.addView(doneMark, new LinearLayout.LayoutParams(dp(44), ViewGroup.LayoutParams.WRAP_CONTENT));
            } else {
                TextView failMark = new TextView(this);
                failMark.setText("✗");
                failMark.setTextColor(Color.rgb(205, 93, 61));
                failMark.setTextSize(22 * theme.fontScale);
                failMark.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
                failMark.setGravity(Gravity.CENTER);
                topRow.addView(failMark, new LinearLayout.LayoutParams(dp(44), ViewGroup.LayoutParams.WRAP_CONTENT));
            }

            card.addView(topRow, matchWrap());

            // 进度条（仅上传中显示）
            if (task.status == UploadTask.UPLOADING) {
                ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
                bar.setMax(100);
                bar.setProgress((int) task.progress);
                bar.setProgressDrawable(progressBarDrawable(progressColor(task)));
                LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, dp(6));
                barParams.setMargins(0, dp(10), 0, dp(2));
                card.addView(bar, barParams);
            }

            // 操作按钮（仅失败时显示）
            if (task.status == UploadTask.FAILED) {
                LinearLayout actionRow = new LinearLayout(this);
                actionRow.setOrientation(LinearLayout.HORIZONTAL);
                actionRow.setGravity(Gravity.CENTER);
                actionRow.setPadding(0, dp(8), 0, 0);
                Button retryBtn = compactButton("重新上传", "ic_upload", v -> retryUpload(task));
                retryBtn.setGravity(Gravity.CENTER);
                actionRow.addView(retryBtn, new LinearLayout.LayoutParams(0, dp(36), 1));
                View spacer = new View(this);
                actionRow.addView(spacer, new LinearLayout.LayoutParams(dp(8), 0));
                Button removeBtn = compactButton("移除", "ic_clear", v -> {
                    uploadTasks.remove(task);
                    saveUploadTasks();
                    showUpload();
                });
                removeBtn.setGravity(Gravity.CENTER);
                actionRow.addView(removeBtn, new LinearLayout.LayoutParams(0, dp(36), 1));
                card.addView(actionRow, matchWrap());
            }

            LinearLayout.LayoutParams cardParams = matchWrap();
            cardParams.setMargins(0, dp(3), 0, dp(3));
            queueView.addView(card, cardParams);
        }
    }

    private String resolveFileName(Uri uri) {
        String name = null;
        try {
            // 尝试通过 ContentResolver 查询文件名
            String[] projection = {android.provider.OpenableColumns.DISPLAY_NAME};
            android.database.Cursor cursor = getContentResolver().query(uri, projection, null, null, null);
            if (cursor != null) {
                try {
                    if (cursor.moveToFirst()) {
                        int nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                        if (nameIndex >= 0) {
                            name = cursor.getString(nameIndex);
                        }
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (Exception ignored) {
        }
        if (name == null || name.isEmpty()) {
            // 从 URI 路径中提取文件名
            String path = uri.getLastPathSegment();
            if (path != null && !path.isEmpty()) {
                name = path;
            } else {
                name = uri.toString();
            }
        }
        // 截断过长的文件名
        if (name.length() > 40) {
            name = name.substring(0, 18) + "…" + name.substring(name.length() - 18);
        }
        return name;
    }

    private int statusTextColor(UploadTask task) {
        switch (task.status) {
            case UploadTask.UPLOADING: return theme.primaryButton;
            case UploadTask.DONE: return Color.rgb(42, 138, 92);
            case UploadTask.FAILED: return Color.rgb(205, 93, 61);
            default: return theme.secondaryText;
        }
    }

    private TextView summaryBadge(String text, int color) {
        TextView badge = new TextView(this);
        badge.setText(text);
        badge.setTextColor(theme.background);
        badge.setTextSize(11);
        badge.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
        badge.setGravity(Gravity.CENTER);
        badge.setPadding(dp(8), dp(2), dp(8), dp(2));
        badge.setBackground(roundedDrawable(blend(color, theme.background, 0.3f), dp(999)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(dp(4), 0, 0, 0);
        badge.setLayoutParams(lp);
        return badge;
    }

    private String statusLabel(UploadTask task) {
        switch (task.status) {
            case UploadTask.WAITING: return "等待上传";
            case UploadTask.UPLOADING: return task.message;
            case UploadTask.DONE: return "上传完成";
            case UploadTask.FAILED: return "上传失败";
            default: return task.message;
        }
    }

    private int statusDotColor(UploadTask task) {
        switch (task.status) {
            case UploadTask.WAITING: return blend(theme.secondaryText, theme.background, 0.4f);
            case UploadTask.UPLOADING: return theme.primaryButton;
            case UploadTask.DONE: return Color.rgb(42, 138, 92);
            case UploadTask.FAILED: return Color.rgb(205, 93, 61);
            default: return theme.secondaryText;
        }
    }

    private String truncateUrl(String url) {
        if (url.length() <= 42) return url;
        return url.substring(0, 20) + "…" + url.substring(url.length() - 20);
    }

    private void saveUploadTasks() {
        store.saveUploadTasks(uploadTasks);
    }

    private void retryUpload(UploadTask task) {
        task.status = UploadTask.WAITING;
        task.progress = 0;
        task.message = "等待重试";
        task.url = null;
        updateUploadNotification(task, task.message, task.progress, false);
        saveUploadTasks();
        uploadQueue.add(() -> runUpload(task));
        showUpload();
    }

    private void showProfile() {
        title.setText("个人");
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = vertical();
        page.setPadding(dp(16), dp(4), dp(16), dp(20));
        page.addView(profileHeader(), matchWrap());
        page.addView(profileTile("协议与隐私", "查看隐私协议、服务条款", "ic_policy", view -> showProfilePolicyPage()), matchWrap());
        page.addView(profileTile("关于 Memories", "版本、学校、开发者与官网", "ic_app", view -> showProfileAboutPage()), matchWrap());
        page.addView(profileTile("存储管理", "缓存、上传记录与本地登录数据", "ic_storage", view -> showProfileStoragePage()), matchWrap());
        page.addView(profileTile("主题", "选择主题、字体和尺寸", "ic_theme", view -> showProfileThemePage()), matchWrap());
        scroll.addView(page);
        content.addView(scroll);
    }

    private LinearLayout profileHeader() {
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(14), dp(14), dp(14), dp(14));
        header.setBackground(glassDrawable());
        ImageView avatar = new ImageView(this);
        header.addView(avatar, new LinearLayout.LayoutParams(dp(64), dp(64)));
        imageCache.load("https://q1.qlogo.cn/g?b=qq&nk=" + session.qq + "&s=100", bitmapCallback(bitmap -> avatar.setImageBitmap(roundedBitmap(bitmap, dp(24))), message -> {}));
        LinearLayout names = vertical();
        names.setPadding(dp(12), 0, 0, 0);
        names.addView(text(session.username.isEmpty() ? "未命名用户" : session.username, 20, true), matchWrap());
        names.addView(text("QQ " + session.qq, 13, false), matchWrap());
        names.addView(text(session.tenantName, 12, false), matchWrap());
        header.addView(names, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        header.addView(compactButton("退出", "ic_logout", view -> logout()), new LinearLayout.LayoutParams(dp(72), dp(38)));
        return header;
    }

    private void logout() {
        store.clearSession();
        // 重置为默认主题
        theme = ThemeConfig.load(store.prefs(), "");
        theme.save(store.prefs(), "");
        session = new UserSession();
        showLogin();
    }

    private LinearLayout profileTile(String label, String detail, String icon, View.OnClickListener listener) {
        LinearLayout outer = vertical();
        LinearLayout tile = horizontal();
        tile.setGravity(Gravity.CENTER_VERTICAL);
        tile.setPadding(dp(14), dp(12), dp(14), dp(12));
        tile.setBackground(rippleDrawable(theme.secondaryButton, dp(22)));
        tile.setOnClickListener(listener);
        addPressEffect(tile);
        ImageView glyph = new ImageView(this);
        glyph.setImageResource(getResources().getIdentifier(icon, "drawable", getPackageName()));
        tile.addView(glyph, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout copy = vertical();
        copy.setPadding(dp(12), 0, 0, 0);
        copy.addView(text(label, 15, true), matchWrap());
        copy.addView(text(detail, 12, false), matchWrap());
        tile.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, dp(12), 0, dp(12));
        outer.addView(tile, params);
        return outer;
    }

    private LinearLayout profilePage(String heading) {
        title.setText(heading);
        content.removeAllViews();
        ScrollView scroll = new ScrollView(this);
        LinearLayout page = vertical();
        page.setPadding(dp(16), dp(4), dp(16), dp(20));
        page.addView(iconButton("ic_back", view -> showProfile()), new LinearLayout.LayoutParams(dp(56), dp(56)));
        page.addView(sectionTitle(heading), matchWrap());
        scroll.addView(page);
        content.addView(scroll);
        return page;
    }

    private void showProfilePolicyPage() {
        LinearLayout page = profilePage("协议与隐私");
        page.addView(profileTile("隐私协议", "数据收集、存储与使用说明", "ic_privacy", view -> showPolicyDialog("隐私协议",
                "Memories 客户端会在本机保存登录令牌、QQ号、用户名、图片URL缓存、上传记录、主题偏好和下载目录授权，用于维持登录状态、加速广场浏览、恢复上传进度以及保存下载图片。\n\n应用会按你的操作访问 Memories API、校园墙 OAuth 服务和图床查询接口。除完成登录、图片上传、图片查询和健康检查外，客户端不会主动收集通讯录、短信、精确位置或与功能无关的文件。\n\n清除存储管理中的项目会移除对应本地数据；退出登录会删除本地会话。下载目录授权可通过重新选择目录覆盖。")), matchWrap());
        page.addView(profileTile("服务条款", "使用规范与免责声明", "ic_terms", view -> showPolicyDialog("服务条款",
                "使用本应用上传图片前，请确认你拥有图片的上传、公开展示和分享权限，不上传侵犯他人权益、含敏感隐私或违反学校/平台规则的内容。\n\n图片上传会调用配置中的图床与 Memories API；网络服务可用性、响应速度和外部存储策略可能受服务端、网络环境和 Android 系统版本影响。\n\n你可以在存储管理中清除缓存、上传记录或重新选择下载目录。继续使用本应用即表示你理解这些本地和网络行为。")), matchWrap());
        page.addView(profileTile("开源许可", "github.com/idoknow/Memories-Client · GPL-3.0", "ic_github", view -> {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/idoknow/Memories-Client")));
        }), matchWrap());
        page.addView(profileTile("数据安全", "信息加密与传输保护", "ic_security", view -> showPolicyDialog("数据安全",
                "• 登录认证采用 OAuth 2.0 + PKCE 流程，令牌仅存储于设备本地\n• 所有 API 通信使用 HTTPS 加密传输\n• 本地存储数据仅限本应用访问，不与其他应用共享\n• 上传的图片经图床服务中转，最终存储于 Telegram\n• 用户可随时在存储管理中清除所有本地数据")), matchWrap());
        page.addView(profileTile("联系方式", "点击发送邮件反馈问题", "ic_contact", view -> {
            Intent emailIntent = new Intent(Intent.ACTION_SENDTO);
            emailIntent.setData(Uri.parse("mailto:mail@mrcwoods.com"));
            emailIntent.putExtra(Intent.EXTRA_SUBJECT, "Memories 客户端反馈");
            startActivity(Intent.createChooser(emailIntent, "发送邮件"));
        }), matchWrap());
    }

    private void showProfileAboutPage() {
        LinearLayout page = profilePage("关于 Memories");
        page.addView(heroPanel(AppConfig.APP_NAME, AppConfig.SCHOOL_NAME, "ic_app"), matchWrap());
        addSpacedInfoRow(page, "版本", getVersionName());
        addSpacedInfoRow(page, "更新日期", AppConfig.UPDATE_DATE);
        addSpacedInfoRow(page, "官网", AppConfig.WEBSITE_URL);
        LinearLayout siteActions = horizontal();
        siteActions.addView(button("打开官网", "ic_open_web", view -> openWebsite()), new LinearLayout.LayoutParams(0, dp(50), 1));
        siteActions.addView(button("复制官网", "ic_copy_link", view -> copyWebsite()), new LinearLayout.LayoutParams(0, dp(50), 1));
        page.addView(siteActions, matchWrap());
    }

    private void addSpacedInfoRow(LinearLayout page, String label, String value) {
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(8), 0, dp(8));
        page.addView(infoRow(label, value), params);
    }

    private void showProfileStoragePage() {
        LinearLayout page = profilePage("存储管理");
        storageRows(page);
    }

    private void showProfileThemePage() {
        LinearLayout page = profilePage("主题");
        themeControls(page);
    }

    private void refreshProfileThemePage() {
        // 保存当前滚动位置，避免切换后跳到顶部
        int savedScrollY = 0;
        if (content.getChildCount() > 0 && content.getChildAt(0) instanceof ScrollView) {
            savedScrollY = ((ScrollView) content.getChildAt(0)).getScrollY();
        }

        // 立即更新根布局背景和标题字体，确保主题切换马上生效
        if (root != null) {
            applyBackground(root);
            // 同步更新导航栏背景
            View navView = root.findViewWithTag("nav_wrapper");
            if (navView != null) {
                navView.setBackground(glassDrawable());
            }
        }
        if (title != null) {
            title.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
            title.setTextSize(22 * theme.fontScale);
        }

        showProfileThemePage();

        // 恢复滚动位置
        if (content.getChildCount() > 0 && content.getChildAt(0) instanceof ScrollView) {
            final int finalScrollY = savedScrollY;
            ((ScrollView) content.getChildAt(0)).post(() ->
                    ((ScrollView) content.getChildAt(0)).scrollTo(0, finalScrollY));
        }
    }

    private void showPolicy(String heading, String body) {
        LinearLayout layout = vertical();
        layout.setPadding(dp(4), dp(2), dp(4), dp(2));
        layout.addView(text(body, 14, false), matchWrap());
        showGlassDialog(heading, layout);
    }

    private void showAbout() {
        LinearLayout layout = vertical();
        layout.setPadding(dp(18), dp(18), dp(18), dp(6));
        ImageView avatar = new ImageView(this);
        layout.addView(avatar, new LinearLayout.LayoutParams(dp(88), dp(88)));
        imageCache.load(AppConfig.DEVELOPER_AVATAR_URL, bitmapCallback(avatar::setImageBitmap, message -> {}));
        layout.addView(text("版本：" + getVersionName(), 14, false), matchWrap());
        layout.addView(text("所属学校：" + AppConfig.SCHOOL_NAME, 14, false), matchWrap());
        layout.addView(text("更新日期：" + AppConfig.UPDATE_DATE, 14, false), matchWrap());
        layout.addView(text("开发者：" + AppConfig.DEVELOPER_NAME, 14, false), matchWrap());
        layout.addView(button("打开官网", "ic_open_web", view -> openWebsite()), matchWrap());
        showGlassDialog("关于 Memories", layout);
    }

    private void openWebsite() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("Memories 官网", AppConfig.WEBSITE_URL));
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(AppConfig.WEBSITE_URL)));
    }

    private void copyWebsite() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("Memories 官网", AppConfig.WEBSITE_URL));
        toast("已复制官网链接");
    }

    private void storageRows(LinearLayout page) {
        long sessionBytes = store.preferenceBytes("session");
        long imageBytes = imageCache.sizeBytes();
        long urlBytes = store.preferenceBytes("image_url_cache");
        long uploadBytes = store.preferenceBytes("upload_records");
        long total = sessionBytes + imageBytes + urlBytes + uploadBytes;
        LinearLayout summary = vertical();
        summary.setPadding(dp(18), dp(16), dp(18), dp(14));
        summary.setBackground(gradientDrawable(theme.primaryButton, blend(theme.primaryButton, theme.background, 0.58f), dp(26)));
        TextView label = text("本地数据总量", 13, false);
        label.setTextColor(blend(theme.background, theme.primaryButton, 0.18f));
        summary.addView(label, matchWrap());
        TextView value = text(formatSize(total), 30, true);
        value.setTextColor(theme.background);
        summary.addView(value, matchWrap());
        LinearLayout.LayoutParams summaryParams = matchWrap();
        summaryParams.setMargins(0, dp(8), 0, dp(14));
        page.addView(summary, summaryParams);
        animateNumber(value, total, 1000);
        LinearLayout downloadCard = horizontal();
        downloadCard.setGravity(Gravity.CENTER_VERTICAL);
        downloadCard.setPadding(dp(14), dp(10), dp(14), dp(10));
        downloadCard.setBackground(rippleDrawable(theme.secondaryButton, dp(22)));
        downloadCard.setOnClickListener(view -> chooseDownloadFolder());
        addPressEffect(downloadCard);
        ImageView dlIcon = new ImageView(this);
        dlIcon.setImageResource(getResources().getIdentifier("ic_download_folder", "drawable", getPackageName()));
        downloadCard.addView(dlIcon, new LinearLayout.LayoutParams(dp(38), dp(38)));
        downloadCard.addView(text(downloadFolderLabel(), 13, false), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        page.addView(downloadCard, matchWrap());
        storageRow(page, "登录数据", sessionBytes, total, () -> store.clearKey("session"));
        storageRow(page, "图片缓存数据", imageBytes, total, () -> imageCache.clear());
        storageRow(page, "图片URL缓存", urlBytes, total, () -> store.clearKey("image_url_cache"));
        storageRow(page, "上传记录", uploadBytes, total, () -> store.clearKey("upload_records"));
    }

    private void storageRow(LinearLayout page, String label, long bytes, long total, Runnable clear) {
        LinearLayout row = vertical();
        row.setPadding(dp(14), dp(12), dp(14), dp(12));
        row.setBackground(glassDrawable());
        LinearLayout head = horizontal();
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(text(label, 15, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        head.addView(statusPill(formatSize(bytes), theme.primaryButton), new LinearLayout.LayoutParams(dp(96), dp(32)));
        Button clearBtn = compactButton("清除", "ic_clear", view -> {
            clear.run();
            showProfileStoragePage();
        });
        clearBtn.setGravity(Gravity.CENTER);
        head.addView(clearBtn, new LinearLayout.LayoutParams(dp(76), dp(32)));
        row.addView(head, matchWrap());
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        int target = total == 0 ? 0 : Math.max(2, (int) (bytes * 100 / total));
        int barColor = target > 70 ? Color.rgb(205, 93, 61) :
                       target > 30 ? Color.rgb(219, 160, 55) :
                       theme.primaryButton;
        bar.setProgressDrawable(storageBarDrawable(
                blend(theme.secondaryButton, theme.background, 0.3f), barColor));
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(8));
        barParams.setMargins(0, dp(6), 0, 0);
        row.addView(bar, barParams);
        animateProgress(bar, target, 1000);
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(7), 0, dp(7));
        page.addView(row, params);
    }

    private Drawable storageBarDrawable(int bgColor, int fillColor) {
        int radius = dp(4);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(bgColor);
        bg.setCornerRadius(radius);
        GradientDrawable fill = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{fillColor, blend(fillColor, Color.WHITE, 0.25f)});
        fill.setCornerRadius(radius);
        ClipDrawable clip = new ClipDrawable(fill, Gravity.LEFT, ClipDrawable.HORIZONTAL);
        LayerDrawable layers = new LayerDrawable(new Drawable[]{bg, clip});
        layers.setId(0, android.R.id.background);
        layers.setId(1, android.R.id.progress);
        return layers;
    }

    private void chooseDownloadFolder() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_DOWNLOAD_FOLDER);
    }

    private String downloadFolderLabel() {
        String uri = store.downloadFolderUri();
        return uri.isEmpty() ? "下载位置：未设置，下载时会先选择文件夹" : "下载位置：" + readableFolderPath(uri);
    }

    private String readableFolderPath(String uri) {
        try {
            String treeId = DocumentsContract.getTreeDocumentId(Uri.parse(uri));
            return treeId.replace(':', '/');
        } catch (Exception ignored) {
            return uri;
        }
    }

    private void downloadImage(Bitmap bitmap, ImageItem item) {
        if (store.downloadFolderUri().isEmpty()) {
            if (waitingForDownloadFolder) return; // 已在选择目录，不再重复弹出
            waitingForDownloadFolder = true;
            pendingDownloadBitmap = bitmap;
            pendingDownloadItem = item;
            chooseDownloadFolder();
            return;
        }
        saveBitmapToDownloadFolder(bitmap, item);
    }

    private void saveBitmapToDownloadFolder(Bitmap bitmap, ImageItem item) {
        try {
            Uri treeUri = Uri.parse(store.downloadFolderUri());
            String fileName = "memories-" + Math.max(item.id, System.currentTimeMillis()) + ".png";
            Uri parentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
            Uri fileUri = DocumentsContract.createDocument(getContentResolver(), parentUri, "image/png", fileName);
            if (fileUri == null) {
                throw new IllegalStateException("无法创建文件");
            }
            ContentResolver resolver = getContentResolver();
            try (OutputStream output = resolver.openOutputStream(fileUri)) {
                if (output == null || !bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                    throw new IllegalStateException("写入失败");
                }
            }
            toast("已下载图片");
        } catch (Exception exception) {
            store.saveDownloadFolderUri("");
            pendingDownloadBitmap = null;
            pendingDownloadItem = null;
            toast("下载失败，请重新选择位置后重试");
        }
    }

    private void addToolButton(GridLayout tools, String label, String icon, View.OnClickListener listener) {
        Button action = button(label, icon, listener);
        GridLayout.LayoutParams params = new GridLayout.LayoutParams();
        params.width = (getResources().getDisplayMetrics().widthPixels - dp(68)) / 2;
        params.height = dp(48);
        params.setMargins(dp(4), dp(4), dp(4), dp(4));
        tools.addView(action, params);
    }

    private void addPreviewToolButton(LinearLayout tools, String label, String icon, View.OnClickListener listener) {
        Button action = button(label, icon, listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(104), dp(44));
        params.setMargins(dp(4), dp(4), dp(4), dp(4));
        tools.addView(action, params);
    }

    private ImageView previewNeighborImage(int index) {
        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setImageBitmap(Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888));
        if (galleryItems.size() > 1) {
            ImageItem item = galleryItems.get((index + galleryItems.size()) % galleryItems.size());
            imageCache.load(item.url, bitmapCallback(bitmap -> image.post(() -> image.setImageBitmap(roundedBitmap(bitmap, dp(5)))), message -> {}));
        }
        return image;
    }

    private void positionPreviewNeighbors(FrameLayout pager, ImageView previousImage, ImageView currentImage, ImageView nextImage, float deltaX) {
        int width = pager.getWidth() > 0 ? pager.getWidth() : getResources().getDisplayMetrics().widthPixels;
        previousImage.setTranslationX(-width + deltaX);
        currentImage.setTranslationX(deltaX);
        nextImage.setTranslationX(width + deltaX);
    }

    private void attachPreviewGestures(FrameLayout pager, ImageView image, ImageView previousImage, ImageView nextImage, int index) {
        ScaleGestureDetector detector = new ScaleGestureDetector(this, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override
            public boolean onScale(ScaleGestureDetector scaleGestureDetector) {
                previewScale = Math.max(0.1f, Math.min(4f, previewScale * scaleGestureDetector.getScaleFactor()));
                applyPreviewTransform(image);
                return true;
            }
        });
        final float[] startX = new float[1];
        final float[] startY = new float[1];
        final boolean[] swiping = new boolean[1];
        pager.setOnTouchListener((view, event) -> {
            detector.onTouchEvent(event);
            if (event.getPointerCount() > 1) {
                swiping[0] = false;
                positionPreviewNeighbors(pager, previousImage, image, nextImage, 0f);
                return true;
            }
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                startX[0] = event.getX();
                startY[0] = event.getY();
                swiping[0] = true;
            } else if (event.getAction() == MotionEvent.ACTION_MOVE && swiping[0]) {
                float deltaX = event.getX() - startX[0];
                float deltaY = event.getY() - startY[0];
                if (Math.abs(deltaX) > Math.abs(deltaY) && galleryItems.size() > 1) {
                    positionPreviewNeighbors(pager, previousImage, image, nextImage, deltaX);
                }
            } else if (event.getAction() == MotionEvent.ACTION_UP && swiping[0]) {
                float deltaX = event.getX() - startX[0];
                float deltaY = event.getY() - startY[0];
                if (Math.abs(deltaX) > dp(72) && Math.abs(deltaX) > Math.abs(deltaY) * 1.4f && galleryItems.size() > 1) {
                    int width = pager.getWidth() > 0 ? pager.getWidth() : getResources().getDisplayMetrics().widthPixels;
                    int targetIndex = deltaX > 0 ? (index - 1 + galleryItems.size()) % galleryItems.size() : (index + 1) % galleryItems.size();
                    image.animate().translationX(deltaX > 0 ? width : -width).setDuration(160).start();
                    (deltaX > 0 ? previousImage : nextImage).animate().translationX(0f).setDuration(160).withEndAction(() -> showImageDialogAt(targetIndex)).start();
                } else {
                    int width = pager.getWidth() > 0 ? pager.getWidth() : getResources().getDisplayMetrics().widthPixels;
                    previousImage.animate().translationX(-width).setDuration(140).start();
                    image.animate().translationX(0f).setDuration(140).start();
                    nextImage.animate().translationX(width).setDuration(140).start();
                }
                swiping[0] = false;
            } else if (event.getAction() == MotionEvent.ACTION_CANCEL) {
                positionPreviewNeighbors(pager, previousImage, image, nextImage, 0f);
                swiping[0] = false;
            }
            return true;
        });
    }

    private void applyPreviewTransform(ImageView image) {
        image.setScaleX(previewFlippedHorizontal ? -previewScale : previewScale);
        image.setScaleY(previewFlippedVertical ? -previewScale : previewScale);
        image.setRotation(previewRotation);
        image.setTranslationX(previewTranslateX);
        image.setTranslationY(previewTranslateY);
    }

    private void rotatePreview(ImageView image, float degrees) {
        previewRotation = (previewRotation + degrees) % 360f;
        applyPreviewTransform(image);
    }

    private void flipPreviewHorizontal(ImageView image) {
        previewFlippedHorizontal = !previewFlippedHorizontal;
        applyPreviewTransform(image);
    }

    private void flipPreviewVertical(ImageView image) {
        previewFlippedVertical = !previewFlippedVertical;
        applyPreviewTransform(image);
    }

    private void copyImageUrl(String url) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newPlainText("Memories 图片链接", url));
        toast("已复制图片链接");
    }

    private void copyImage(Bitmap bitmap, ImageItem item) {
        Uri uri = insertSharedBitmap(bitmap, item);
        if (uri == null) {
            toast("复制图片失败");
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(ClipData.newUri(getContentResolver(), "Memories 图片", uri));
        toast("已复制图片");
    }

    private void shareImage(Bitmap bitmap, ImageItem item) {
        Uri uri = insertSharedBitmap(bitmap, item);
        if (uri == null) {
            toast("分享图片失败");
            return;
        }
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("image/png");
        share.putExtra(Intent.EXTRA_STREAM, uri);
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(share, "分享图片"));
    }

    private void applyWallpaper(Bitmap bitmap) {
        try {
            WallpaperManager.getInstance(this).setBitmap(bitmap);
            toast("已设置为壁纸");
        } catch (Exception exception) {
            toast("设置壁纸失败");
        }
    }

    private void printImage(Bitmap bitmap, ImageItem item) {
        PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
        if (manager == null) {
            toast("打印服务不可用");
            return;
        }
        manager.print("Memories 图片", new BitmapPrintAdapter(bitmap, "memories-" + Math.max(item.id, System.currentTimeMillis())), null);
    }

    private Uri insertSharedBitmap(Bitmap bitmap, ImageItem item) {
        try {
            String name = "memories-share-" + Math.max(item.id, System.currentTimeMillis());
            String uri = MediaStore.Images.Media.insertImage(getContentResolver(), bitmap, name, item.url);
            return uri == null ? null : Uri.parse(uri);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void animateProgress(ProgressBar bar, int target, int durationMs) {
        bar.setProgress(0);
        ValueAnimator animator = ValueAnimator.ofInt(0, target);
        animator.setDuration(durationMs);
        animator.addUpdateListener(animation -> bar.setProgress((Integer) animation.getAnimatedValue()));
        animator.start();
    }

    private void animateNumber(TextView value, long target, int durationMs) {
        ValueAnimator animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(durationMs);
        animator.addUpdateListener(animation -> {
            float ratio = (Float) animation.getAnimatedValue();
            value.setText(formatSize((long) (target * ratio)));
        });
        animator.start();
    }

    private void themeControls(LinearLayout page) {
        page.addView(button(theme.darkMode ? "切换亮色主题" : "切换暗色主题", "ic_theme_switch", view -> {
            applyGradientPreset(theme.presetName, !theme.darkMode);
            theme.save(store.prefs(), session.qq);
            refreshProfileThemePage();
        }), matchWrap());
        page.addView(sectionTitle("渐变"), matchWrap());
        gradientPreset(page, "简约黑白", Color.rgb(20, 20, 20), Color.rgb(242, 242, 242), Color.WHITE, Color.rgb(15, 15, 15), Color.rgb(92, 92, 92), Color.rgb(245, 245, 245), Color.rgb(48, 48, 48), Color.rgb(8, 8, 8), Color.WHITE, Color.rgb(188, 188, 188));
        gradientPreset(page, "苔光晨雾", Color.rgb(29, 110, 90), Color.rgb(230, 240, 236), Color.rgb(248, 247, 242), Color.rgb(25, 31, 28), Color.rgb(91, 101, 96), Color.rgb(90, 211, 165), Color.rgb(32, 61, 53), Color.rgb(12, 24, 21), Color.rgb(232, 244, 238), Color.rgb(157, 180, 169));
        gradientPreset(page, "霞橙晴空", Color.rgb(219, 97, 55), Color.rgb(255, 229, 201), Color.rgb(255, 249, 242), Color.rgb(45, 35, 29), Color.rgb(112, 86, 72), Color.rgb(255, 142, 91), Color.rgb(75, 45, 35), Color.rgb(28, 18, 16), Color.rgb(255, 238, 225), Color.rgb(203, 169, 148));
        gradientPreset(page, "青蓝玻璃", Color.rgb(36, 116, 148), Color.rgb(214, 239, 244), Color.rgb(245, 250, 250), Color.rgb(22, 38, 45), Color.rgb(78, 102, 112), Color.rgb(78, 185, 220), Color.rgb(35, 65, 78), Color.rgb(10, 25, 32), Color.rgb(226, 244, 249), Color.rgb(151, 187, 198));
        gradientPreset(page, "夜航霓光", Color.rgb(83, 196, 158), Color.rgb(33, 48, 43), Color.rgb(14, 18, 17), Color.rgb(238, 244, 240), Color.rgb(169, 181, 174), Color.rgb(109, 230, 186), Color.rgb(28, 51, 44), Color.rgb(7, 11, 10), Color.rgb(241, 252, 247), Color.rgb(151, 181, 170));
        page.addView(sectionTitle("字体"), matchWrap());
        fontChoice(page, "默认无衬线", "sans-serif");
        fontChoice(page, "纤细无衬线", "sans-serif-light");
        fontChoice(page, "中等无衬线", "sans-serif-medium");
        fontChoice(page, "紧凑无衬线", "sans-serif-condensed");
        fontChoice(page, "优雅衬线", "serif");
        fontChoice(page, "等宽代码", "monospace");
        fontChoice(page, "圆润手写", "casual");
        fontChoice(page, "轻松手感", "cursive");
        page.addView(sectionTitle("字号"), matchWrap());
        float[] sizes = {0.82f, 0.92f, 1.0f, 1.12f, 1.25f};
        String[] labels = {"极小", "小", "正常", "大", "极大"};
        TextView sizeLabel = text("字体大小：" + fontSizeName(theme.fontScale), 14, false);
        page.addView(sizeLabel, matchWrap());
        LinearLayout scaleBox = vertical();
        scaleBox.setPadding(dp(14), dp(12), dp(14), dp(10));
        scaleBox.setBackground(roundedDrawable(blend(theme.secondaryButton, theme.background, 0.2f), dp(18)));
        SeekBar size = new SeekBar(this);
        size.setMax(sizes.length - 1);
        size.setProgress(nearestFontSizeIndex(sizes, theme.fontScale));
        if (Build.VERSION.SDK_INT >= 21) {
            size.setProgressTintList(ColorStateList.valueOf(theme.primaryButton));
            size.setThumbTintList(ColorStateList.valueOf(theme.primaryButton));
            size.setProgressBackgroundTintList(ColorStateList.valueOf(blend(theme.secondaryButton, theme.primaryText, 0.12f)));
        }
        size.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                theme.fontScale = sizes[Math.max(0, Math.min(progress, sizes.length - 1))];
                sizeLabel.setText("字体大小：" + fontSizeName(theme.fontScale));
                theme.save(store.prefs(), session.qq);
            }

            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                refreshProfileThemePage();
            }
        });
        scaleBox.addView(size, matchWrap());
        LinearLayout ticks = horizontal();
        ticks.setGravity(Gravity.CENTER_VERTICAL);
        for (int index = 0; index < labels.length; index++) {
            ticks.addView(fontSizeTick(labels[index], index == size.getProgress()), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        }
        scaleBox.addView(ticks, matchWrap());
        LinearLayout.LayoutParams scaleParams = matchWrap();
        scaleParams.setMargins(0, dp(4), 0, dp(8));
        page.addView(scaleBox, scaleParams);
    }

    private TextView fontSizeTick(String label, boolean selected) {
        TextView tick = text((selected ? "●\n" : "│\n") + label, 11, selected);
        tick.setGravity(Gravity.CENTER);
        tick.setTextColor(selected ? theme.primaryButton : theme.secondaryText);
        return tick;
    }

    private void fontChoice(LinearLayout page, String label, String family) {
        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14), dp(10), dp(14), dp(10));
        row.setBackground(rippleDrawable(family.equals(theme.fontFamily) ? theme.primaryButton : theme.secondaryButton, dp(18)));
        TextView preview = text(label + "  Aa 记忆", 15, true);
        preview.setTypeface(Typeface.create(family, Typeface.BOLD));
        preview.setTextColor(family.equals(theme.fontFamily) ? theme.background : theme.primaryText);
        row.addView(preview, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        if (family.equals(theme.fontFamily)) {
            row.addView(statusPill("当前", theme.primaryButton), new LinearLayout.LayoutParams(dp(68), dp(30)));
        }
        row.setOnClickListener(view -> {
            theme.fontFamily = family;
            theme.save(store.prefs(), session.qq);
            refreshProfileThemePage();
        });
        addPressEffect(row);
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(5), 0, dp(5));
        page.addView(row, params);
    }

    private int nearestFontSizeIndex(float[] sizes, float value) {
        int nearest = 0;
        for (int index = 1; index < sizes.length; index++) {
            if (Math.abs(sizes[index] - value) < Math.abs(sizes[nearest] - value)) {
                nearest = index;
            }
        }
        return nearest;
    }

    private String fontSizeName(float value) {
        if (value < 0.9f) {
            return "极小";
        }
        if (value < 0.98f) {
            return "小";
        }
        if (value < 1.08f) {
            return "正常";
        }
        if (value < 1.2f) {
            return "大";
        }
        return "极大";
    }

    private void gradientPreset(LinearLayout page, String label, int lightPrimary, int lightSecondary, int lightBackground, int lightPrimaryText, int lightSecondaryText,
                                int darkPrimary, int darkSecondary, int darkBackground, int darkPrimaryText, int darkSecondaryText) {
        LinearLayout tile = horizontal();
        tile.setGravity(Gravity.CENTER_VERTICAL);
        tile.setPadding(dp(14), dp(10), dp(14), dp(10));
        int previewPrimary = theme.darkMode ? darkPrimary : lightPrimary;
        int previewSecondary = theme.darkMode ? darkSecondary : lightSecondary;
        int previewBackground = theme.darkMode ? darkBackground : lightBackground;
        tile.setBackground(gradientDrawable(previewPrimary, previewBackground, dp(22)));
        tile.setOnClickListener(view -> {
            theme.presetName = label;
            theme.darkMode = Color.luminance(previewBackground) < 0.35f;
            theme.primaryButton = previewPrimary;
            theme.secondaryButton = previewSecondary;
            theme.background = previewBackground;
            theme.primaryText = theme.darkMode ? darkPrimaryText : lightPrimaryText;
            theme.secondaryText = theme.darkMode ? darkSecondaryText : lightSecondaryText;
            theme.save(store.prefs(), session.qq);
            refreshProfileThemePage();
        });
        addPressEffect(tile);
        tile.addView(text(label, 15, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        // 根据预览色计算对比色，确保文字可见
        int pillTextColor = Color.luminance(previewSecondary) < 0.5f ? Color.WHITE : Color.rgb(20, 20, 20);
        TextView pill = text(label.equals(theme.presetName) ? "当前" : "应用", 12, true);
        pill.setGravity(Gravity.CENTER);
        pill.setTextColor(pillTextColor);
        pill.setPadding(dp(12), dp(4), dp(12), dp(4));
        pill.setBackground(roundedDrawable(previewSecondary, dp(999)));
        tile.addView(pill, new LinearLayout.LayoutParams(dp(72), dp(32)));
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(6), 0, dp(6));
        page.addView(tile, params);
    }

    private void applyGradientPreset(String label, boolean dark) {
        switch (label == null ? "default" : label) {
            case "简约黑白":
                setThemeColors(label, dark, Color.rgb(20, 20, 20), Color.rgb(242, 242, 242), Color.WHITE, Color.rgb(15, 15, 15), Color.rgb(92, 92, 92), Color.rgb(245, 245, 245), Color.rgb(48, 48, 48), Color.rgb(8, 8, 8), Color.WHITE, Color.rgb(188, 188, 188));
                break;
            case "苔光晨雾":
                setThemeColors(label, dark, Color.rgb(29, 110, 90), Color.rgb(230, 240, 236), Color.rgb(248, 247, 242), Color.rgb(25, 31, 28), Color.rgb(91, 101, 96), Color.rgb(90, 211, 165), Color.rgb(32, 61, 53), Color.rgb(12, 24, 21), Color.rgb(232, 244, 238), Color.rgb(157, 180, 169));
                break;
            case "霞橙晴空":
                setThemeColors(label, dark, Color.rgb(219, 97, 55), Color.rgb(255, 229, 201), Color.rgb(255, 249, 242), Color.rgb(45, 35, 29), Color.rgb(112, 86, 72), Color.rgb(255, 142, 91), Color.rgb(75, 45, 35), Color.rgb(28, 18, 16), Color.rgb(255, 238, 225), Color.rgb(203, 169, 148));
                break;
            case "青蓝玻璃":
                setThemeColors(label, dark, Color.rgb(36, 116, 148), Color.rgb(214, 239, 244), Color.rgb(245, 250, 250), Color.rgb(22, 38, 45), Color.rgb(78, 102, 112), Color.rgb(78, 185, 220), Color.rgb(35, 65, 78), Color.rgb(10, 25, 32), Color.rgb(226, 244, 249), Color.rgb(151, 187, 198));
                break;
            case "夜航霓光":
                setThemeColors(label, dark, Color.rgb(83, 196, 158), Color.rgb(33, 48, 43), Color.rgb(14, 18, 17), Color.rgb(238, 244, 240), Color.rgb(169, 181, 174), Color.rgb(109, 230, 186), Color.rgb(28, 51, 44), Color.rgb(7, 11, 10), Color.rgb(241, 252, 247), Color.rgb(151, 181, 170));
                break;
            default:
                theme.applyPreset(dark);
                break;
        }
    }

    private void setThemeColors(String label, boolean dark, int lightPrimary, int lightSecondary, int lightBackground, int lightPrimaryText, int lightSecondaryText,
                                int darkPrimary, int darkSecondary, int darkBackground, int darkPrimaryText, int darkSecondaryText) {
        theme.presetName = label;
        theme.darkMode = dark;
        theme.primaryButton = dark ? darkPrimary : lightPrimary;
        theme.secondaryButton = dark ? darkSecondary : lightSecondary;
        theme.background = dark ? darkBackground : lightBackground;
        theme.primaryText = dark ? darkPrimaryText : lightPrimaryText;
        theme.secondaryText = dark ? darkSecondaryText : lightSecondaryText;
    }

    private Button button(String label, String icon, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setTextColor(theme.primaryText);
        button.setTextSize(14 * theme.fontScale);
        button.setTypeface(Typeface.create(theme.fontFamily, Typeface.NORMAL));
        button.setAllCaps(false);
        button.setPadding(dp(12), dp(4), dp(12), dp(4));
        button.setCompoundDrawablesWithIntrinsicBounds(getResources().getIdentifier(icon, "drawable", getPackageName()), 0, 0, 0);
        button.setCompoundDrawablePadding(dp(1));
        button.setBackground(rippleDrawable(theme.secondaryButton, dp(18)));
        button.setElevation(0);
        if (Build.VERSION.SDK_INT >= 21) {
            button.setStateListAnimator(null);
        }
        button.setOnClickListener(listener);
        addPressEffect(button);
        return button;
    }

    private Button compactButton(String label, String icon, View.OnClickListener listener) {
        Button button = button(label, icon, listener);
        button.setTextSize(12 * theme.fontScale);
        button.setCompoundDrawablePadding(dp(1));
        button.setPadding(dp(8), 0, dp(8), 0);
        button.setMinWidth(0);
        button.setMinHeight(0);
        return button;
    }

    private Button iconButton(String icon, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText("");
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0, 0, 0, 0);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setCompoundDrawablesWithIntrinsicBounds(getResources().getIdentifier(icon, "drawable", getPackageName()), 0, 0, 0);
        button.setBackground(null);
        button.setElevation(0);
        if (Build.VERSION.SDK_INT >= 21) {
            button.setStateListAnimator(null);
        }
        button.setOnClickListener(listener);
        addPressEffect(button);
        return button;
    }

    private Button closeButton(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        boolean iconOnly = "×".equals(label);
        button.setText(iconOnly ? "" : label);
        button.setTextColor(theme.primaryText);
        button.setTextSize(14 * theme.fontScale);
        button.setTypeface(Typeface.create(theme.fontFamily, Typeface.BOLD));
        button.setAllCaps(false);
        button.setCompoundDrawablesWithIntrinsicBounds(getResources().getIdentifier("ic_close", "drawable", getPackageName()), 0, 0, 0);
        button.setCompoundDrawablePadding(iconOnly ? 0 : dp(1));
        button.setPadding(iconOnly ? dp(10) : dp(12), 0, iconOnly ? dp(10) : dp(12), 0);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setBackground(rippleDrawable(blend(theme.secondaryButton, theme.background, 0.22f), dp(999)));
        button.setElevation(0);
        if (Build.VERSION.SDK_INT >= 21) {
            button.setStateListAnimator(null);
        }
        button.setOnClickListener(listener);
        addPressEffect(button);
        return button;
    }

    private Button navButton(String label, String icon, boolean selected, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText("");
        button.setContentDescription(label);
        button.setAllCaps(false);
        button.setAlpha(1f);
        android.graphics.drawable.Drawable d = getResources().getDrawable(getResources().getIdentifier(icon, "drawable", getPackageName())).mutate();
        d.clearColorFilter();
        button.setCompoundDrawablesWithIntrinsicBounds(d, null, null, null);
        button.setGravity(Gravity.CENTER);
        button.setPadding(0, 0, 0, 0);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setBackground(null);
        button.setElevation(0);
        if (Build.VERSION.SDK_INT >= 21) {
            button.setStateListAnimator(null);
        }
        button.setOnClickListener(listener);
        addPressEffect(button);
        return button;
    }

    private GradientDrawable navBarDrawable() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.TRANSPARENT);
        drawable.setCornerRadius(dp(22));
        // 描边上半部分实色，下半部分透明渐变
        drawable.setStroke(dp(1), Color.TRANSPARENT);
        return drawable;
    }

    private TextView sectionTitle(String value) {
        TextView text = text(value, 17, true);
        text.setPadding(0, dp(18), 0, dp(6));
        return text;
    }

    private TextView text(String value, int size, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value == null ? "" : value);
        text.setTextColor(bold ? theme.primaryText : theme.secondaryText);
        text.setTextSize(size * theme.fontScale);
        text.setTypeface(Typeface.create(theme.fontFamily, bold ? Typeface.BOLD : Typeface.NORMAL));
        text.setLineSpacing(dp(2), 1.0f);
        text.setPadding(0, dp(6), 0, dp(6));
        return text;
    }

    private LinearLayout vertical() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        return layout;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams compactWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private void applyBackground(View view) {
        view.setBackground(gradientDrawable(theme.background, blend(theme.background, theme.primaryButton, 0.16f), 0));
    }

    private int adjust(int color) {
        return Color.argb(255, Color.red(color), Color.green(color), Color.blue(color));
    }

    private LinearLayout heroPanel(String heading, String detail, String icon) {
        LinearLayout panel = horizontal();
        panel.setGravity(Gravity.CENTER_VERTICAL);
        panel.setPadding(dp(16), dp(14), dp(16), dp(14));
        panel.setBackground(gradientDrawable(theme.primaryButton, blend(theme.primaryButton, theme.background, 0.62f), dp(26)));
        ImageView glyph = new ImageView(this);
        glyph.setImageResource(getResources().getIdentifier(icon, "drawable", getPackageName()));
        panel.addView(glyph, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout copy = vertical();
        copy.setPadding(dp(14), 0, 0, 0);
        TextView head = text(heading, 19, true);
        head.setTextColor(theme.background);
        copy.addView(head, matchWrap());
        TextView body = text(detail, 12, false);
        body.setTextColor(blend(theme.background, theme.primaryButton, 0.18f));
        copy.addView(body, matchWrap());
        panel.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(8), 0, dp(12));
        panel.setLayoutParams(params);
        return panel;
    }

    private TextView statusPill(String value, int color) {
        TextView pill = text(value, 12, true);
        pill.setGravity(Gravity.CENTER);
        pill.setTextColor(theme.darkMode ? theme.primaryText : theme.background);
        pill.setPadding(dp(12), dp(4), dp(12), dp(4));
        pill.setBackground(roundedDrawable(color, dp(999)));
        return pill;
    }

    private GradientDrawable roundedDrawable(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(adjust(color));
        drawable.setCornerRadius(radius);
        drawable.setStroke(dp(1), blend(color, theme.primaryText, 0.18f));
        return drawable;
    }

    private GradientDrawable gradientDrawable(int start, int end, int radius) {
        GradientDrawable drawable = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{adjust(start), adjust(end)});
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private RippleDrawable rippleDrawable(int color, int radius) {
        return new RippleDrawable(android.content.res.ColorStateList.valueOf(blend(color, theme.primaryText, 0.24f)), roundedDrawable(color, radius), null);
    }

    private GradientDrawable glassDrawable() {
        int base = blend(theme.secondaryButton, theme.background, 0.34f);
        GradientDrawable drawable = gradientDrawable(Color.argb(210, Color.red(base), Color.green(base), Color.blue(base)), blend(base, theme.primaryButton, 0.12f), dp(24));
        drawable.setStroke(dp(1), Color.argb(90, Color.red(theme.primaryText), Color.green(theme.primaryText), Color.blue(theme.primaryText)));
        return drawable;
    }

    private Drawable progressBarDrawable(int color) {
        int bgColor = blend(theme.secondaryButton, theme.background, 0.4f);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(bgColor);
        bg.setCornerRadius(dp(5));
        GradientDrawable fill = new GradientDrawable();
        fill.setColor(color);
        fill.setCornerRadius(dp(5));
        ClipDrawable clip = new ClipDrawable(fill, Gravity.LEFT, ClipDrawable.HORIZONTAL);
        LayerDrawable layers = new LayerDrawable(new Drawable[]{bg, clip});
        layers.setId(0, android.R.id.background);
        layers.setId(1, android.R.id.progress);
        return layers;
    }

    private int blend(int first, int second, float ratio) {
        float inverse = 1f - ratio;
        return Color.rgb((int) (Color.red(first) * inverse + Color.red(second) * ratio),
                (int) (Color.green(first) * inverse + Color.green(second) * ratio),
                (int) (Color.blue(first) * inverse + Color.blue(second) * ratio));
    }

    /** 根据 0~1 的进度值生成彩虹色，用于导航栏走马灯边框 */
    private int rainbowColor(float fraction) {
        float hue = (fraction * 360f) % 360f;
        return Color.HSVToColor(new float[]{hue, 0.75f, 0.92f});
    }

    private void addPressEffect(View view) {
        view.setElevation(0);
        if (Build.VERSION.SDK_INT >= 21) {
            view.setStateListAnimator(null);
        }
        view.setOnTouchListener((pressedView, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                pressedView.animate().scaleX(0.97f).scaleY(0.97f).alpha(0.88f).setDuration(120).start();
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                pressedView.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(180).start();
            }
            return false;
        });
    }

    private AlertDialog showGlassDialog(String heading, View contentView) {
        LinearLayout wrapper = vertical();
        wrapper.setPadding(dp(18), dp(12), dp(18), dp(12));
        wrapper.addView(contentView, matchWrap());
        Button close = closeButton("关闭", view -> {});
        close.setGravity(Gravity.CENTER);
        LinearLayout closeRow = horizontal();
        closeRow.setGravity(Gravity.CENTER);
        closeRow.addView(close, new LinearLayout.LayoutParams(dp(120), dp(44)));
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        closeParams.setMargins(0, dp(12), 0, 0);
        wrapper.addView(closeRow, closeParams);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle(heading).setView(wrapper).show();
        close.setOnClickListener(view -> dialog.dismiss());
        dialog.setCanceledOnTouchOutside(true);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(roundedDrawable(theme.background, dp(28)));
        }
        return dialog;
    }

    private AlertDialog showImagePreviewDialog(View contentView) {
        AlertDialog dialog = new AlertDialog.Builder(this).create();
        dialog.setView(contentView, 0, 0, 0, 0);
        dialog.show();
        dialog.setCanceledOnTouchOutside(true);
        Window window = dialog.getWindow();
        if (window != null) {
            window.setBackgroundDrawable(roundedDrawable(theme.background, dp(22)));
            WindowManager.LayoutParams params = new WindowManager.LayoutParams();
            params.copyFrom(window.getAttributes());
            params.width = getResources().getDisplayMetrics().widthPixels - dp(12);
            params.height = getResources().getDisplayMetrics().heightPixels - dp(34);
            window.setAttributes(params);
        }
        return dialog;
    }

    private LinearLayout infoRow(String label, String value) {
        LinearLayout row = vertical();
        row.setPadding(dp(14), dp(10), dp(14), dp(10));
        row.setBackground(roundedDrawable(theme.secondaryButton, dp(18)));
        row.addView(text(label, 12, true), matchWrap());
        row.addView(text(value == null || value.isEmpty() ? "无" : value, 14, false), matchWrap());
        LinearLayout.LayoutParams params = matchWrap();
        params.setMargins(0, dp(5), 0, dp(5));
        row.setLayoutParams(params);
        return row;
    }

    private String formatTime(long timestamp) {
        if (timestamp <= 0) {
            return "时间未知";
        }
        long millis = timestamp < 100000000000L ? timestamp * 1000L : timestamp;
        return new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.CHINA).format(new Date(millis));
    }

    private Bitmap roundedBitmap(Bitmap source, int radius) {
        Bitmap output = Bitmap.createBitmap(source.getWidth(), source.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(0, 0, source.getWidth(), source.getHeight()), radius, radius, paint);
        return output;
    }

    private Bitmap squareRoundedBitmap(Bitmap source, int radius) {
        int side = Math.min(source.getWidth(), source.getHeight());
        int left = (source.getWidth() - side) / 2;
        int top = (source.getHeight() - side) / 2;
        Bitmap square = Bitmap.createBitmap(source, left, top, side, side);
        return roundedBitmap(square, radius);
    }

    private int progressColor(UploadTask task) {
        if (task.status == UploadTask.FAILED) {
            return Color.rgb(205, 93, 61);
        }
        if (task.status == UploadTask.DONE) {
            return Color.rgb(42, 144, 92);
        }
        return theme.primaryButton;
    }

    private void createUploadNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(new NotificationChannel(UPLOAD_CHANNEL_ID, "Memories 上传", NotificationManager.IMPORTANCE_LOW));
            manager.createNotificationChannel(new NotificationChannel(DOWNLOAD_CHANNEL_ID, "Memories 下载", NotificationManager.IMPORTANCE_LOW));
        }
    }

    private void updateUploadNotification(UploadTask task, String message, float progress, boolean finished) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(this, UPLOAD_CHANNEL_ID)
                : new android.app.Notification.Builder(this);
        int total = Math.max(1, uploadTasks.size());
        int finishedCount = 0;
        int progressTotal = 0;
        for (UploadTask uploadTask : uploadTasks) {
            if (uploadTask.status == UploadTask.DONE || uploadTask.status == UploadTask.FAILED) {
                finishedCount++;
            }
            progressTotal += Math.max(0, Math.min(100, (int)uploadTask.progress));
        }
        int totalProgress = (int)(progressTotal / total);
        String summary = "已完成 " + finishedCount + "/" + total + " · 总进度 " + totalProgress + "%";
        builder.setSmallIcon(getResources().getIdentifier("ic_upload", "drawable", getPackageName()))
                .setContentTitle("Memories 上传")
                .setContentText(summary + " · " + message)
                .setContentIntent(pendingIntent)
                .setOngoing(finishedCount < total)
                .setProgress(100, totalProgress, false);
        if (finishedCount >= total) {
            builder.setAutoCancel(true);
        }
        manager.notify(UPLOAD_NOTIFICATION_ID, builder.build());
    }

    private void showDownloadNotification(int finished, int total, String message) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(this, DOWNLOAD_CHANNEL_ID)
                : new android.app.Notification.Builder(this);
        int pct = total > 0 ? finished * 100 / total : 0;
        builder.setSmallIcon(getResources().getIdentifier("ic_download", "drawable", getPackageName()))
                .setContentTitle("Memories 下载")
                .setContentText(message)
                .setContentIntent(pendingIntent)
                .setOngoing(finished < total)
                .setProgress(total, finished, false);
        if (finished >= total) {
            builder.setAutoCancel(true);
        }
        manager.notify(DOWNLOAD_NOTIFICATION_ID, builder.build());
    }

    private void finishDownloadNotification(int success, int failed) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent,
                Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(this, DOWNLOAD_CHANNEL_ID)
                : new android.app.Notification.Builder(this);
        String summary = "下载完成：成功 " + success + " 张" + (failed > 0 ? "，失败 " + failed + " 张" : "");
        builder.setSmallIcon(getResources().getIdentifier("ic_download", "drawable", getPackageName()))
                .setContentTitle("Memories 下载")
                .setContentText(summary)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setOngoing(false);
        manager.notify(DOWNLOAD_NOTIFICATION_ID, builder.build());
    }

    private void cancelDownloadNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(DOWNLOAD_NOTIFICATION_ID);
        }
    }

    private <T> ApiClient.Callback<T> uiCallback(UiSuccess<T> success, UiError error) {
        return new ApiClient.Callback<T>() {
            @Override
            public void onSuccess(T value) {
                mainHandler.post(() -> success.run(value));
            }

            @Override
            public void onError(String message) {
                mainHandler.post(() -> error.run(message == null ? "请求失败" : message));
            }
        };
    }

    private ImageCache.BitmapCallback bitmapCallback(UiSuccess<Bitmap> success, UiError error) {
        return new ImageCache.BitmapCallback() {
            @Override
            public void onReady(Bitmap bitmap) {
                mainHandler.post(() -> success.run(bitmap));
            }

            @Override
            public void onError(String message) {
                mainHandler.post(() -> error.run(message == null ? "图片加载失败" : message));
            }
        };
    }

    private boolean hasNetwork() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo info = manager == null ? null : manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private String queryValue(String query, String key) throws Exception {
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && key.equals(parts[0])) {
                return URLDecoder.decode(parts[1], "UTF-8");
            }
        }
        return "";
    }

    private String tabTitle(int tab) {
        if (tab == 1) {
            return "上传";
        }
        if (tab == 2) {
            return "个人";
        }
        return "广场";
    }

    private String getVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception ignored) {
            return "1.1.0";
        }
    }

    private String formatSize(long bytes) {
        if (bytes < 1024) {
            return bytes + " B";
        }
        double kb = bytes / 1024.0;
        if (kb < 1024) {
            return String.format("%.1f KB", kb);
        }
        return String.format("%.1f MB", kb / 1024.0);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private interface UiSuccess<T> {
        void run(T value);
    }

    private interface UiError {
        void run(String message);
    }

    private interface ColorSetter {
        void set(int color);
    }
}