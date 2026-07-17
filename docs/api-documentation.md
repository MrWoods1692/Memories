# Memories API 文档

> **版本**: 1.0  
> **基础 URL**: `http://<设备局域网IP>:8080`  
> **协议**: HTTP/1.1  
> **编码**: UTF-8  
> **内容类型**: POST 请求使用 `application/x-www-form-urlencoded`，响应为 `application/json` 或 `text/plain`

---

## 目录

- [架构概述](#架构概述)
- [认证与授权](#认证与授权)
- [通用约定](#通用约定)
- [API 端点](#api-端点)
  - [1. 健康检查](#1-健康检查)
  - [2. 图片管理](#2-图片管理)
  - [3. 用户管理](#3-用户管理)
  - [4. 封禁管理](#4-封禁管理)
  - [5. 配置管理](#5-配置管理)
  - [6. 服务状态](#6-服务状态)
  - [7. 系统信息](#7-系统信息)
  - [8. WebDAV 配置](#8-webdav-配置)
  - [9. 平台信息](#9-平台信息)
  - [10. FRPC 内网穿透](#10-frpc-内网穿透)
  - [11. OAuth 认证](#11-oauth-认证)
- [数据模型](#数据模型)
- [错误处理](#错误处理)
- [数据库表结构](#数据库表结构)

---

## 架构概述

Memories 运行在 Android 设备上，内嵌 HTTP API 服务器，配备两个管理面板：

| 组件 | 端口 | 访问范围 | 用途 |
|------|------|---------|------|
| **EmbeddedServer** (API) | `8080` | 公网 | REST API，CORS 全开放 |
| **AdminServer** | `8081` | 仅局域网 | 内网运维管理面板（完整系统管理） |
| **公网管理面板** | — | 公网 | 独立部署的纯前端，OAuth 登录，管理员/审核员使用 |

- **API 服务器**：所有响应自动添加 CORS 头（`Access-Control-Allow-Origin: *`），支持公网跨域调用。
- **数据库**：SQLite，存储在外部存储 `/sdcard/Memories/memories.db`，卸载应用不丢失。

---

## 认证与授权

### 角色体系

| 角色值 | 名称 | 权限 |
|--------|------|------|
| `0` | 未注册用户 | 仅可上传图片 |
| `1` | 审核员 (Reviewer) | 审核图片（通过/拒绝） |
| `2` | 管理员 (Admin) | 审核图片 + 管理用户 + 封禁管理 + 修改配置 |

### 认证方式

| 访问来源 | 认证方式 |
|---------|---------|
| **局域网** | 自动获得管理员权限（IP 检测） |
| **公网 (Bearer Token)** | 通过 OAuth 登录获取 token，请求头 `Authorization: Bearer <token>` |
| **公网 (x-user-qq)** | 请求头携带 `x-user-qq`，后端查 `users` 表确定角色 |

### CORS 头

API 服务器 (8080) 所有响应均包含：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-user-qq, Authorization
Access-Control-Max-Age: 86400
```

---

## 通用约定

### 请求格式

- **GET** / **DELETE**：无请求体，参数通过 URL 路径或查询字符串传递
- **POST**：请求体使用 `application/x-www-form-urlencoded` 编码

### 响应格式

- 成功响应：`200 OK`，返回 JSON 或纯文本
- 错误响应：对应 HTTP 状态码（`400 Bad Request`、`401 Unauthorized`、`404 Not Found`、`500 Internal Server Error`），返回纯文本错误信息

### CORS 头

API 服务器 (8080) 所有响应均包含以下 CORS 头，允许任意来源跨域访问：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-user-qq, Authorization
Access-Control-Max-Age: 86400
```

---

## API 端点

### 1. 健康检查

#### `GET /health`

检查服务是否正常运行。

**认证**：无需认证

**响应示例**：
```
OK
```

---

### 2. 图片管理

#### `GET /images`

分页获取图片列表，按创建时间倒序排列。

**认证**：

| 查询方式 | 返回数据 | 所需认证 |
|----------|----------|----------|
| 默认（无 `status` 参数） | 仅审核通过 (status=1) 的图片 | 无需认证 |
| `?status=all` | 全部状态的图片 | 审核员 (role≥1) 或局域网 |

**查询参数**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | `number` | 否 | `1` | 页码，从 1 开始 |
| `limit` | `number` | 否 | `20` | 每页返回的图片数量 |
| `status` | `string` | 否 | — | `all` 时返回全部状态图片，需审核身份 |

**响应**：

```json
{
  "items": [
    {
      "id": 1,
      "url": "https://example.com/photo.jpg",
      "status": 0,
      "created_at": 1721000000000
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `array` | 当前页图片列表 |
| `items[].id` | `number` | 图片唯一标识 |
| `items[].url` | `string` | 图片 URL 地址 |
| `items[].status` | `number` | 审核状态：`0`=待审核，`1`=已通过，`2`=已拒绝 |
| `items[].created_at` | `number` | 创建时间（Unix 毫秒时间戳） |
| `total` | `number` | 图片总数 |
| `page` | `number` | 当前页码 |
| `limit` | `number` | 每页条数 |
| `totalPages` | `number` | 总页数 |

**请求示例**：
```
GET /images?page=1&limit=20            ← 只返回审核通过的图片
GET /images?page=2&limit=50&status=all ← 返回全部状态（需审核身份）
```

---

#### `POST /images`

上传新图片。

**认证**：无需认证

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | `string` | 是 | 图片 URL 地址 |

**响应示例**：

```json
{"id": 42}
```

**副作用**：写入成功后自动触发 WebDAV 后台同步（如已配置 WebDAV）。

---

#### `POST /images/{id}/audit`

审核图片（通过或拒绝）。

**认证**：审核员 (role ≥ 1) 或局域网用户

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `number` | 图片 ID |

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | `string` | 是 | `"1"`=通过，`"2"`=拒绝 |

**响应**：

- 成功：`updated`
- 图片不存在：`not found`

---

#### `DELETE /images/{id}`

删除指定图片。

**认证**：管理员 (role ≥ 2) 或局域网用户

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `number` | 图片 ID |

**响应**：

- 成功：`deleted`
- 图片不存在：`not found`

---

### 3. 用户管理

> 所有用户管理接口需要**管理员权限** (role ≥ 2) 或局域网用户。

#### `GET /users`

获取所有用户列表。

**响应**：

```json
[
  {
    "id": 1,
    "qq": "123456789",
    "role": 2
  },
  {
    "id": 2,
    "qq": "987654321",
    "role": 1
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `number` | 用户记录 ID |
| `qq` | `string` | QQ 号 |
| `role` | `number` | 角色：`1`=审核员，`2`=管理员 |

---

#### `POST /users`

添加用户。

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `qq` | `string` | 是 | - | QQ 号 |
| `role` | `string` | 否 | `"1"` | 角色：`"1"`=审核员，`"2"`=管理员 |

**响应示例**：

```json
{"qq":"123456789","role":2}
```

**注意**：使用 `INSERT OR REPLACE` 策略，重复 QQ 号会覆盖原有角色。

---

#### `DELETE /users/{qq}`

移除用户。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `qq` | `string` | 要移除的 QQ 号 |

**响应**：

- 成功：`deleted`
- 用户不存在：`not found`

---

### 4. 封禁管理

> 所有封禁管理接口需要**管理员权限** (role ≥ 2) 或局域网用户。

#### `GET /bans`

获取所有封禁用户列表，按封禁时间倒序排列。

**响应**：

```json
[
  {
    "qq": "987654321",
    "reason": "违规上传图片",
    "banned_at": 1721000000000
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `qq` | `string` | 被封禁的 QQ 号 |
| `reason` | `string` | 封禁原因 |
| `banned_at` | `number` | 封禁时间（Unix 毫秒时间戳） |

---

#### `POST /bans`

封禁用户。

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `qq` | `string` | 是 | 要封禁的 QQ 号 |
| `reason` | `string` | 否 | 封禁原因 |

**响应示例**：

```json
{"qq":"987654321","banned":true}
```

---

#### `DELETE /bans/{qq}`

解封用户。

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `qq` | `string` | 要解封的 QQ 号 |

**响应**：

- 成功：`unbanned`
- 用户未被封禁：`not found`

---

### 5. 配置管理

#### `GET /config`

获取所有配置项（以 JSON 对象返回所有键值对）。

**认证**：无需认证

**响应示例**：

```json
{
  "server_port": "8080",
  "admin_port": "8081",
  "platform_name": "Memories",
  "platform_logo": "https://example.com/logo.png",
  "webdav_url": "https://webdav.example.com/backup",
  "webdav_user": "admin",
  "webdav_pass": "encrypted_password",
  "oauth_prefix": "my-campus",
  "oauth_client_id": "client_xxx",
  "oauth_client_secret": "secret_xxx",
  "oauth_redirect_uri": "https://memories.example.com/callback",
  "frpc_config": "[common]\nserver_addr = frp.example.com\nserver_port = 7000"
}
```

| 配置键 | 说明 |
|--------|------|
| `server_port` | API 服务器端口 |
| `admin_port` | 管理面板端口 |
| `platform_name` | 平台名称 |
| `platform_logo` | 平台 Logo URL |
| `webdav_url` | WebDAV 备份地址 |
| `webdav_user` | WebDAV 用户名 |
| `webdav_pass` | WebDAV 密码 |
| `oauth_prefix` | OAuth 校园墙前缀 |
| `oauth_client_id` | OAuth Client ID |
| `oauth_client_secret` | OAuth Client Secret |
| `oauth_redirect_uri` | OAuth 回调地址 |
| `frpc_config` | FRPC 配置文件内容 |

---

#### `POST /config`

设置单个配置项。

**认证**：管理员 (role ≥ 2) 或局域网用户

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `k` | `string` | 是 | 配置键 |
| `v` | `string` | 是 | 配置值（空字符串表示清空/删除该配置） |

**响应**：`ok`

**请求示例**：

```
POST /config
Content-Type: application/x-www-form-urlencoded

k=platform_name&v=我的校园墙
```

---

### 6. 服务状态

#### `GET /status`

获取服务运行状态摘要。

**认证**：无需认证

**响应**：

```json
{
  "image_count": 42,
  "db_path": "/data/data/com.example.memories/databases/memories.db",
  "uptime": 3600000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `image_count` | `number` | 图片总数 |
| `db_path` | `string` | 数据库文件路径 |
| `uptime` | `number` | 服务运行时长（毫秒） |

---

### 7. 系统信息

#### `GET /sysinfo`

获取 Android 设备的完整系统信息，包括磁盘、CPU、内存、网络、电池和硬件信息。

**认证**：无需认证

**响应**：

```json
{
  "disk": {
    "total": 64000000000,
    "free": 12000000000,
    "used": 52000000000
  },
  "db_size": 204800,
  "uptime": 86400000,
  "cpu": {
    "cores": 8,
    "arch": "aarch64",
    "model": "Qualcomm Snapdragon 8 Gen 2",
    "implementer": "0x51",
    "cpu_arch": "8",
    "variant": "0x1",
    "part": "0x001",
    "revision": "14",
    "features": "fp asimd evtstrm aes pmull sha1 sha2 crc32",
    "bogomips": 38.4,
    "frequencies": {
      "core0": {
        "governor": "schedutil",
        "cur_khz": 1804800,
        "max_khz": 2841600,
        "min_khz": 300000
      },
      "core1": { "...": "..." }
    },
    "load": {
      "avg1": 1.5,
      "avg5": 1.2,
      "avg15": 0.9,
      "running": 2,
      "total_procs": 450
    }
  },
  "memory": {
    "jvm_max": 268435456,
    "jvm_allocated": 134217728,
    "jvm_free": 67108864,
    "sys_total": 8589934592,
    "sys_available": 4294967296
  },
  "network": {
    "lan_ip": "192.168.1.100",
    "wifi_ssid": "MyWiFi",
    "dns": {
      "dns1": "192.168.1.1",
      "dns2": "8.8.8.8"
    },
    "rx_bytes": 123456789,
    "tx_bytes": 98765432,
    "rx_speed": 1024000,
    "tx_speed": 512000,
    "total_rx": 1234567890,
    "total_tx": 987654321
  },
  "battery": {
    "level": 85,
    "status": "充电中",
    "charging": true,
    "power_source": "交流电",
    "temperature": 32.5,
    "voltage": 4.2,
    "health": "良好",
    "technology": "Li-ion",
    "device_model": "Redmi K60",
    "android_version": "14"
  },
  "hardware": {
    "mem_total": 8589934592,
    "storage_type": "UFS/Other",
    "soc": "Qualcomm Snapdragon 8 Gen 2"
  }
}
```

##### `disk` - 磁盘信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | `number` | 总容量（字节） |
| `free` | `number` | 可用容量（字节） |
| `used` | `number` | 已用容量（字节） |

##### `cpu` - CPU 信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `cores` | `number` | CPU 核心数 |
| `arch` | `string` | CPU 架构（如 aarch64） |
| `model` | `string` | CPU 型号 |
| `implementer` | `string` | CPU 实现者 ID |
| `cpu_arch` | `string` | CPU 架构版本 |
| `variant` | `string` | CPU 变体 |
| `part` | `string` | CPU 部件号 |
| `revision` | `string` | CPU 修订版本 |
| `features` | `string` | CPU 特性列表 |
| `bogomips` | `number` | BogoMIPS 值 |
| `frequencies` | `object` | 各核心频率信息 |
| `frequencies.coreN.governor` | `string` | CPU 调频策略 |
| `frequencies.coreN.cur_khz` | `number` | 当前频率 (kHz) |
| `frequencies.coreN.max_khz` | `number` | 最大频率 (kHz) |
| `frequencies.coreN.min_khz` | `number` | 最小频率 (kHz) |
| `load` | `object` | 系统负载 |
| `load.avg1` | `number` | 1 分钟平均负载 |
| `load.avg5` | `number` | 5 分钟平均负载 |
| `load.avg15` | `number` | 15 分钟平均负载 |
| `load.running` | `number` | 运行中进程数 |
| `load.total_procs` | `number` | 总进程数 |

##### `memory` - 内存信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `jvm_max` | `number` | JVM 最大内存（字节） |
| `jvm_allocated` | `number` | JVM 已分配内存（字节） |
| `jvm_free` | `number` | JVM 空闲内存（字节） |
| `sys_total` | `number` | 系统总内存（字节） |
| `sys_available` | `number` | 系统可用内存（字节） |

##### `network` - 网络信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `lan_ip` | `string` | 局域网 IP 地址 |
| `wifi_ssid` | `string` | WiFi SSID（可能为空） |
| `dns` | `object` | DNS 服务器 (`dns1`, `dns2`) |
| `rx_bytes` | `number` | 本次读取的接收字节数 |
| `tx_bytes` | `number` | 本次读取的发送字节数 |
| `rx_speed` | `number` | 接收速率（字节/秒） |
| `tx_speed` | `number` | 发送速率（字节/秒） |
| `total_rx` | `number` | 累计接收字节数 |
| `total_tx` | `number` | 累计发送字节数 |

##### `battery` - 电池信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `level` | `number` | 电量百分比 |
| `status` | `string` | 电池状态（充电中/放电中/已充满/未充电/未知） |
| `charging` | `boolean` | 是否正在充电 |
| `power_source` | `string` | 电源类型（交流电/USB/无线充电/电池供电） |
| `temperature` | `number` | 电池温度（摄氏度） |
| `voltage` | `number` | 电池电压（伏特） |
| `health` | `string` | 电池健康状态（良好/过热/损坏/过压/过冷/未知） |
| `technology` | `string` | 电池技术（如 Li-ion） |
| `device_model` | `string` | 设备型号 |
| `android_version` | `string` | Android 版本 |

##### `hardware` - 硬件信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `mem_total` | `number` | 系统内存总量（字节） |
| `storage_type` | `string` | 存储类型（eMMC 或 UFS/Other） |
| `soc` | `string` | 芯片平台/SoC 型号 |

---

### 8. WebDAV 配置

#### `GET /webdav/config`

获取 WebDAV 备份配置状态。

**认证**：无需认证

**响应**：

```json
{
  "webdav_url": "https://webdav.example.com/backup",
  "webdav_user": "admin",
  "configured": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `webdav_url` | `string` | WebDAV 地址（未配置时为 `null`） |
| `webdav_user` | `string` | WebDAV 用户名（未配置时为 `null`） |
| `configured` | `boolean` | 是否已配置 WebDAV |

---

### 9. 平台信息

#### `GET /platform`

获取平台名称和 Logo URL。

**认证**：无需认证

**响应**：

```json
{
  "platform_name": "Memories",
  "platform_logo": "https://example.com/logo.png"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `platform_name` | `string` | 平台名称（未配置时为 `null`） |
| `platform_logo` | `string` | 平台 Logo URL（未配置时为 `null`） |

---

### 10. FRPC 内网穿透

#### `GET /frpc/config`

获取 FRPC 配置内容。

**认证**：无需认证

**响应**：

```json
{
  "frpc_config": "[common]\nserver_addr = frp.example.com\nserver_port = 7000\n\n[memories]\ntype = http\nlocal_port = 8080\ncustom_domains = memories.example.com",
  "configured": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `frpc_config` | `string` | FRPC 配置内容（INI 格式） |
| `configured` | `boolean` | 是否已配置 |

---

#### `POST /frpc/config`

设置 FRPC 配置。

**认证**：管理员 (role ≥ 2) 或局域网用户

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `frpc_config` | `string` | 是 | INI 格式的 FRPC 配置内容 |

**响应**：`ok`

---

#### `GET /frpc/status`

获取 FRPC 运行状态。

**认证**：无需认证

**响应**：

```json
{
  "configured": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `configured` | `boolean` | FRPC 是否已配置 |

---

### 11. OAuth 认证

Memories 集成 Campux 校园墙 OAuth2 授权服务，使用 **PKCE S256** 授权码流程。OAuth state 存储在 SQLite 数据库中，进程重启不丢失。

#### OAuth 认证流程

```
┌─ 浏览器访问公网管理面板 ────────────────────────────────────────────┐
│                                                                     │
│  1. 点击 "校园墙 OAuth 登录"                                        │
│     ↓ window.location.href                                         │
│  2. GET /oauth/login?redirect=https://admin.example.com              │
│     ↓ 302 重定向                                                   │
│  3. Campux 授权页 → 用户授权                                        │
│     ↓                                                              │
│  4. Campux 回调 → GET /oauth/callback?code=...&state=...            │
│     ↓ 后端: code 换 token → 获取用户信息 → 查 QQ 角色               │
│  5. 302 重定向 → https://admin.example.com/?token=...&qq=...&role=2│
│     ↓ 前端解析 URL 参数，保存登录态                                  │
│  6. 进入管理后台                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### `GET /oauth/login`

浏览器直接访问此端点发起 OAuth 授权（302 重定向到 Campux）。

**认证**：无需认证

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `redirect` | `string` | 否 | OAuth 完成后重定向回的前端 URL |

**前置条件**：必须已配置 `oauth_prefix`、`oauth_client_id`、`oauth_redirect_uri`

**响应**：`302 Found`，Location 指向 Campux 授权页

**请求示例**：
```
GET /oauth/login?redirect=https://admin.example.com
```

---

#### `GET /oauth/start`

API 方式发起 OAuth 授权，返回授权 URL（JSON 格式）。

**认证**：无需认证

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `redirect` | `string` | 否 | OAuth 完成后重定向回的前端 URL |

**响应**：

```json
{
  "url": "https://kg.campux.top/oauth/authorize?response_type=code&client_id=IaFgvscjJaBHAzU4&redirect_uri=http%3A%2F%2F39.105.100.46%3A8080%2Foauth%2Fcallback&scope=profile&state=random_state&code_challenge=PKCE_challenge&code_challenge_method=S256"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | Campux 授权页完整 URL |

**授权 URL 参数说明**：

| 参数 | 说明 |
|------|------|
| `response_type` | 固定 `code` |
| `client_id` | Campux OAuth Client ID |
| `redirect_uri` | 后端回调地址（`oauth_redirect_uri` 配置值） |
| `scope` | `profile` |
| `state` | 随机防 CSRF 值，关联的 `code_verifier` 存入数据库 |
| `code_challenge` | PKCE S256 挑战码 |
| `code_challenge_method` | 固定 `S256` |

---

#### `GET /oauth/callback`

Campux OAuth 回调处理。用户授权后 Campux 重定向到此端点。

**认证**：无需认证

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `code` | `string` | OAuth 授权码（一次性，10 分钟有效） |
| `state` | `string` | 防 CSRF 状态值 |

**处理流程**：

1. 从数据库获取 `code_verifier`（用完即删）
2. 用授权码 + code_verifier 向 Campux 换取 access_token
3. 用 access_token 获取用户信息（QQ 号、用户名等）
4. 根据 QQ 号查询本地用户角色
5. **如果授权时传了 `redirect` 参数**：302 重定向到前端 URL，携带 token/qq/role
6. **否则**：返回 JSON

**成功响应（有前端重定向）**：

```
302 Found
Location: https://admin.example.com/?token=abc123&qq=1692138502&role=2&nickname=喵喵~喵~
```

**成功响应（无前端重定向，JSON）**：

```json
{
  "qq": "1692138502",
  "username": "喵喵~喵~",
  "tenant_name": "奎光墙",
  "role": 2,
  "access_token": "cIWGoNpwmE6_awClYAqWui4zP7eSDuQdzEg0BDQxauM",
  "refresh_token": "OFRFHo0tm-mWle-PanFZFq_6Mb7ntze4srT2doSiyqs",
  "is_reviewer": true,
  "is_admin": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `qq` | `string` | 用户 QQ 号 (来自 Campux `name` 字段) |
| `username` | `string` | 用户显示名 |
| `tenant_name` | `string` | 所属校园墙名称 |
| `role` | `number` | 本地角色（`0`=普通用户，`1`=审核员，`2`=管理员） |
| `access_token` | `string` | Campux Access Token（24h 有效） |
| `refresh_token` | `string` | Campux Refresh Token（30天有效） |
| `is_reviewer` | `boolean` | role ≥ 1 |
| `is_admin` | `boolean` | role ≥ 2 |

---

#### `POST /oauth/refresh`

刷新过期的 Access Token。

**认证**：无需认证

**请求体** (`application/x-www-form-urlencoded`)：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refresh_token` | `string` | 是 | 之前获取的 Refresh Token |

**响应**：Campux 返回的 Token JSON，含新的 `access_token` 和 `refresh_token`。使用 `client_secret_basic` 认证（Authorization header）。

---

#### OAuth 配置

OAuth 参数通过通用 `/config` 端点管理（详见[配置管理](#5-配置管理)），相关配置键：

| 键 | 说明 |
|------|------|
| `oauth_prefix` | Campux 校园墙 slug，授权 URL 为 `https://{prefix}.campux.top` |
| `oauth_client_id` | Campux OAuth 应用 Client ID |
| `oauth_client_secret` | Campux OAuth 应用 Client Secret |
| `oauth_redirect_uri` | 后端回调地址，Campux 后台需登记此地址 |
| `oauth_domain` | 服务器域名（用于构造回调地址） |

---

## 数据模型

### ImageItem（图片）

```typescript
interface ImageItem {
  id: number;          // 图片唯一标识
  url: string;         // 图片 URL
  status: 0 | 1 | 2;  // 0=待审核, 1=已通过, 2=已拒绝
  created_at: number;  // 创建时间（Unix 毫秒时间戳）
}
```

### User（用户）

```typescript
interface User {
  id: number;      // 记录 ID
  qq: string;      // QQ 号
  role: 1 | 2;     // 1=审核员, 2=管理员
}
```

### BannedUser（封禁用户）

```typescript
interface BannedUser {
  qq: string;        // QQ 号
  reason: string;    // 封禁原因
  banned_at: number; // 封禁时间（Unix 毫秒时间戳）
}
```

### ServerStatus（服务状态）

```typescript
interface ServerStatus {
  image_count: number;  // 图片总数
  db_path: string;      // 数据库路径
  uptime: number;       // 运行时长（毫秒）
}
```

### AppConfig（应用配置）

```typescript
interface AppConfig {
  server_port?: string;
  admin_port?: string;
  platform_name?: string;
  platform_logo?: string;
  webdav_url?: string;
  webdav_user?: string;
  webdav_pass?: string;
  oauth_prefix?: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_domain?: string;
  frpc_config?: string;
}
```

### SysInfo（系统信息）

详见 [GET /sysinfo](#7-系统信息) 端点文档中的字段说明表。

---

## 错误处理

### HTTP 状态码

| 状态码 | 含义 | 常见原因 |
|--------|------|---------|
| `200 OK` | 成功 | - |
| `400 Bad Request` | 请求参数错误 | 缺少必填参数、参数值无效、OAuth 未配置 |
| `401 Unauthorized` | 未授权 | 权限不足，需要管理员或审核员身份 |
| `404 Not Found` | 资源不存在 | 图片/用户/封禁记录不存在 |
| `500 Internal Server Error` | 服务器内部错误 | 数据库异常、系统调用失败 |

### 错误响应格式

错误响应为纯文本格式：

```
admin required
```

```
missing url
```

```
not found
```

---

## 数据库表结构

数据库文件存储在外部存储：**`/sdcard/Memories/memories.db`**，卸载应用不丢失。若外部存储不可用则回退到内部存储。

包含以下 4 张表：

### `images` - 图片表

```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    status INTEGER DEFAULT 0,
    created_at INTEGER
);
```

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | `INTEGER` | 自增主键 |
| `url` | `TEXT` | 图片 URL |
| `status` | `INTEGER` | 审核状态：`0`=待审核，`1`=已通过，`2`=已拒绝 |
| `created_at` | `INTEGER` | 创建时间戳 |

### `users` - 用户表

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qq TEXT,
    role INTEGER
);
```

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | `INTEGER` | 自增主键 |
| `qq` | `TEXT` | QQ 号 |
| `role` | `INTEGER` | 角色：`1`=审核员，`2`=管理员 |

### `config` - 配置表

```sql
CREATE TABLE config (
    k TEXT PRIMARY KEY,
    v TEXT
);
```

| 列 | 类型 | 说明 |
|----|------|------|
| `k` | `TEXT` | 配置键（主键），OAuth state 以 `oauth_state_` 为前缀 |
| `v` | `TEXT` | 配置值，OAuth state 存储 JSON（含 `code_verifier`、`frontend_redirect` 等） |

### `banned_users` - 封禁用户表

```sql
CREATE TABLE banned_users (
    qq TEXT PRIMARY KEY,
    reason TEXT,
    banned_at INTEGER
);
```

| 列 | 类型 | 说明 |
|----|------|------|
| `qq` | `TEXT` | QQ 号（主键） |
| `reason` | `TEXT` | 封禁原因 |
| `banned_at` | `INTEGER` | 封禁时间戳 |

---

## 前端 API 客户端参考

管理面板前端使用以下封装的 API 请求方法（`/admin/src/api/index.ts`）：

```typescript
const API_BASE = window.__API_BASE__ || 'http://localhost:8080';

// GET 请求，自动解析 JSON
async function apiGet<T = unknown>(path: string): Promise<T>

// POST 请求，使用 application/x-www-form-urlencoded 编码
async function apiPost<T = string>(path: string, data?: Record<string, string>): Promise<T>

// DELETE 请求
async function apiDelete(path: string): Promise<string>
```

---

> **文档维护**: 本 API 文档基于 Memories 项目源代码自动生成。如有更新，请同步修改本文档。
