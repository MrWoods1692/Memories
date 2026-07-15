import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconImage, IconSearch, IconTrash, IconCheck, IconX } from '../components/Icons';
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

  const statusLabels: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const statusBadge: Record<number, string> = { 0: 'badge-0', 1: 'badge-1', 2: 'badge-2' };

  return (
    <div className="card">
      <h2><IconImage size={16} /> 图片列表 <span className="card-count">共 {images.length} 张</span></h2>

      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="0">待审核</option>
          <option value="1">已通过</option>
          <option value="2">已拒绝</option>
        </select>
        <input
          type="text" placeholder="搜索 URL..." value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={load}><IconSearch size={13} /> 搜索</button>
        <button className="btn btn-danger btn-sm" onClick={batchDelete}><IconTrash size={13} /> 批量删除 ({selected.size})</button>
      </div>

      {loading ? (
        <div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton-row" style={{gridTemplateColumns:'30px 40px 1fr 80px 120px 100px'}}>
              <div className="skeleton" /><div className="skeleton" />
              <div className="skeleton" /><div className="skeleton" />
              <div className="skeleton" /><div className="skeleton" />
            </div>
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconImage size={48} /></div>
          <p>暂无图片</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} /></th>
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
                  <td style={{color:'var(--accent-light)',fontWeight:600}}>#{i.id}</td>
                  <td className="url" title={i.url}>{i.url}</td>
                  <td><span className={`badge ${statusBadge[i.status]}`}>{statusLabels[i.status]}</span></td>
                  <td style={{whiteSpace:'nowrap'}}>{fmtTs(i.created_at)}</td>
                  <td>
                    <button className="btn btn-success btn-xs" onClick={() => auditImage(i.id, 1)} title="通过"><IconCheck size={12} /></button>
                    {' '}
                    <button className="btn btn-warn btn-xs" onClick={() => auditImage(i.id, 2)} title="拒绝"><IconX size={12} /></button>
                    {' '}
                    <button className="btn btn-danger btn-xs" onClick={() => deleteImage(i.id)} title="删除"><IconTrash size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
