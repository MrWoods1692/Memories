import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { IconImage, IconCpu, IconStatusOn, IconCloudUpload, IconRefresh } from '../components/Icons';
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
      setRecentImages(Array.isArray(imgs) ? imgs.slice(0, 8) : []);
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

  const statusLabels: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const statusBadge: Record<number, string> = { 0: 'badge-0', 1: 'badge-1', 2: 'badge-2' };

  if (loading) {
    return (
      <div>
        <div className="stat-grid">
          {[1,2,3].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{width:44,height:44,borderRadius:10}} />
              <div>
                <div className="skeleton" style={{width:60,height:24,marginBottom:6}} />
                <div className="skeleton" style={{width:40,height:12}} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2><IconImage size={16} /> 最近图片</h2>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-row">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon images"><IconImage size={20} /></div>
          <div className="stat-info">
            <div className="num">{status?.image_count ?? 0}</div>
            <div className="label">图片总数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon port"><IconCpu size={20} /></div>
          <div className="stat-info">
            <div className="num">{config.server_port || '8080'}</div>
            <div className="label">API 端口</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon status"><IconStatusOn size={20} /></div>
          <div className="stat-info">
            <div className="num" style={{fontSize:20}}><span className="status-dot on" /> 运行中</div>
            <div className="label">服务状态</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2><IconImage size={16} /> 最近图片</h2>
        {recentImages.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconImage size={48} /></div>
            <p>暂无图片数据</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr>
              </thead>
              <tbody>
                {recentImages.map(i => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent-light)',fontWeight:600}}>#{i.id}</td>
                    <td className="url" title={i.url}>{i.url}</td>
                    <td><span className={`badge ${statusBadge[i.status]}`}>{statusLabels[i.status]}</span></td>
                    <td>{fmtTs(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>🔧 快捷操作</h2>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={triggerBackup}>
            <IconCloudUpload size={15} /> 立即备份到 WebDAV
          </button>
          <button className="btn btn-ghost" onClick={load}>
            <IconRefresh size={15} /> 刷新数据
          </button>
        </div>
      </div>
    </div>
  );
}

export function fmtTs(ts?: string): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

export function h(s?: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
