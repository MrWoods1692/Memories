import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconUsers, IconPlus, IconTrash, IconUser, IconShield } from '../components/Icons';
import { h } from './Dashboard';
import type { User, UserRole } from '../types';

interface UsersProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export function Users({ toast }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [qq, setQq] = useState('');
  const [role, setRole] = useState<UserRole>(1);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const u = await apiGet<User[]>('/users');
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addUser = async () => {
    if (!qq.trim()) { toast('请输入QQ号', 'error'); return; }
    try {
      await apiPost('/users', { qq: qq.trim(), role: String(role) });
      toast('添加成功');
      setQq('');
      load();
    } catch {
      toast('添加失败', 'error');
    }
  };

  const deleteUser = (targetQq: string) => {
    setConfirmMsg(`确定移除用户 ${targetQq}？`);
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/users/${targetQq}`);
        toast('已移除');
        load();
      } catch {
        toast('移除失败', 'error');
      }
      setConfirmAction(null);
    });
  };

  return (
    <div>
      <div className="card">
        <h2><IconPlus size={16} /> 添加用户</h2>
        <div className="form-row">
          <div className="form-group">
            <label>QQ 号</label>
            <input type="text" value={qq} onChange={e => setQq(e.target.value)} placeholder="输入 QQ 号" />
          </div>
          <div className="form-group">
            <label>角色</label>
            <select value={role} onChange={e => setRole(parseInt(e.target.value) as UserRole)}>
              <option value={1}>审核员</option>
              <option value={2}>管理员</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={addUser}><IconPlus size={15} /> 添加用户</button>
        </div>
      </div>

      <div className="card">
        <h2><IconUsers size={16} /> 用户列表 <span className="card-count">共 {users.length} 人</span></h2>
        {loading ? (
          <div>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-row" style={{gridTemplateColumns:'40px 120px 80px 60px'}}>
                <div className="skeleton" /><div className="skeleton" />
                <div className="skeleton" /><div className="skeleton" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconUser size={48} /></div>
            <p>暂无用户</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>ID</th><th>QQ</th><th>角色</th><th>操作</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{color:'var(--text-muted)',fontSize:12}}>#{u.id}</td>
                    <td style={{fontWeight:500}}>{h(u.qq)}</td>
                    <td>
                      <span className={`badge ${u.role >= 2 ? 'badge-admin' : 'badge-reviewer'}`}>
                        <IconShield size={11} /> {u.role >= 2 ? '管理员' : '审核员'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-danger btn-xs" onClick={() => deleteUser(u.qq)}><IconTrash size={12} /> 移除</button>
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
