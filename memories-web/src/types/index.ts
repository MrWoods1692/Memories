export interface OAuthRedirectParams {
  token: string;
  qq: string;
  role: string;
  nickname: string;
}

/** 用户信息（前端存储） */
export interface AuthResponse {
  qq: string;
  username: string;
  role: number;
  access_token: string;
  is_reviewer: boolean;
  is_admin: boolean;
}

/** 图片资源（来自 GET /images） */
export interface ImageItem {
  id?: number;          // 自增主键
  url: string;
  status: number;      // 0=待审核, 1=已通过, 2=已拒绝
  created_at: number;   // Unix 毫秒时间戳（上传时间）
  qq?: string;          // 上传者 QQ
  /** 标签（服务端存 JSON 数组字符串，如 ["风景","旅行"]） */
  tags?: string;
  /** 图片描述（上传时单独填写） */
  description?: string;
  /** 上传时记录的完整 EXIF（JSON 字符串，前端提取后随上传入库） */
  exif?: string;
}

/** 广场搜索/筛选条件（GET /images 过滤参数） */
export interface ImageFilters {
  /** 描述关键词（模糊） */
  q?: string;
  /** 标签精确匹配 */
  tag?: string;
  /** EXIF 相机品牌 */
  make?: string;
  /** EXIF 相机型号 */
  model?: string;
  /** EXIF 镜头型号 */
  lens?: string;
  /** EXIF ISO（数字） */
  iso?: string;
}

/** 图片列表分页响应 */
export interface PaginatedResponse {
  items: ImageItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 上传记录 */
export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  localUrl: string;
  imageBedUrl?: string;
  status: 'pending' | 'uploading_imagebed' | 'uploading_server' | 'done' | 'failed';
  error?: string;
  createdAt: number;
  /** 批量/单独设置的标签 */
  tags?: string[];
  /** 单独填写的图片描述 */
  description?: string;
  /** 上传时提取的 EXIF JSON 字符串 */
  exif?: string;
}

/** 后台用户记录（GET /users） */
export interface AdminUser {
  id: number;
  qq: string;
  role: number;  // 1=审核员, 2=管理员
}

/** 后台封禁记录（GET /bans） */
export interface AdminBan {
  qq: string;
  reason: string;
  banned_at: number;  // Unix 毫秒时间戳
}

/** 健康检查响应 */
export interface HealthResponse {
  status: string;
}

/** OAuth 授权 URL 响应 */
export interface OAuthStartResponse {
  url: string;
}

/** 上传响应 */
export interface UploadImageResponse {
  // 不再返回 id，仅确认上传成功
}

/** 失控图床图片元数据（GET /api/v1.php?q=...） */
export interface ImageBedInfo {
  id: number;
  filename: string;
  original_filename: string;
  original_size_bytes: number;
  compressed_size_bytes: number;
  size_display: string;
  current_hash: string;
  upload_date: string;
  last_accessed: string | null;
  uploader_masked: string;
  location: string;
  tags: string;
  tags_array: string[];
  tag_updated_at: string | null;
  content_description: string;
  content_desc_updated_at: string | null;
  storage_backend: string;
  storage_location: string;
  image_url: string;
  cdn_domain: string;
  password_protected: boolean;
}
