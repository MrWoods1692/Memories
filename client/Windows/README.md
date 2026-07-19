# Memories Client (Windows)

Windows 客户端使用 C++20、Qt 6 和 CMake 构建，面向图片浏览、上传和本地管理场景。当前目录内容与 Linux 版结构接近，但这里的说明以 Windows 构建和运行方式为准。

## 功能概览

| 功能模块 | 说明 |
| -------- | ---- |
| **服务检测** | 启动时自动 GET `/health` 健康检查 |
| **图片广场** | 分页浏览图片列表，缩略图网格展示 |
| **图片预览** | 旋转、翻转、缩放、拖拽，分享/下载/复制URL/打印/设壁纸 |
| **图片上传** | 单张/批量上传，经 scdn.io → Memories API 两段式上传，可控延迟防限速 |
| **上传队列** | 队列管理、进度追踪、完成通知、记录清理 |
| **批量操作** | 全选、批量下载/分享/打印/复制URL |
| **图片信息** | 查询元数据（名称/存储位置/标签/AI描述） |
| **OAuth 登录** | 授权码流程 + Token 手动输入双模式 |
| **个性化设置** | 下载位置、缓存清理、主题/字号/字体、上传默认参数 |

## 安装方式

推荐直接使用 CMake 在本地构建；如果已经准备好 Qt 和编译器环境，也可以通过 VS Code、Qt Creator 或 Visual Studio 打开目录进行编译。

## 构建前准备

- Qt 6（Core、Gui、Widgets、Network、Svg、OpenGLWidgets）
- CMake 3.20 及以上
- 支持 C++20 的 MSVC
- Ninja 或 Visual Studio 生成器

如果使用 Qt 官方安装器，先确保 `CMAKE_PREFIX_PATH` 能指向 Qt 安装目录，或在 CMake 配置时显式传入。

## 从源码构建

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel
```

如果使用 Visual Studio 生成器，可改为：

```bash
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
```

## 运行

```bash
build/MemoriesClient.exe
```

## 依赖

- CMake >= 3.20
- Qt 6
- MSVC 2022 或更新版本
- C++20 编译器

## API 端点

| 端点 | 方法 | 说明 |
| ---- | ---- | ---- |
| `/health` | GET | 服务健康检查 |
| `/images?after_id=0` | GET | 分页获取图片列表（每页20条） |
| `/images` | POST | 写入图片URL，返回自增ID |
| `img.scdn.io/api/v1.php` | POST | 上传图片文件 |
| `img.scdn.io/api/v1.php?q=` | GET | 查询图片元数据 |

默认配置下：

- 主 API 基址为 `https://api.mrcwoods.com`
- 图片上传接口为 `https://img.scdn.io/api/v1.php`
- 图片信息查询接口为 `https://img.scdn.io/api/v1.php?q=...`

## 项目结构

```text
Windows/
├── CMakeLists.txt
├── src/
│   ├── main.cpp              # 入口（GUI/Headless 双模式）
│   ├── app/
│   │   ├── Application.h/cpp  # 应用核心（单例）
│   │   └── Settings.h/cpp     # 持久化设置（QSettings）
│   ├── network/
│   │   ├── ApiClient.h/cpp    # Memories API 客户端
│   │   ├── HealthChecker.h/cpp # 健康检查器
│   │   └── ImageUploader.h/cpp # 上传引擎（两段式+限速）
│   ├── models/
│   │   ├── ImageModel.h       # 图片数据结构
│   │   └── UploadQueue.h/cpp  # 上传队列模型
│   ├── ui/
│   │   ├── MainWindow.h/cpp   # 主窗口（菜单/工具栏/状态栏/托盘）
│   │   ├── GalleryWidget.h/cpp # 图片广场（网格/批量操作）
│   │   ├── ImageViewer.h/cpp  # 图片预览器（变换/操作）
│   │   ├── UploadDialog.h/cpp # 上传对话框
│   │   ├── SettingsDialog.h/cpp # 设置对话框
│   │   ├── LoginDialog.h/cpp  # OAuth 登录
│   │   └── ImageInfoDialog.h/cpp # 图片信息查询
│   └── utils/
│       ├── ImageCache.h/cpp   # 图片缓存（内存+磁盘）
│       └── Logger.h/cpp       # 日志系统
├── resources/
├── scripts/
│   └── install.sh
└── README.md
```
