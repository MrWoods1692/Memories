import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
        <h2>🚫 封禁用户</h2>
        <div className="form-row">
          <div>
            <label>QQ号</label>
            <input type="text" value={qq} onChange={e => setQq(e.target.value)} placeholder="输入QQ号" />
          </div>
          <div>
            <label>封禁原因</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="可选" />
          </div>
        </div>
        <button className="btn btn-danger" onClick={banUser}>封禁用户</button>
      </div>

      <div className="card">
        <h2>📋 封禁列表</h2>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : bans.length === 0 ? (
          <div className="empty">暂无封禁</div>
        ) : (
          <table>
            <thead>
              <tr><th>QQ</th><th>原因</th><th>封禁时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              {bans.map(b => (
                <tr key={b.qq}>
                  <td>{h(b.qq)}</td>
                  <td>{h(b.reason || '-')}</td>
                  <td>{fmtTs(b.banned_at)}</td>
                  <td>
                    <button className="btn btn-success btn-sm" onClick={() => unbanUser(b.qq)}>解封</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={() => setConfirmAction(null)} />
      )}
    </div>
  );
}
