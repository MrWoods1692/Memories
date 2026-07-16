# Memories

基于 Android 的图片分享与管理平台，内嵌 HTTP 服务器，支持局域网/外网访问。

## 架构

```
┌──────────────────────────────────────────────┐
│                  Android 设备                  │
│                                              │
│  ┌─────────────────┐  ┌───────────────────┐  │
│  │ EmbeddedServer  │  │   AdminServer     │  │
│  │   (API :8080)    │  │  (静态文件 :8081)  │  │
│  │   CORS 开放      │  │  仅局域网访问      │  │
│  └───────┬─────────┘  └────────┬──────────┘  │
│          │                     │              │
│  ┌───────┴─────────────────────┴──────────┐  │
│  │           DatabaseHelper               │  │
│  │         (SQLite + WriteQueue)           │  │
│  └─────────────────────────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────────┐ │
│  │  管理面板 (React + TypeScript + Vite)     │ │
│  │  → 构建产物部署在 assets/admin/          │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

| 组件 | 端口 | 访问范围 | 说明 |
|------|------|---------|------|
| **EmbeddedServer** | 8080 | 局域网 + 外网 | REST API，CORS 全开放 |
| **AdminServer** | 8081 | 仅局域网 | 管理面板静态文件 |
| **管理面板前端** | — | — | React 19 + TypeScript + Vite 8 |

## 技术栈

- **后端**: Java 8, NanoHTTPD, SQLite (Android)
- **前端**: React 19, TypeScript 6, Vite 8
- **构建**: Gradle 8.1, Android SDK 35
- **最低系统**: Android 10 (API 29)

## 项目结构

```
Memories/
├── app/                          # Android 主应用
│   ├── build.gradle              # 应用构建配置
│   ├── libs/frp_universal.aar    # FRPC 内网穿透 SDK
│   └── src/main/java/com/example/memories/
│       ├── EmbeddedServer.java   # API 服务器 (NanoHTTPD)
│       ├── AdminServer.java      # 管理面板静态文件服务
│       ├── DatabaseHelper.java   # SQLite 数据库操作
│       ├── WriteQueue.java       # 数据库写入队列（高并发优化）
│       ├── WebDavBackup.java     # WebDAV 自动备份
│       ├── OAuthHelper.java      # OAuth 认证辅助
│       ├── FrpcManager.java      # 内网穿透管理
│       └── ...                   # 其他服务组件
├── admin/                        # 管理面板前端 (React)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/index.ts          # API 客户端
│       ├── pages/                # 页面组件
│       │   ├── Dashboard.tsx     # 仪表盘 (CPU/内存/磁盘/网络)
│       │   ├── Images.tsx        # 图片审核管理
│       │   ├── Users.tsx         # 用户管理
│       │   ├── Bans.tsx          # 封禁管理
│       │   ├── Settings.tsx      # 系统设置
│       │   └── Database.tsx      # 数据库可视化管理
│       ├── components/           # 通用组件
│       └── types/index.ts        # 类型定义
├── docs/                         # 文档
│   ├── api-documentation.md      # API 完整文档
│   ├── api-docs.html             # API 文档 (HTML)
│   └── api-docs/                 # API 文档站点 (Vue + Vite)
├── build.gradle                  # 根构建配置
└── settings.gradle
```

## 快速开始

### 构建 Android 应用

```bash
# 编译
./gradlew :app:compileDebugJavaWithJavac

# 打包 APK
./gradlew :app:assembleDebug
```

### 构建管理面板

```bash
cd admin
npm install
npm run build
# 产物输出到 admin/dist/，复制到 app/src/main/assets/admin/
```

### 局域网访问

服务启动后，在同一局域网内浏览器访问：

- **管理面板**: `http://<设备IP>:8081`
- **API 根路径**: `http://<设备IP>:8080/health`

## API 端点

> 完整 API 文档见 [docs/api-documentation.md](docs/api-documentation.md)

| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/health` | GET | 健康检查 | 公开 |
| `/status` | GET | 服务状态 (图片数/运行时间) | 公开 |
| `/sysinfo` | GET | 系统信息 (CPU/内存/磁盘/网络/电池) | 公开 |
| `/images` | GET/POST | 图片列表/上传 | GET公开, POST需审核员 |
| `/images/{id}` | DELETE | 删除图片 | 管理员 |
| `/images/{id}/audit` | POST | 审核图片 (status=1通过,2拒绝) | 审核员+ |
| `/images/cleanup` | DELETE | 批量清理已拒绝图片 | 管理员 |
| `/users` | GET/POST | 用户列表/添加用户 | 管理员 |
| `/users/{qq}` | DELETE | 移除用户 | 管理员 |
| `/bans` | GET/POST | 封禁列表/封禁用户 | 管理员 |
| `/bans/{qq}` | DELETE | 解封用户 | 管理员 |
| `/config` | GET/POST | 读取/修改配置 | GET公开, POST管理员 |
| `/webdav/config` | GET | WebDAV 备份配置 | 公开 |
| `/platform` | GET | 平台名称/Logo | 公开 |
| `/frpc/config` | GET/POST | FRPC 内网穿透配置 | POST管理员 |
| `/frpc/status` | GET | FRPC 运行状态 | 公开 |
| `/oauth/config` | GET/POST | OAuth 配置 | POST管理员 |
| `/oauth/start` | GET | 发起 OAuth 授权 | 公开 |
| `/oauth/callback` | GET | OAuth 回调处理 | 公开 |
| `/db/tables` | GET | 数据库表列表 | 管理员 |
| `/db/table/{name}` | GET | 分页查询表数据 | 管理员 |
| `/db/query` | POST | 执行 SQL 语句 | 管理员 |

> **权限说明**: 局域网请求自动获得管理员权限；外网请求需在 Header 中携带 `x-user-qq` 验证身份。

## 高并发写入优化

### 问题

SQLite 仅支持单写入者，高并发场景下多个请求同时执行写操作时，`getWritableDatabase()` 会引发锁竞争，导致 `SQLiteDatabaseLockedException` 或线程阻塞。

### 方案: WriteQueue 写入队列

新增 `WriteQueue.java`，基于 `SingleThreadExecutor` 将所有数据库写操作序列化到单一线程执行。

```
请求线程 1 ─→ WriteQueue.submit() ─┐
请求线程 2 ─→ WriteQueue.submit() ─┤─→ [单线程执行器] ─→ SQLite
请求线程 N ─→ WriteQueue.submit() ─┘    (串行写入)

请求线程 M ─→ getReadableDatabase() ─→ SQLite (并发读取)
```

- **写入**: 全部 10 个写方法经 `WriteQueue.submit()` 串行化
- **读取**: 保持 `getReadableDatabase()` 并发读取，不受影响
- **健壮性**: 每个写入方法包含 try-catch，异常不影响队列后续任务

### 压力测试结果

| 场景 | 并发 | 请求数 | 成功率 | 写操作失败 |
|------|------|--------|--------|-----------|
| 纯读 (4端点) | 10→300 | 6,540 | 99.98% | — |
| **纯写 (POST)** | **15→100** | **390** | **100%** | **0 ✅** |
| **读写混合 (70/30)** | **50→200** | **1,400** | **100%** | **0 ✅** |
| **突发写入** | **50→200** | **350** | **100%** | **0 ✅** |
| 极限并发 | 300→800 | 1,600 | 93.7% | — |

> 全部 **740 次写入操作零失败**。500+ 并发时出现的超时来自 NanoHTTPD 线程池限制，与数据库无关。

## 数据库表结构

| 表名 | 字段 | 说明 |
|------|------|------|
| `images` | id, url, status (0待审/1通过/2拒绝), created_at | 图片记录 |
| `users` | id, qq, role (1审核员/2管理员) | 用户权限 |
| `config` | k (主键), v | 键值配置 |
| `banned_users` | qq (主键), reason, banned_at | 封禁用户 |

## 特性

- 🔐 OAuth 认证集成
- 📡 FRPC 内网穿透支持
- ☁️ WebDAV 自动备份 (每次写入后自动同步)
- 📊 实时系统监控 (CPU/内存/磁盘/网络/电池)
- 🗄️ 数据库可视化管理 (SQL 查询、表浏览)
- ⚡ 写入队列高并发优化
- 📱 悬浮窗 + 开机自启 (Android)

## License

[GNU Affero General Public License v3.0](LICENSE)

Copyright (C) 2026  Memories contributors.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

