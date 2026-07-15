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
  oauth_domain?: string;
  frpc_config?: string;
}

export interface FrpcStatus {
  configured: boolean;
}

export interface DiskInfo {
  total: number;
  free: number;
  used: number;
}

export interface CpuFreqInfo {
  governor?: string;
  cur_khz?: number;
  max_khz?: number;
  min_khz?: number;
}

export interface CpuLoadInfo {
  avg1: number;
  avg5: number;
  avg15: number;
  running?: number;
  total_procs?: number;
}

export interface CpuInfo {
  cores: number;
  arch: string;
  model: string;
  implementer: string;
  cpu_arch: string;
  variant: string;
  part: string;
  revision: string;
  features: string;
  bogomips: number;
  frequencies: Record<string, CpuFreqInfo>;
  load: CpuLoadInfo;
}

export interface MemoryInfo {
  jvm_max: number;
  jvm_allocated: number;
  jvm_free: number;
  sys_total: number;
  sys_available: number;
}

export interface NetworkInfo {
  lan_ip: string;
  wifi_ssid?: string;
  dns: Record<string, string>;
  rx_bytes: number;
  tx_bytes: number;
  rx_speed?: number;
  tx_speed?: number;
}

export interface HardwareInfo {
  mem_total: number;
  storage_type: string;
  soc: string;
}

export interface BatteryInfo {
  level: number;
  status: string;
  charging: boolean;
  power_source: string;
  temperature: number;
  voltage: number;
  health: string;
  technology: string;
  device_model: string;
  android_version: string;
}

export interface SysInfo {
  disk: DiskInfo;
  db_size: number;
  uptime: number;
  cpu: CpuInfo;
  memory: MemoryInfo;
  network: NetworkInfo;
  battery: BatteryInfo;
  hardware: HardwareInfo;
}

export interface WebdavConfig {
  webdav_url?: string;
  webdav_user?: string;
  configured: boolean;
}
