# Memories Android

这是一个原生 Java Android 客户端子项目。用 Android Studio 打开 `Android/` 目录即可同步 Gradle 并构建。

## 配置入口

开发者只需要把 `app-config.example.properties` 复制为 `app/src/main/assets/app-config.properties`，填好自己的值后就能编译自己的包。真实配置文件已加入 `.gitignore`，不要提交到仓库。

- Memories API、失控图床 API
- 校园墙 OAuth Client ID、回调端口、Scope 与接口地址
- 学校、开发者、官网、版本更新日期
- 默认上传格式、固定 Telegram 存储、自动 CDN
- 亮色/暗色主题默认颜色

不要把生产 OAuth Secret 或服务端地址提交到公开仓库；发布前只在本机填好 `app/src/main/assets/app-config.properties` 再构建 APK。

## 主要能力

- 首次打开请求网络状态与媒体读取权限，启动页调用 `/health`。
- 未登录时使用校园墙 OAuth 登录，回调监听 `localhost:2580`，本地保存 token、QQ 号、用户名与校园墙信息。
- 广场页读取 Memories 图片列表，本地缓存图片 URL 和图片文件，每 5 秒最多加载 5 张。
- 上传页支持多图选择，先上传到失控图床，再写入 Memories API，每 5 秒最多上传 5 张，并展示队列进度。
- 个人页显示 QQ 头像、协议、关于、存储清理和主题配置。

## 构建

需要本机安装 Android Studio 或 Android SDK + Gradle。命令行构建示例：

```bash
cd Android
cp app-config.example.properties app/src/main/assets/app-config.properties
./gradlew :app:assembleDebug
```

如果使用 Android Studio，直接打开 `Android/` 目录，等待 Gradle Sync 完成后运行 `app` 即可。
