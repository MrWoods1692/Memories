import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconUsers, IconPlus, IconTrash } from '../components/Icons';
import type { UserItem } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function UsersPage({ toast }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qq, setQq] = useState('');
  const [role, setRole] = useState<1 | 2>(1);
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet<UserItem[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast('加载失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!qq.trim()) { toast('请输入QQ号', 'error'); return; }
    try {
      await apiPost('/users', { qq: qq.trim(), role: String(role) });
      toast('添加成功');
      setQq('');
      load();
    } catch { toast('添加失败', 'error'); }
  };

  const remove = (targetQq: string) => {
    setConfirm({
      msg: `确定移除用户 ${targetQq}？`,
      fn: async () => {
        try { await apiDelete(`/users/${targetQq}`); toast('已移除'); load(); }
        catch { toast('移除失败', 'error'); }
      },
    });
  };

  const roleLabel = (r: 1 | 2) => r === 2 ? '管理员' : '审核员';

  return (
    <div>
      <div className="card">
        <h2><IconPlus size={16} /> 添加用户</h2>
        <div className="form-row">
          <div className="fg">
            <label>QQ 号</label>
            <input value={qq} onChange={e => setQq(e.target.value)} placeholder="输入 QQ 号" />
          </div>
          <div className="fg">
            <label>角色</label>
            <select value={role} onChange={e => setRole(parseInt(e.target.value) as 1 | 2)}>
              <option value={1}>审核员</option>
              <option value={2}>管理员</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={add}><IconPlus size={14} /> 添加</button>
        </div>
      </div>

      <div className="card">
        <h2><IconUsers size={16} /> 用户列表 <span className="count">共 {users.length} 人</span></h2>
        {loading ? <div className="skeleton" style={{height:200}} /> : users.length === 0 ? (
          <div className="empty">暂无用户</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>QQ</th><th>角色</th><th>操作</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{fontFamily:'var(--mono)',fontWeight:500}}>{u.qq}</td>
                    <td><span className={`badge ${u.role === 2 ? 'b-admin' : 'b-reviewer'}`}>{roleLabel(u.role)}</span></td>
                    <td><button className="btn danger xs" onClick={() => remove(u.qq)}><IconTrash size={12} /> 移除</button></td>
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
