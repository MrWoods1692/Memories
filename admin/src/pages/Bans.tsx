import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconBan, IconUnlock, IconAlert } from '../components/Icons';
import { h, fmtTs } from './Dashboard';
import type { BannedUser } from '../types';

interface BansProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export function Bans({ toast }: BansProps) {
  const [bans, setBans] = useState<BannedUser[]>([]);
  const [qq, setQq] = useState('');
  const [reason, setReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const b = await apiGet<BannedUser[]>('/bans');
      setBans(Array.isArray(b) ? b : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const banUser = async () => {
    if (!qq.trim()) { toast('请输入QQ号', 'error'); return; }
    try {
      await apiPost('/bans', { qq: qq.trim(), reason: reason.trim() });
      toast(`已封禁 ${qq.trim()}`);
      setQq('');
      setReason('');
      load();
    } catch {
      toast('封禁失败', 'error');
    }
  };

  const unbanUser = (targetQq: string) => {
    setConfirmMsg(`确定解封 ${targetQq}？`);
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/bans/${targetQq}`);
        toast('已解封');
        load();
      } catch {
        toast('解封失败', 'error');
      }
      setConfirmAction(null);
    });
  };

  return (
    <div>
      <div className="card">
        <h2><IconBan size={16} /> 封禁用户</h2>
        <div className="form-row">
          <div className="form-group">
            <label>QQ 号</label>
            <input type="text" value={qq} onChange={e => setQq(e.target.value)} placeholder="输入 QQ 号" />
          </div>
          <div className="form-group">
            <label>封禁原因</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="可选" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-danger" onClick={banUser}><IconBan size={15} /> 封禁用户</button>
        </div>
      </div>

      <div className="card">
        <h2><IconAlert size={16} /> 封禁列表 <span className="card-count">共 {bans.length} 条</span></h2>
        {loading ? (
          <div>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-row" style={{gridTemplateColumns:'120px 1fr 140px 60px'}}>
                <div className="skeleton" /><div className="skeleton" />
                <div className="skeleton" /><div className="skeleton" />
              </div>
            ))}
          </div>
        ) : bans.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconBan size={48} /></div>
            <p>暂无封禁记录</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>QQ</th><th>原因</th><th>封禁时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {bans.map(b => (
                  <tr key={b.qq}>
                    <td style={{fontWeight:500,color:'var(--danger)'}}>{h(b.qq)}</td>
                    <td style={{color:'var(--text-muted)'}}>{h(b.reason || '-')}</td>
                    <td style={{whiteSpace:'nowrap'}}>{fmtTs(b.banned_at)}</td>
                    <td>
                      <button className="btn btn-success btn-xs" onClick={() => unbanUser(b.qq)}><IconUnlock size={12} /> 解封</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={() => setConfirmAction(null)} />
      )}
    </div>
  );
}
