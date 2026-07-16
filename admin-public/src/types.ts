export interface AuthUser {
  qq: string;
  role: 1 | 2; // 1=审核员, 2=管理员
  nickname?: string;
}

export interface ImageItem {
  id: number;
  url: string;
  status: 0 | 1 | 2; // 0=待审核, 1=已通过, 2=已拒绝
  created_at: string;
}

export interface UserItem {
  id: number;
  qq: string;
  role: 1 | 2;
}

export interface BanItem {
  qq: string;
  reason: string;
  banned_at: string;
}

export interface ServerStatus {
  image_count: number;
  db_path: string;
  uptime: number;
}

export interface SiteConfig {
  platform_name?: string;
  platform_logo?: string;
  server_port?: string;
  admin_port?: string;
  auto_cleanup_rejected?: string;
}
