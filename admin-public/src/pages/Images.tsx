import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconImage, IconCheck, IconX, IconTrash, IconRefresh, IconArrowLeft, IconArrowRight } from '../components/Icons';
import type { ImageItem } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function ImagesPage({ toast }: Props) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const [acting, setActing] = useState<Set<number>>(new Set());
  const [previewIdx, setPreviewIdx] = useState<number>(-1);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ImageItem[]>('/images');
      setImages(Array.isArray(data) ? data : []);
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
      return true;
    } catch { toast('操作失败', 'error'); return false; }
    finally { setActing(p => { const n = new Set(p); n.delete(id); return n; }); }
  }, [toast]);

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

  // 预览导航：找出待审核图片索引
  const pendingList = images.filter(i => i.status === 0);
  const pendingIds = new Set(pendingList.map(i => i.id));

  const goPreview = (idx: number) => {
    if (idx < 0 || idx >= filtered.length) return;
    setPreviewIdx(idx);
  };

  const previewPrev = () => {
    for (let i = previewIdx - 1; i >= 0; i--) {
      if (pendingIds.has(filtered[i].id)) { setPreviewIdx(i); return; }
    }
  };

  const previewNext = () => {
    for (let i = previewIdx + 1; i < filtered.length; i++) {
      if (pendingIds.has(filtered[i].id)) { setPreviewIdx(i); return; }
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

  // 键盘快捷键
  useEffect(() => {
    if (previewIdx < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIdx(-1);
      if (e.key === 'ArrowLeft' && hasPrev) previewPrev();
      if (e.key === 'ArrowRight' && hasNext) previewNext();
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) handlePreviewAudit(1);
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) handlePreviewAudit(2);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewIdx, hasPrev, hasNext, previewItem]);

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
                {filtered.map((i, idx) => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent)',fontWeight:600}}>#{i.id}</td>
                    <td className="url preview-link" title={i.url} onClick={() => goPreview(idx)}>{i.url}</td>
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

      {/* ---- 图片预览弹窗 ---- */}
      {previewItem && (
        <div className="overlay preview-overlay" onClick={() => setPreviewIdx(-1)}>
          <div className="preview-dialog" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <span className="preview-title">图片预览 #{previewItem.id}</span>
              <span className={`badge ${b[previewItem.status]}`}>{s[previewItem.status]}</span>
              <button className="preview-close" onClick={() => setPreviewIdx(-1)} title="关闭 (Esc)">
                <IconX size={18} />
              </button>
            </div>
            <div className="preview-body">
              <img src={previewItem.url} alt={`#${previewItem.id}`} className="preview-img"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="preview-img-fallback" style={{display:'none'}}>图片加载失败</div>
            </div>
            <div className="preview-actions">
              <div className="preview-nav">
                <button className="btn ghost sm" disabled={!hasPrev} onClick={previewPrev} title="上一张 (←)">
                  ← 上一张
                </button>
                <span className="preview-pos">{pendingList.findIndex(i => i.id === previewItem.id) + 1} / {pendingList.length} 待审</span>
                <button className="btn ghost sm" disabled={!hasNext} onClick={previewNext} title="下一张 (→)">
                  下一张 →
                </button>
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
