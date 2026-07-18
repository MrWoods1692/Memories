import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiGet, apiPost } from '../api';
import { useAuth } from '../AuthContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconImage, IconCheck, IconX, IconTrash, IconRefresh, IconArrowLeft, IconArrowRight, IconGrid, IconList } from '../components/Icons';
import type { ImageItem, PaginatedResponse } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function ImagesPage({ toast }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 2;
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const [acting, setActing] = useState<Set<number>>(new Set());
  const [previewIdx, setPreviewIdx] = useState<number>(-1);
  const [viewMode, setViewMode] = useState<'table' | 'gallery'>('table');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [zoomed, setZoomed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<PaginatedResponse<ImageItem>>('/images?status=all');
      setImages(data?.items ?? []);
    } catch { toast('加载失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const audit = useCallback(async (id: number, status: 1 | 2) => {
    setActing(p => new Set(p).add(id));
    try {
      await apiPost(`/images/${id}/audit`, { status: String(status) });
      toast(status === 1 ? '已通过' : '已拒绝');
      await load();
      setSelected(p => { const n = new Set(p); n.delete(id); return n; });
      return true;
    } catch { toast('操作失败', 'error'); return false; }
    finally { setActing(p => { const n = new Set(p); n.delete(id); return n; }); }
  }, [toast]);

  const batchAudit = async (status: 1 | 2) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setConfirm({
      msg: `确定${status === 1 ? '通过' : '拒绝'}选中的 ${ids.length} 张图片？`,
      fn: async () => {
        let ok = 0;
        for (const id of ids) {
          const r = await audit(id, status);
          if (r) ok++;
        }
        toast(`${status === 1 ? '通过' : '拒绝'}了 ${ok} 张`, 'success');
      },
    });
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

  const toggleSelect = (id: number) => {
    setSelected(p => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    const pendings = filtered.filter(i => i.status === 0);
    if (selected.size === pendings.length && pendings.length > 0) setSelected(new Set());
    else setSelected(new Set(pendings.map(i => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

  let filtered = images;
  if (filter) filtered = filtered.filter(i => i.status === parseInt(filter));
  if (search) filtered = filtered.filter(i => (i.url || '').toLowerCase().includes(search.toLowerCase()));

  // 统计信息
  const stats = useMemo(() => {
    const total = images.length;
    const pending = images.filter(i => i.status === 0).length;
    const approved = images.filter(i => i.status === 1).length;
    const rejected = images.filter(i => i.status === 2).length;
    return { total, pending, approved, rejected };
  }, [images]);

  // 预览导航：在所有审核图片中导航
  const pendingList = images.filter(i => i.status === 0);
  const pendingIds = new Set(pendingList.map(i => i.id));

  const goPreview = (idx: number) => {
    if (idx < 0 || idx >= filtered.length) return;
    setPreviewIdx(idx);
    setZoomed(false);
  };

  const previewPrev = () => {
    for (let i = previewIdx - 1; i >= 0; i--) {
      if (pendingIds.has(filtered[i].id)) { setPreviewIdx(i); setZoomed(false); return; }
    }
  };

  const previewNext = () => {
    for (let i = previewIdx + 1; i < filtered.length; i++) {
      if (pendingIds.has(filtered[i].id)) { setPreviewIdx(i); setZoomed(false); return; }
    }
  };

  const previewItem = previewIdx >= 0 && previewIdx < filtered.length ? filtered[previewIdx] : null;
  const hasPrev = previewIdx > 0 && filtered.slice(0, previewIdx).some(i => pendingIds.has(i.id));
  const hasNext = previewIdx < filtered.length - 1 && filtered.slice(previewIdx + 1).some(i => pendingIds.has(i.id));

  const handlePreviewAudit = async (status: 1 | 2) => {
    if (!previewItem) return;
    const ok = await audit(previewItem.id, status);
    if (ok && hasNext) previewNext();
    else if (ok) setPreviewIdx(-1);
  };

  const toggleZoom = () => setZoomed(z => !z);

  // 键盘快捷键
  useEffect(() => {
    if (previewIdx < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPreviewIdx(-1); setZoomed(false); }
      if (e.key === 'ArrowLeft' && hasPrev) previewPrev();
      if (e.key === 'ArrowRight' && hasNext) previewNext();
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) handlePreviewAudit(1);
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) handlePreviewAudit(2);
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey) toggleZoom();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIdx, hasPrev, hasNext, previewItem]);

  const s: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const b: Record<number, string> = { 0: 'b0', 1: 'b1', 2: 'b2' };

  return (
    <div>
      {/* ---- 审核统计 ---- */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon warn"><IconImage size={20} /></div>
          <div><div className="num">{stats.pending}</div><div className="label">待审核</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><IconCheck size={20} /></div>
          <div><div className="num">{stats.approved}</div><div className="label">已通过</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger"><IconX size={20} /></div>
          <div><div className="num">{stats.rejected}</div><div className="label">已拒绝</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><IconImage size={20} /></div>
          <div><div className="num">{stats.total}</div><div className="label">总计</div></div>
        </div>
      </div>

      <div className="card">
        <h2><IconImage size={16} /> 图片管理 <span className="count">共 {images.length} 张</span></h2>

        {/* ---- 筛选栏 ---- */}
        <div className="filter-bar">
          <select value={filter} onChange={e => { setFilter(e.target.value); clearSelection(); }}>
            <option value="">全部状态</option>
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已拒绝</option>
          </select>
          <input placeholder="搜索 URL..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn ghost sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
          <div className="view-toggle">
            <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
              <IconList size={14} /> 列表
            </button>
            <button className={viewMode === 'gallery' ? 'active' : ''} onClick={() => setViewMode('gallery')}>
              <IconGrid size={14} /> 画廊
            </button>
          </div>
        </div>

        {/* ---- 批量操作栏 ---- */}
        {selected.size > 0 && (
          <div className="batch-bar">
            <span className="batch-count">已选 {selected.size} 张</span>
            <button className="btn ghost sm" onClick={clearSelection}>取消选择</button>
            <div className="batch-actions">
              <button className="btn success sm" onClick={() => batchAudit(1)}>
                <IconCheck size={14} /> 全部通过
              </button>
              <button className="btn danger sm" onClick={() => batchAudit(2)}>
                <IconX size={14} /> 全部拒绝
              </button>
            </div>
          </div>
        )}

        {loading ? <div className="skeleton" style={{height:200}} /> : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconImage size={48} /></div>
            暂无图片
          </div>
        ) : viewMode === 'table' ? (
          /* ---- 表格视图 ---- */
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{width:36,textAlign:'center'}}>
                    <input type="checkbox" checked={selected.size > 0 && selected.size === filtered.filter(i => i.status === 0).length}
                      onChange={selectAll} style={{width:14,height:14,margin:0,cursor:'pointer'}} />
                  </th>
                  <th>ID</th>
                  <th>缩略图</th>
                  <th>URL</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => (
                  <tr key={i.id} className={selected.has(i.id) ? 'row-selected' : ''}>
                    <td style={{textAlign:'center'}}>
                      {i.status === 0 && (
                        <input type="checkbox" checked={selected.has(i.id)}
                          onChange={() => toggleSelect(i.id)}
                          style={{width:14,height:14,margin:0,cursor:'pointer'}} />
                      )}
                    </td>
                    <td style={{color:'var(--accent)',fontWeight:600}}>#{i.id}</td>
                    <td>
                      <div className="thumb-cell" onClick={() => goPreview(idx)} title="点击预览">
                        <img src={i.url} alt={`#${i.id}`} loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    </td>
                    <td className="url preview-link" title={i.url} onClick={() => goPreview(idx)}>{i.url}</td>
                    <td><span className={`badge ${b[i.status]}`}>{s[i.status]}</span></td>
                    <td>{fmt(i.created_at)}</td>
                    <td>
                      <div className="btn-row">
                        {i.status === 0 && (
                          <>
                            <button className="btn success xs" disabled={acting.has(i.id)} onClick={() => audit(i.id, 1)}><IconCheck size={12} /> 通过</button>
                            <button className="btn warn xs" disabled={acting.has(i.id)} onClick={() => audit(i.id, 2)}><IconX size={12} /> 拒绝</button>
                          </>
                        )}
                        {i.status !== 0 && isAdmin && (
                          <button className="btn danger xs" onClick={() => del(i.id)}><IconTrash size={12} /> 删除</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ---- 画廊视图 ---- */
          <div className="gallery-grid">
            {filtered.map((i, idx) => (
              <div key={i.id}
                className={`gallery-item ${selected.has(i.id) ? 'selected' : ''}`}
                onClick={() => goPreview(idx)}
                onContextMenu={e => { e.preventDefault(); if (i.status === 0) toggleSelect(i.id); }}
              >
                <span className="gallery-id">#{i.id}</span>
                <span className={`gallery-badge gallery-status-${i.status}`}>{s[i.status]}</span>
                {i.status === 0 && (
                  <div className="gallery-check" onClick={e => { e.stopPropagation(); toggleSelect(i.id); }}>
                    {selected.has(i.id) && <IconCheck size={14} />}
                  </div>
                )}
                <img src={i.url} alt={`#${i.id}`} loading="lazy"
                  onError={e => {
                    const t = e.target as HTMLImageElement;
                    t.style.display = 'none';
                    t.parentElement!.style.background = 'var(--bg4)';
                  }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {confirm && <ConfirmDialog msg={confirm.msg} onOk={() => { confirm.fn(); setConfirm(null); }} onCancel={() => setConfirm(null)} />}

      {/* ---- 图片预览弹窗 ---- */}
      {previewItem && (
        <div className="overlay preview-overlay" onClick={() => { setPreviewIdx(-1); setZoomed(false); }}>
          <div className="preview-dialog" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <span className="preview-title">图片预览 #{previewItem.id}</span>
              <span className={`badge ${b[previewItem.status]}`}>{s[previewItem.status]}</span>
              <button className="preview-close" onClick={() => { setPreviewIdx(-1); setZoomed(false); }} title="关闭 (Esc)">
                <IconX size={18} />
              </button>
            </div>
            <div className="preview-body">
              <div className="preview-body-inner">
                <img src={previewItem.url} alt={`#${previewItem.id}`}
                  className={`preview-img ${zoomed ? 'zoomed' : ''}`}
                  onClick={toggleZoom}
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    const fb = img.parentElement!.querySelector('.preview-body-error') as HTMLElement;
                    if (fb) fb.style.display = 'flex';
                  }} />
                <div className="preview-body-error" style={{display:'none'}}>
                  <IconImage size={48} />
                  <span>图片加载失败</span>
                </div>
                <span className="preview-zoom-hint">{zoomed ? '点击还原' : '点击放大 (Z)'}</span>
              </div>
            </div>
            <div className="preview-actions">
              <div className="preview-nav">
                <button className="btn ghost sm" disabled={!hasPrev} onClick={previewPrev} title="上一张 (←)">
                  ← 上一张
                </button>
                <span className="preview-pos">
                  {pendingList.findIndex(i => i.id === previewItem.id) + 1} / {pendingList.length} 待审
                </span>
                <button className="btn ghost sm" disabled={!hasNext} onClick={previewNext} title="下一张 (→)">
                  下一张 →
                </button>
              </div>
              <div className="preview-shortcuts">
                <span><kbd>A</kbd> 通过</span>
                <span><kbd>R</kbd> 拒绝</span>
                <span><kbd>Z</kbd> 缩放</span>
                <span><kbd>← →</kbd> 切换</span>
              </div>
              <div className="preview-audit">
                {previewItem.status === 0 ? (
                  <>
                    <button className="btn success" disabled={acting.has(previewItem.id)} onClick={() => handlePreviewAudit(1)} title="通过 (A)">
                      <IconCheck size={16} /> 通过
                    </button>
                    <button className="btn danger" disabled={acting.has(previewItem.id)} onClick={() => handlePreviewAudit(2)} title="拒绝 (R)">
                      <IconX size={16} /> 不通过
                    </button>
                  </>
                ) : isAdmin ? (
                  <button className="btn danger" onClick={() => { del(previewItem.id); setPreviewIdx(-1); }}>
                    <IconTrash size={16} /> 删除
                  </button>
                ) : (
                  <span className="preview-done">该图片已{previewItem.status === 1 ? '通过' : '拒绝'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(ts?: string) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-'; }

