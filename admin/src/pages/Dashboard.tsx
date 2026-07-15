import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import type { ServerStatus, ImageItem, AppConfig } from '../types';

interface DashboardProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export function Dashboard({ toast }: DashboardProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [config, setConfig] = useState<AppConfig>({});
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, c, imgs] = await Promise.all([
        apiGet<ServerStatus>('/status'),
        apiGet<string>('/config'),
        apiGet<ImageItem[]>('/images'),
      ]);
      setStatus(s);
      try { setConfig(JSON.parse(c as unknown as string)); } catch { /* ignore */ }
      setRecentImages(Array.isArray(imgs) ? imgs.slice(0, 10) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const triggerBackup = async () => {
    try {
      const r = await apiPost('/backup');
      toast(r as string);
    } catch {
      toast('备份失败', 'error');
    }
  };

  const statusLabels = ['待审核', '已通过', '已拒绝'];

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="num">{status?.image_count ?? 0}</div>
          <div className="label">图片总数</div>
        </div>
        <div className="stat-card">
          <div className="num">{config.server_port || '8080'}</div>
          <div className="label">API端口</div>
        </div>
        <div className="stat-card">
          <div className="num"><span className="status-dot on" /></div>
          <div className="label">运行状态</div>
        </div>
      </div>

      <div className="card">
        <h2>📋 最近图片</h2>
        {recentImages.length === 0 ? (
          <div className="empty">暂无图片</div>
        ) : (
          <table>
            <thead>
              <tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr>
            </thead>
            <tbody>
              {recentImages.map(i => (
                <tr key={i.id}>
                  <td>{i.id}</td>
                  <td className="url" title={i.url}>{i.url}</td>
                  <td><span className={`badge badge-${i.status}`}>{statusLabels[i.status]}</span></td>
                  <td>{fmtTs(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>🔧 快捷操作</h2>
        <button className="btn btn-primary" onClick={triggerBackup}>💾 立即备份到 WebDAV</button>
        <button className="btn btn-warn" style={{ marginLeft: 10 }} onClick={load}>🔄 刷新所有数据</button>
      </div>
    </div>
  );
}

export function fmtTs(ts?: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN');
}

export function h(s?: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
