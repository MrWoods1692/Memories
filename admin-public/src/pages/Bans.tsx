import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconBan } from '../components/Icons';
import type { BanItem } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function BansPage({ toast }: Props) {
  const [bans, setBans] = useState<BanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qq, setQq] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<BanItem[]>('/bans');
      setBans(Array.isArray(data) ? data : []);
    } catch { toast('加载失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const ban = async () => {
    if (!qq.trim()) { toast('请输入QQ号', 'error'); return; }
    try {
      await apiPost('/bans', { qq: qq.trim(), reason: reason.trim() });
      toast(`已封禁 ${qq.trim()}`);
      setQq(''); setReason('');
      load();
    } catch { toast('封禁失败', 'error'); }
  };

  const unban = (targetQq: string) => {
    setConfirm({
      msg: `确定解封 ${targetQq}？`,
      fn: async () => {
        try { await apiDelete(`/bans/${targetQq}`); toast('已解封'); load(); }
        catch { toast('解封失败', 'error'); }
      },
    });
  };

  return (
    <div>
      <div className="card">
        <h2><IconBan size={16} /> 封禁用户</h2>
        <div className="form-row">
          <div className="fg">
            <label>QQ 号</label>
            <input value={qq} onChange={e => setQq(e.target.value)} placeholder="输入 QQ 号" />
          </div>
          <div className="fg">
            <label>封禁原因</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="可选" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn danger" onClick={ban}><IconBan size={14} /> 封禁</button>
        </div>
      </div>

      <div className="card">
        <h2><IconBan size={16} /> 封禁列表 <span className="count">共 {bans.length} 条</span></h2>
        {loading ? <div className="skeleton" style={{height:200}} /> : bans.length === 0 ? (
          <div className="empty">暂无封禁</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>QQ</th><th>原因</th><th>封禁时间</th><th>操作</th></tr></thead>
              <tbody>
                {bans.map(b => (
                  <tr key={b.qq}>
                    <td style={{fontFamily:'var(--mono)',fontWeight:500}}>{b.qq}</td>
                    <td>{b.reason || '-'}</td>
                    <td>{fmt(b.banned_at)}</td>
                    <td><button className="btn success xs" onClick={() => unban(b.qq)}>解封</button></td>
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
