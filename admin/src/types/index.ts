// 图片状态：0=待审核, 1=已通过, 2=已拒绝
export type ImageStatus = 0 | 1 | 2;

export interface ImageItem {
  id: number;
  url: string;
  status: ImageStatus;
  created_at: string;
}

// 用户角色：1=审核员, 2=管理员
export type UserRole = 1 | 2;

export interface User {
  id: number;
  qq: string;
  role: UserRole;
}

export interface BannedUser {
  qq: string;
  reason: string;
  banned_at: string;
}

export interface ServerStatus {
  image_count: number;
  db_path: string;
  uptime: number;
}

export interface AppConfig {
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
  oauth_redirect_uri?: string;
  frpc_config?: string;
}

export interface FrpcStatus {
  configured: boolean;
}

export interface WebdavConfig {
  webdav_url?: string;
  webdav_user?: string;
  configured: boolean;
}
