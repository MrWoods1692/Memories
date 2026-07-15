/**
 * Memories API 文档数据
 * 所有 API 端点的结构化定义
 */

export const authMatrix = [
  { endpoint: '/images', method: 'POST', role: '无限制' },
  { endpoint: '/images/{id}/audit', method: 'POST', role: '审核员 (≥1)' },
  { endpoint: '/images/{id}', method: 'DELETE', role: '管理员 (≥2)' },
  { endpoint: '/users/*', method: '全部', role: '管理员 (≥2)' },
  { endpoint: '/bans/*', method: '全部', role: '管理员 (≥2)' },
  { endpoint: '/config', method: 'POST', role: '管理员 (≥2)' },
  { endpoint: '/frpc/config', method: 'POST', role: '管理员 (≥2)' },
  { endpoint: '/oauth/config', method: 'POST', role: '管理员 (≥2)' },
]

export const endpointGroups = [
  {
    icon: '❤️',
    title: '健康检查',
    desc: '服务可用性检查',
    endpoints: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        summary: '健康检查',
        auth: 'none',
        description: '检查服务是否正常运行。',
        response: { type: 'text', content: 'OK' },
      },
    ],
  },
  {
    icon: '🖼️',
    title: '图片管理',
    desc: '图片的上传、审核、删除',
    endpoints: [
      {
        id: 'images-get',
        method: 'GET',
        path: '/images',
        summary: '获取图片列表（分页）',
        auth: 'none',
        description: '分页获取图片列表，按创建时间倒序排列。默认每页 20 条。',
        queryParams: [
          { name: 'page', type: 'number', required: false, desc: '页码，从 1 开始（默认 1）' },
          { name: 'limit', type: 'number', required: false, desc: '每页条数（默认 20）' },
        ],
        response: {
          type: 'json',
          content: `{
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
}`,
        },
        responseFields: [
          { name: 'items[].id', type: 'number', desc: '图片唯一标识' },
          { name: 'items[].url', type: 'string', desc: '图片 URL 地址' },
          { name: 'items[].status', type: 'number', desc: '0=待审核, 1=已通过, 2=已拒绝' },
          { name: 'items[].created_at', type: 'number', desc: '创建时间（Unix 毫秒时间戳）' },
          { name: 'total', type: 'number', desc: '图片总数' },
          { name: 'page', type: 'number', desc: '当前页码' },
          { name: 'limit', type: 'number', desc: '每页条数' },
          { name: 'totalPages', type: 'number', desc: '总页数' },
        ],
      },
      {
        id: 'images-post',
        method: 'POST',
        path: '/images',
        summary: '上传图片',
        auth: 'none',
        description: '上传新图片。写入成功后自动触发 WebDAV 后台同步。',
        bodyParams: [
          { name: 'url', type: 'string', required: true, desc: '图片 URL 地址' },
        ],
        response: { type: 'json', content: '{"id": 42}' },
        notes: '写入成功后自动触发 WebDAV 后台同步（如已配置）。',
      },
      {
        id: 'images-audit',
        method: 'POST',
        path: '/images/{id}/audit',
        summary: '审核图片',
        auth: 'reviewer',
        description: '审核图片，将其标记为通过或拒绝。',
        pathParams: [{ name: 'id', type: 'number', desc: '图片 ID' }],
        bodyParams: [
          { name: 'status', type: 'string', required: true, desc: '"1"=通过，"2"=拒绝' },
        ],
        responseDesc: '成功: updated | 不存在: not found',
      },
      {
        id: 'images-delete',
        method: 'DELETE',
        path: '/images/{id}',
        summary: '删除图片',
        auth: 'admin',
        description: '删除指定图片。',
        pathParams: [{ name: 'id', type: 'number', desc: '图片 ID' }],
        responseDesc: '成功: deleted | 不存在: not found',
      },
    ],
  },
  {
    icon: '👤',
    title: '用户管理',
    desc: '审核员与管理员的增删查',
    endpoints: [
      {
        id: 'users-get',
        method: 'GET',
        path: '/users',
        summary: '获取用户列表',
        auth: 'admin',
        description: '获取所有用户列表。需要管理员权限。',
        response: {
          type: 'json',
          content: `[
  { "id": 1, "qq": "123456789", "role": 2 },
  { "id": 2, "qq": "987654321", "role": 1 }
]`,
        },
        responseFields: [
          { name: 'id', type: 'number', desc: '用户记录 ID' },
          { name: 'qq', type: 'string', desc: 'QQ 号' },
          { name: 'role', type: 'number', desc: '1=审核员, 2=管理员' },
        ],
      },
      {
        id: 'users-post',
        method: 'POST',
        path: '/users',
        summary: '添加用户',
        auth: 'admin',
        description: '添加审核员或管理员。',
        bodyParams: [
          { name: 'qq', type: 'string', required: true, desc: 'QQ 号' },
          { name: 'role', type: 'string', required: false, default: '1', desc: '"1"=审核员，"2"=管理员' },
        ],
        response: { type: 'json', content: '{"qq":"123456789","role":2}' },
        notes: '使用 INSERT OR REPLACE 策略，重复 QQ 号会覆盖原有角色。',
      },
      {
        id: 'users-delete',
        method: 'DELETE',
        path: '/users/{qq}',
        summary: '移除用户',
        auth: 'admin',
        description: '根据 QQ 号移除用户。',
        pathParams: [{ name: 'qq', type: 'string', desc: '要移除的 QQ 号' }],
        responseDesc: '成功: deleted | 不存在: not found',
      },
    ],
  },
  {
    icon: '🚫',
    title: '封禁管理',
    desc: '用户封禁与解封',
    endpoints: [
      {
        id: 'bans-get',
        method: 'GET',
        path: '/bans',
        summary: '获取封禁列表',
        auth: 'admin',
        description: '获取所有封禁用户列表，按封禁时间倒序排列。',
        response: {
          type: 'json',
          content: `[
  { "qq": "987654321", "reason": "违规上传图片", "banned_at": 1721000000000 }
]`,
        },
        responseFields: [
          { name: 'qq', type: 'string', desc: '被封禁的 QQ 号' },
          { name: 'reason', type: 'string', desc: '封禁原因' },
          { name: 'banned_at', type: 'number', desc: '封禁时间（Unix 毫秒时间戳）' },
        ],
      },
      {
        id: 'bans-post',
        method: 'POST',
        path: '/bans',
        summary: '封禁用户',
        auth: 'admin',
        description: '封禁指定 QQ 号的用户。',
        bodyParams: [
          { name: 'qq', type: 'string', required: true, desc: '要封禁的 QQ 号' },
          { name: 'reason', type: 'string', required: false, desc: '封禁原因' },
        ],
        response: { type: 'json', content: '{"qq":"987654321","banned":true}' },
      },
      {
        id: 'bans-delete',
        method: 'DELETE',
        path: '/bans/{qq}',
        summary: '解封用户',
        auth: 'admin',
        description: '解封指定 QQ 号的用户。',
        pathParams: [{ name: 'qq', type: 'string', desc: '要解封的 QQ 号' }],
        responseDesc: '成功: unbanned | 不存在: not found',
      },
    ],
  },
  {
    icon: '⚙️',
    title: '配置管理',
    desc: '全局配置的读取与修改',
    endpoints: [
      {
        id: 'config-get',
        method: 'GET',
        path: '/config',
        summary: '获取所有配置',
        auth: 'none',
        description: '获取所有配置项，以 JSON 对象返回所有键值对。',
        response: {
          type: 'json',
          content: `{
  "server_port": "8080",
  "admin_port": "8081",
  "platform_name": "Memories",
  "platform_logo": "https://...",
  "webdav_url": "https://...",
  "webdav_user": "admin",
  "webdav_pass": "***",
  "oauth_prefix": "my-campus",
  "oauth_client_id": "client_xxx",
  "oauth_client_secret": "secret_xxx",
  "oauth_redirect_uri": "https://...",
  "frpc_config": "[common]\\n..."
}`,
        },
      },
      {
        id: 'config-post',
        method: 'POST',
        path: '/config',
        summary: '设置配置',
        auth: 'admin',
        description: '设置单个配置项。空值表示清空该配置。',
        bodyParams: [
          { name: 'k', type: 'string', required: true, desc: '配置键' },
          { name: 'v', type: 'string', required: true, desc: '配置值（空字符串表示清空）' },
        ],
        response: { type: 'text', content: 'ok' },
      },
    ],
  },
  {
    icon: '📊',
    title: '服务状态',
    desc: '运行状态与系统信息',
    endpoints: [
      {
        id: 'status',
        method: 'GET',
        path: '/status',
        summary: '服务状态',
        auth: 'none',
        description: '获取服务运行状态摘要。',
        response: {
          type: 'json',
          content: `{
  "image_count": 42,
  "db_path": "/data/data/.../memories.db",
  "uptime": 3600000
}`,
        },
        responseFields: [
          { name: 'image_count', type: 'number', desc: '图片总数' },
          { name: 'db_path', type: 'string', desc: '数据库文件路径' },
          { name: 'uptime', type: 'number', desc: '服务运行时长（毫秒）' },
        ],
      },
      {
        id: 'sysinfo',
        method: 'GET',
        path: '/sysinfo',
        summary: '系统信息',
        auth: 'none',
        description:
          '获取 Android 设备的完整系统信息，包括磁盘、CPU、内存、网络、电池和硬件信息。',
        responseFields: [
          { name: 'disk.total', type: 'number', desc: '磁盘总容量（字节）' },
          { name: 'disk.free', type: 'number', desc: '磁盘可用容量（字节）' },
          { name: 'disk.used', type: 'number', desc: '磁盘已用容量（字节）' },
          { name: 'db_size', type: 'number', desc: '数据库文件大小（字节）' },
          { name: 'cpu.cores', type: 'number', desc: 'CPU 核心数' },
          { name: 'cpu.arch', type: 'string', desc: 'CPU 架构' },
          { name: 'cpu.model', type: 'string', desc: 'CPU 型号' },
          { name: 'cpu.load.avg1/5/15', type: 'number', desc: '系统负载（1/5/15分钟）' },
          { name: 'cpu.frequencies.coreN.*', type: 'object', desc: '每核心频率信息' },
          { name: 'memory.jvm_max', type: 'number', desc: 'JVM 最大内存（字节）' },
          { name: 'memory.sys_total', type: 'number', desc: '系统总内存（字节）' },
          { name: 'network.lan_ip', type: 'string', desc: '局域网 IP' },
          { name: 'network.wifi_ssid', type: 'string', desc: 'WiFi SSID' },
          { name: 'network.rx_speed', type: 'number', desc: '接收速率（字节/秒）' },
          { name: 'network.tx_speed', type: 'number', desc: '发送速率（字节/秒）' },
          { name: 'battery.level', type: 'number', desc: '电量百分比' },
          { name: 'battery.status', type: 'string', desc: '充电状态' },
          { name: 'battery.temperature', type: 'number', desc: '电池温度（摄氏度）' },
          { name: 'battery.device_model', type: 'string', desc: '设备型号' },
          { name: 'battery.android_version', type: 'string', desc: 'Android 版本' },
          { name: 'hardware.storage_type', type: 'string', desc: '存储类型（eMMC/UFS）' },
          { name: 'hardware.soc', type: 'string', desc: '芯片平台' },
        ],
      },
    ],
  },
  {
    icon: '☁️',
    title: 'WebDAV 备份',
    desc: 'WebDAV 配置状态',
    endpoints: [
      {
        id: 'webdav-config',
        method: 'GET',
        path: '/webdav/config',
        summary: 'WebDAV 配置',
        auth: 'none',
        description: '获取 WebDAV 备份配置状态。',
        response: {
          type: 'json',
          content: `{
  "webdav_url": "https://webdav.example.com/backup",
  "webdav_user": "admin",
  "configured": true
}`,
        },
        responseFields: [
          { name: 'webdav_url', type: 'string', desc: 'WebDAV 地址（未配置时为 null）' },
          { name: 'webdav_user', type: 'string', desc: 'WebDAV 用户名（未配置时为 null）' },
          { name: 'configured', type: 'boolean', desc: '是否已配置' },
        ],
      },
    ],
  },
  {
    icon: '🏷️',
    title: '平台信息',
    desc: '平台名称与 Logo',
    endpoints: [
      {
        id: 'platform',
        method: 'GET',
        path: '/platform',
        summary: '平台信息',
        auth: 'none',
        description: '获取平台名称和 Logo URL。',
        response: {
          type: 'json',
          content: `{
  "platform_name": "Memories",
  "platform_logo": "https://example.com/logo.png"
}`,
        },
        responseFields: [
          { name: 'platform_name', type: 'string', desc: '平台名称' },
          { name: 'platform_logo', type: 'string', desc: '平台 Logo URL' },
        ],
      },
    ],
  },
  {
    icon: '🔗',
    title: 'FRPC 内网穿透',
    desc: 'FRPC 配置与状态',
    endpoints: [
      {
        id: 'frpc-config-get',
        method: 'GET',
        path: '/frpc/config',
        summary: '获取 FRPC 配置',
        auth: 'none',
        description: '获取 FRPC 内网穿透配置内容。',
        response: {
          type: 'json',
          content: `{
  "frpc_config": "[common]\\nserver_addr = ...",
  "configured": true
}`,
        },
        responseFields: [
          { name: 'frpc_config', type: 'string', desc: 'INI 格式的 FRPC 配置' },
          { name: 'configured', type: 'boolean', desc: '是否已配置' },
        ],
      },
      {
        id: 'frpc-config-post',
        method: 'POST',
        path: '/frpc/config',
        summary: '设置 FRPC 配置',
        auth: 'admin',
        description: '设置 FRPC 内网穿透配置。',
        bodyParams: [
          { name: 'frpc_config', type: 'string', required: true, desc: 'INI 格式的 FRPC 配置内容' },
        ],
        response: { type: 'text', content: 'ok' },
      },
      {
        id: 'frpc-status',
        method: 'GET',
        path: '/frpc/status',
        summary: 'FRPC 状态',
        auth: 'none',
        description: '获取 FRPC 运行状态。',
        response: { type: 'json', content: '{ "configured": true }' },
      },
    ],
  },
  {
    icon: '🔑',
    title: 'OAuth 认证',
    desc: '第三方 OAuth 登录（PKCE S256）',
    endpoints: [
      {
        id: 'oauth-config-get',
        method: 'GET',
        path: '/oauth/config',
        summary: 'OAuth 配置状态',
        auth: 'none',
        description: '获取 OAuth 配置状态。',
        response: { type: 'json', content: '{ "configured": true }' },
      },
      {
        id: 'oauth-config-post',
        method: 'POST',
        path: '/oauth/config',
        summary: '配置 OAuth',
        auth: 'admin',
        description: '配置 OAuth 认证参数。',
        bodyParams: [
          { name: 'prefix', type: 'string', required: false, desc: 'OAuth 校园墙前缀' },
          { name: 'client_id', type: 'string', required: false, desc: 'OAuth Client ID' },
          { name: 'client_secret', type: 'string', required: false, desc: 'OAuth Client Secret' },
          { name: 'redirect_uri', type: 'string', required: false, desc: 'OAuth 回调地址' },
        ],
        response: { type: 'text', content: 'ok' },
      },
      {
        id: 'oauth-start',
        method: 'GET',
        path: '/oauth/start',
        summary: '发起 OAuth 授权',
        auth: 'none',
        description: '发起 OAuth 授权流程，返回授权跳转 URL。使用 PKCE S256 增强安全性。',
        response: {
          type: 'json',
          content: `{
  "url": "https://my-campus.campux.top/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=profile+tenant&state=...&code_challenge=...&code_challenge_method=S256"
}`,
        },
        notes: '前置条件：必须先配置 oauth_prefix、oauth_client_id、oauth_redirect_uri。',
      },
      {
        id: 'oauth-callback',
        method: 'GET',
        path: '/oauth/callback',
        summary: 'OAuth 回调',
        auth: 'none',
        description:
          'OAuth 授权回调处理。用授权码换取 token，再获取用户信息，返回综合登录结果。',
        queryParams: [
          { name: 'code', type: 'string', required: true, desc: 'OAuth 授权码' },
          { name: 'state', type: 'string', required: true, desc: '防 CSRF 状态值' },
        ],
        response: {
          type: 'json',
          content: `{
  "qq": "123456789",
  "username": "张三",
  "tenant_name": "南方科技大学",
  "role": 2,
  "access_token": "eyJhbGci...",
  "refresh_token": "def50200...",
  "is_reviewer": true,
  "is_admin": true
}`,
        },
        responseFields: [
          { name: 'qq', type: 'string', desc: '用户 QQ 号' },
          { name: 'username', type: 'string', desc: '用户名' },
          { name: 'tenant_name', type: 'string', desc: '所属学校/租户名称' },
          { name: 'role', type: 'number', desc: '本地角色（0=普通,1=审核员,2=管理员）' },
          { name: 'access_token', type: 'string', desc: 'OAuth Access Token' },
          { name: 'refresh_token', type: 'string', desc: 'OAuth Refresh Token' },
          { name: 'is_reviewer', type: 'boolean', desc: '是否为审核员' },
          { name: 'is_admin', type: 'boolean', desc: '是否为管理员' },
        ],
      },
      {
        id: 'oauth-refresh',
        method: 'POST',
        path: '/oauth/refresh',
        summary: '刷新 Token',
        auth: 'none',
        description: '刷新过期的 Access Token。',
        bodyParams: [
          { name: 'refresh_token', type: 'string', required: true, desc: '之前获取的 Refresh Token' },
        ],
        responseDesc: '由 OAuth 服务返回的 Token 响应 JSON',
      },
    ],
  },
]

