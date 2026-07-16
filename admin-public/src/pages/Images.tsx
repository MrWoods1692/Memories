import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconImage, IconUsers, IconBan, IconPlus, IconTrash, IconCheck, IconX, IconRefresh } from '../components/Icons';
import type { ImageItem } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function ImagesPage({ toast }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const [acting, setActing] = useState<Set<number>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImageItem[]>('/images');
      setImages(Array.isArray(data) ? data : []);
    } catch { toast('加载失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const audit = async (id: number, status: 1 | 2) => {
    setActing(p => new Set(p).add(id));
    try {
      await apiPost(`/images/${id}/audit`, { status: String(status) });
      toast(status === 1 ? '已通过' : '已拒绝');
      load();
    } catch { toast('操作失败', 'error'); }
    finally { setActing(p => { const n = new Set(p); n.delete(id); return n; }); }
  };

  const del = (id: number) => {
    setConfirm({
      msg: `确定删除图片 #${id}？`,
      fn: async () => {
        try { await apiPost(`/images/${id}/delete`); toast('已删除'); load(); }
        catch { toast('删除失败', 'error'); }
      },
    });
  };

  let filtered = images;
  if (filter) filtered = filtered.filter(i => i.status === parseInt(filter));
  if (search) filtered = filtered.filter(i => (i.url || '').toLowerCase().includes(search.toLowerCase()));

  const s: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const b: Record<number, string> = { 0: 'b0', 1: 'b1', 2: 'b2' };

  return (
    <div>
      <div className="card">
        <h2><IconImage size={16} /> 图片管理 <span className="count">共 {images.length} 张</span></h2>
        <div className="filter-bar">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已拒绝</option>
          </select>
          <input placeholder="搜索 URL..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn ghost sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
        </div>
        {loading ? <div className="skeleton" style={{height:200}} /> : filtered.length === 0 ? (
          <div className="empty">暂无图片</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent)',fontWeight:600}}>#{i.id}</td>
                    <td className="url" title={i.url}>{i.url}</td>
                    <td><span className={`badge ${b[i.status]}`}>{s[i.status]}</span></td>
                    <td>{fmt(i.created_at)}</td>
                    <td>
                      <div className="btn-row">
                        {i.status !== 1 && <button className="btn success xs" disabled={acting.has(i.id)} onClick={() => audit(i.id, 1)}><IconCheck size={12} /> 通过</button>}
                        {i.status !== 2 && <button className="btn warn xs" disabled={acting.has(i.id)} onClick={() => audit(i.id, 2)}><IconX size={12} /> 拒绝</button>}
                        <button className="btn danger xs" onClick={() => del(i.id)}><IconTrash size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirm && <ConfirmDialog msg={confirm.msg} onOk={() => { confirm.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function fmt(ts?: string) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-'; }
