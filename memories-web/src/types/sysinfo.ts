export interface ServerStatus {
  db_path: string;
  image_count: number;
  request_count: number;
  today_request_count: number;
  uptime: number;
}

export interface SysInfoCpu {
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
  frequencies: Record<string, { governor?: string; cur_khz?: number; max_khz?: number; min_khz?: number }>;
  load: {
    avg1: number;
    avg5: number;
    avg15: number;
    running?: number;
    total_procs?: number;
  };
}

export interface SysInfoMemory {
  jvm_max: number;
  jvm_allocated: number;
  jvm_free: number;
  sys_total: number;
  sys_available: number;
}

export interface SysInfoDisk {
  total: number;
  free: number;
  used: number;
}

export interface SysInfoBattery {
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

export interface SysInfoHardware {
  mem_total: number;
  storage_type: string;
  soc: string;
}

export interface SysInfo {
  disk: SysInfoDisk;
  db_size: number;
  uptime: number;
  cpu: SysInfoCpu;
  memory: SysInfoMemory;
  battery: SysInfoBattery;
  hardware: SysInfoHardware;
}