export const databaseTables = [
  {
    name: 'images',
    desc: '图片表',
    sql: `CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    status INTEGER DEFAULT 0,
    created_at INTEGER
);`,
    columns: [
      { name: 'id', type: 'INTEGER', desc: '自增主键' },
      { name: 'url', type: 'TEXT', desc: '图片 URL' },
      { name: 'status', type: 'INTEGER', desc: '0=待审核, 1=已通过, 2=已拒绝' },
      { name: 'created_at', type: 'INTEGER', desc: '创建时间戳' },
    ],
  },
  {
    name: 'users',
    desc: '用户表',
    sql: `CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qq TEXT,
    role INTEGER
);`,
    columns: [
      { name: 'id', type: 'INTEGER', desc: '自增主键' },
      { name: 'qq', type: 'TEXT', desc: 'QQ 号' },
      { name: 'role', type: 'INTEGER', desc: '1=审核员, 2=管理员' },
    ],
  },
  {
    name: 'config',
    desc: '配置表',
    sql: `CREATE TABLE config (
    k TEXT PRIMARY KEY,
    v TEXT
);`,
    columns: [
      { name: 'k', type: 'TEXT', desc: '配置键（主键）' },
      { name: 'v', type: 'TEXT', desc: '配置值' },
    ],
  },
  {
    name: 'banned_users',
    desc: '封禁用户表',
    sql: `CREATE TABLE banned_users (
    qq TEXT PRIMARY KEY,
    reason TEXT,
    banned_at INTEGER
);`,
    columns: [
      { name: 'qq', type: 'TEXT', desc: 'QQ 号（主键）' },
      { name: 'reason', type: 'TEXT', desc: '封禁原因' },
      { name: 'banned_at', type: 'INTEGER', desc: '封禁时间戳' },
    ],
  },
]

/**
 * 所有端点的扁平列表（用于侧边栏导航）
 */
export function getAllEndpoints() {
  const flat = []
  for (const group of endpointGroups) {
    for (const ep of group.endpoints) {
      flat.push({ ...ep, groupTitle: group.title, groupIcon: group.icon })
    }
  }
  return flat
}
