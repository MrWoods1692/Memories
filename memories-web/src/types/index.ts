/** OAuth 回调重定向参数（URL query params） */
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
  id: number;
  url: string;
  status: number;      // 0=待审核, 1=已通过, 2=已拒绝
  created_at: number;   // Unix 毫秒时间戳
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
