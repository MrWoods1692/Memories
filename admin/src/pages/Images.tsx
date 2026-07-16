import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconImage, IconSearch, IconTrash, IconCheck, IconX, IconCopy } from '../components/Icons';
import { useDebounce, copyToClipboard, relativeTime } from '../hooks';
import { fmtTs } from './Dashboard';
import type { ImageItem, ImageStatus } from '../types';

const PAGE_SIZE = 20;

interface ImagesProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
  refreshKey: number;
}

interface PaginatedImages {
  items: ImageItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function Images({ toast, refreshKey }: ImagesProps) {
  const [rawImages, setRawImages] = useState<ImageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<Set<number>>(new Set());

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await apiGet<PaginatedImages>(`/images?page=${p}&limit=${PAGE_SIZE}`);
      setRawImages(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage, refreshKey]);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    setSelected(new Set());
    loadPage(p);
  };

  const images = useMemo(() => {
    let result = rawImages;
    if (filter) result = result.filter(i => i.status === parseInt(filter) as ImageStatus);
    if (debouncedSearch) result = result.filter(i => (i.url || '').toLowerCase().includes(debouncedSearch.toLowerCase()));
    return result;
  }, [rawImages, filter, debouncedSearch]);

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
    setActing(prev => new Set(prev).add(id));
    try {
      await apiPost(`/images/${id}/audit`, { status: String(status) });
      toast(status === 1 ? '已通过' : '已拒绝');
      loadPage(page);
    } catch {
      toast('操作失败', 'error');
    } finally {
      setActing(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const deleteImage = (id: number) => {
    setConfirmMsg(`确定删除图片 #${id}？`);
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/images/${id}`);
        toast('已删除');
        loadPage(page);
      } catch {
        toast('删除失败', 'error');
      }
      setConfirmAction(null);
    });
  };

  const batchDelete = () => {
    if (selected.size === 0) { toast('请先选择图片', 'error'); return; }
    setConfirmMsg(`确定删除选中的 ${selected.size} 张图片？`);
    setConfirmAction(() => async () => {
      for (const id of selected) {
        try { await apiDelete(`/images/${id}`); } catch { /* continue */ }
      }
      setSelected(new Set());
      toast('批量删除完成');
      loadPage(page);
      setConfirmAction(null);
    });
  };

  const handleCopyUrl = async (url: string) => {
    const ok = await copyToClipboard(url);
    toast(ok ? '已复制到剪贴板' : '复制失败', ok ? 'success' : 'error');
  };

  const isSearching = search !== debouncedSearch;
  const statusLabels: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const statusBadge: Record<number, string> = { 0: 'badge-0', 1: 'badge-1', 2: 'badge-2' };

  // 分页按钮生成
  const pageButtons = useMemo(() => {
    const buttons: (number | string)[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) { buttons.push(1); if (start > 2) buttons.push('...'); }
    for (let i = start; i <= end; i++) buttons.push(i);
    if (end < totalPages) { if (end < totalPages - 1) buttons.push('...'); buttons.push(totalPages); }
    return buttons;
  }, [page, totalPages]);

  return (
    <div className="card">
      <h2><IconImage size={16} /> 图片列表 <span className="card-count">共 {total} 张{isSearching ? '…' : ''}</span></h2>

      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="0">待审核</option>
          <option value="1">已通过</option>
          <option value="2">已拒绝</option>
        </select>
        <div className="search-wrap">
          <IconSearch size={14} className="search-icon" />
          <input
            type="text" placeholder="搜索 URL…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        {selected.size > 0 && (
          <button className="btn btn-danger btn-sm" onClick={batchDelete}>
            <IconTrash size={13} /> 删除选中 ({selected.size})
          </button>
        )}
        <button className="btn btn-warn btn-sm" onClick={() => {
          setConfirmMsg('确定清理所有已拒绝的图片记录？此操作不可撤销。');
          setConfirmAction(() => async () => {
            try {
              const resp = await apiDelete('/images/cleanup');
              const data = JSON.parse(resp);
              toast(data.message || '清理完成', 'success');
              loadPage(page);
            } catch {
              toast('清理失败', 'error');
            }
            setConfirmAction(null);
          });
        }}>
          <IconTrash size={13} /> 清理已拒绝
        </button>
      </div>

      {loading ? (
        <div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton-row" style={{gridTemplateColumns:'30px 40px 1fr 80px 110px 110px'}}>
              <div className="skeleton" /><div className="skeleton" />
              <div className="skeleton" /><div className="skeleton" />
              <div className="skeleton" /><div className="skeleton" />
            </div>
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconImage size={48} /></div>
          <p>{rawImages.length === 0 ? '还没有图片，通过 API 上传第一张吧' : '没有匹配的图片'}</p>
        </div>
      ) : (
        <>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" onChange={e => toggleSelectAll(e.target.checked)} checked={selected.size === images.length && images.length > 0} /></th>
                <th>ID</th>
                <th>URL</th>
                <th>状态</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {images.map(i => {
                const busy = acting.has(i.id);
                return (
                <tr key={i.id} className={selected.has(i.id) ? 'row-selected' : ''} onClick={() => toggleSelect(i.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleSelect(i.id)} />
                  </td>
                  <td style={{color:'var(--accent)',fontWeight:600,fontSize:'0.72rem'}}>#{i.id}</td>
                  <td className="url" title={i.url}>
                    {i.url}
                    <button className="btn-copy" onClick={e => { e.stopPropagation(); handleCopyUrl(i.url); }} title="复制链接"><IconCopy size={12} /></button>
                  </td>
                  <td><span className={`badge ${statusBadge[i.status]}`}>{statusLabels[i.status]}</span></td>
                  <td style={{whiteSpace:'nowrap',fontSize:'0.73rem'}} title={fmtTs(i.created_at)}>{relativeTime(i.created_at)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="btn btn-success btn-xs" onClick={() => auditImage(i.id, 1)} title="通过" disabled={busy}>{busy ? <span className="spin">⟳</span> : <IconCheck size={12} />}</button>
                    {' '}
                    <button className="btn btn-warn btn-xs" onClick={() => auditImage(i.id, 2)} title="拒绝" disabled={busy}>{busy ? <span className="spin">⟳</span> : <IconX size={12} />}</button>
                    {' '}
                    <button className="btn btn-danger btn-xs" onClick={() => deleteImage(i.id)} title="删除"><IconTrash size={12} /></button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>上一页</button>
            {pageButtons.map((btn, idx) =>
              typeof btn === 'number' ? (
                <button key={idx} className={`btn btn-sm ${btn === page ? 'btn-primary' : ''}`} onClick={() => goToPage(btn)}>{btn}</button>
              ) : (
                <span key={idx} className="pagination-ellipsis">…</span>
              )
            )}
            <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>下一页</button>
            <span className="pagination-info">第 {page}/{totalPages} 页，每页 {PAGE_SIZE} 条</span>
          </div>
        )}
        </>
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
