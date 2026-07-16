/**
 * 全局配置
 * ★ 发布正式版本时，只需修改 API_BASE_URL 为正式域名
 */

/** 后端 API 基地址 */
export const API_BASE_URL = 'http://39.105.100.46:8080';

/** 健康检查地址（测试用） */
export const HEALTH_CHECK_URL = 'http://39.105.100.46:8080/health';

/**
 * 开发模式：跳过 OAuth，直接在登录页输入 QQ 号进入后台
 * ★ 生产环境请设为 false
 */
export const DEV_MODE = true;
