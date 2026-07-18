import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { IconSettings, IconRefresh } from '../components/Icons';
import type { SiteConfig } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

export function SettingsPage({ toast }: Props) {
  const [cfg, setCfg] = useState<SiteConfig>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const c = await apiGet<SiteConfig>('/config');
      setCfg(c || {});
    } catch { toast('加载失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (k: string, v: string) => {
    try { await apiPost('/config', { k, v }); }
    catch { toast('保存失败', 'error'); }
  };

  const saveAll = async () => {
    await save('platform_name', cfg.platform_name || '');
    await save('platform_logo', cfg.platform_logo || '');
    await save('auto_cleanup_rejected', cfg.auto_cleanup_rejected || 'true');
    await save('admin_token', cfg.admin_token || '');
    toast('保存成功');
  };

  const set = (k: keyof SiteConfig, v: string) => setCfg(p => ({ ...p, [k]: v }));

  if (loading) return <div className="skeleton" style={{height:300}} />;

  return (
    <div className="settings-grid">
      <div className="card">
        <h2><IconSettings size={16} /> 网站配置</h2>
        <div className="fg">
          <label>平台名称</label>
          <input value={cfg.platform_name || ''} onChange={e => set('platform_name', e.target.value)} placeholder="Memories" />
        </div>
        <div className="fg">
          <label>平台 Logo URL</label>
          <input value={cfg.platform_logo || ''} onChange={e => set('platform_logo', e.target.value)} placeholder="https://..." />
        </div>
        <div className="fg">
          <label>管理员令牌（可选）</label>
          <input type="password" value={cfg.admin_token || ''} onChange={e => set('admin_token', e.target.value)} placeholder="留空则使用 QQ 角色鉴权" />
        </div>
        <div className="fg" style={{display:'flex',alignItems:'center',gap:10,flexDirection:'row'}}>
          <input type="checkbox" checked={cfg.auto_cleanup_rejected !== 'false'}
            onChange={e => set('auto_cleanup_rejected', e.target.checked ? 'true' : 'false')}
            style={{width:16,height:16}} />
          <label style={{margin:0,cursor:'pointer'}}>拒绝稿件时自动删除</label>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={saveAll}><IconSettings size={14} /> 保存配置</button>
          <button className="btn ghost sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
        </div>
      </div>
    </div>
  );
}
