import { useEffect, useState } from 'react';
import { apiGet } from '../api';
import { IconImage, IconRefresh } from '../components/Icons';
import type { ServerStatus, ImageItem } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function DashboardPage({ toast: _toast }: Props) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [recent, setRecent] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, imgs] = await Promise.all([
        apiGet<ServerStatus>('/status'),
        apiGet<ImageItem[]>('/images'),
      ]);
      setStatus(s);
      setRecent(Array.isArray(imgs) ? imgs.slice(0, 6) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, []);

  const s: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const b: Record<number, string> = { 0: 'b0', 1: 'b1', 2: 'b2' };

  if (loading) return <div className="skeleton" style={{height:300}} />;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><IconImage size={20} /></div>
          <div><div className="num">{status?.image_count ?? 0}</div><div className="label">图片总数</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div><div className="num" style={{fontSize:18}}><span className="dot green" /> 运行中</div><div className="label">服务状态</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
          </div>
          <div><div className="num">{uptime(status?.uptime || 0)}</div><div className="label">运行时间</div></div>
        </div>
      </div>

      <div className="card">
        <h2><IconImage size={16} /> 最近图片</h2>
        {recent.length === 0 ? <div className="empty">暂无数据</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr></thead>
              <tbody>
                {recent.map(i => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent)',fontWeight:600}}>#{i.id}</td>
                    <td className="url" title={i.url}>{i.url}</td>
                    <td><span className={`badge ${b[i.status]}`}>{s[i.status]}</span></td>
                    <td>{fmt(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <button className="btn ghost sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
      </div>
    </div>
  );
}

function uptime(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h/24)}天 ${h%24}时`;
  if (h > 0) return `${h}时 ${m}分`;
  return `${m}分`;
}
function fmt(ts?: string) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-'; }
