import { useCallback, useRef } from "react";

const CACHE_PREFIX = "img_cache_";

/**
 * 图片缓存 Hook
 * 将远程图片以 Blob URL 形式缓存到内存中，加速二次加载
 */
export function useImageCache() {
  const cacheRef = useRef<Map<string, string>>(new Map());

  /** 加载图片并缓存 */
  const loadImage = useCallback(
    async (url: string): Promise<string> => {
      // 检查内存缓存
      const cached = cacheRef.current.get(url);
      if (cached) return cached;

      // 尝试从 localStorage 获取
      try {
        const key = CACHE_PREFIX + btoa(url);
        const stored = localStorage.getItem(key);
        if (stored) {
          cacheRef.current.set(url, stored);
          return stored;
        }
      } catch {
        // 忽略 localStorage 错误
      }

      // 直接返回原始 URL (浏览器自身会缓存)
      cacheRef.current.set(url, url);
      return url;
    },
    []
  );

  /** 预加载图片 */
  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }, []);

  /** 清除缓存 */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    // 清除 localStorage 中的图片缓存
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }, []);

  return { loadImage, preloadImage, clearCache };
}
