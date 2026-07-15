import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { fmtTs } from './Dashboard';
import type { ImageItem, ImageStatus } from '../types';

interface ImagesProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
  refreshKey: number;
}

export function Images({ toast, refreshKey }: ImagesProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const imgs = await apiGet<ImageItem[]>('/images');
      let filtered = Array.isArray(imgs) ? imgs : [];
      if (filter) filtered = filtered.filter(i => i.status === parseInt(filter) as ImageStatus);
      if (search) filtered = filtered.filter(i => (i.url || '').toLowerCase().includes(search.toLowerCase()));
      setImages(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(images.map(i => i.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const auditImage = async (id: number, status: ImageStatus) => {
    try {
      await apiPost(`/images/${id}/audit`, { status: String(status) });
      toast(status === 1 ? '已通过' : '已拒绝');
      load();
    } catch {
      toast('操作失败', 'error');
    }
  };

  const deleteImage = (id: number) => {
    setConfirmMsg(`确定删除图片 #${id}？`);
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/images/${id}`);
        toast('已删除');
        load();
      } catch {
        toast('删除失败', 'error');
      }
      setConfirmAction(null);
    });
  };

  const batchDelete = () => {
    if (selected.size === 0) {
      toast('请先选择图片', 'error');
      return;
    }
    setConfirmMsg(`确定删除选中的 ${selected.size} 张图片？`);
    setConfirmAction(() => async () => {
      for (const id of selected) {
        try { await apiDelete(`/images/${id}`); } catch { /* continue */ }
      }
      setSelected(new Set());
      toast('批量删除完成');
      load();
      setConfirmAction(null);
    });
  };

  const statusLabels = ['待审核', '已通过', '已拒绝'];

  return (
    <div className="card">
      <h2>🖼️ 图片列表 <span style={{ fontSize: 12, color: '#888' }}>共 {images.length} 张</span></h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', marginBottom: 0 }}>
          <option value="">全部状态</option>
          <option value="0">待审核</option>
          <option value="1">已通过</option>
          <option value="2">已拒绝</option>
        </select>
        <input
          type="text" placeholder="搜索URL..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 200, marginBottom: 0 }}
        />
        <button className="btn btn-primary btn-sm" onClick={load}>🔍 搜索</button>
        <button className="btn btn-danger btn-sm" onClick={batchDelete}>🗑️ 批量删除选中</button>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : images.length === 0 ? (
        <div className="empty">暂无图片</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} /></th>
              <th>ID</th>
              <th>URL</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {images.map(i => (
              <tr key={i.id}>
                <td>
                  <input
                    type="checkbox" checked={selected.has(i.id)}
                    onChange={() => toggleSelect(i.id)}
                  />
                </td>
                <td>{i.id}</td>
                <td className="url" title={i.url}>{i.url}</td>
                <td><span className={`badge badge-${i.status}`}>{statusLabels[i.status]}</span></td>
                <td>{fmtTs(i.created_at)}</td>
                <td>
                  <button className="btn btn-success btn-sm" onClick={() => auditImage(i.id, 1)}>✓</button>
                  {' '}
                  <button className="btn btn-warn btn-sm" onClick={() => auditImage(i.id, 2)}>✗</button>
                  {' '}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteImage(i.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmAction && (
        <ConfirmDialog
          message={confirmMsg}
          onConfirm={confirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
