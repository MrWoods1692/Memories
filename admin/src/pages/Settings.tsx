import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { IconSettings, IconCloud, IconKey, IconLink, IconCloudUpload } from '../components/Icons';
import type { AppConfig, FrpcStatus } from '../types';

interface SettingsProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export function Settings({ toast }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig>({});
  const [frpcStatus, setFrpcStatus] = useState<FrpcStatus>({ configured: false });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [cfg, frpc] = await Promise.all([
        apiGet<string>('/config'),
        apiGet<FrpcStatus>('/frpc/status'),
      ]);
      try { setConfig(JSON.parse(cfg as unknown as string)); } catch { /* ignore */ }
      setFrpcStatus(frpc);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveConfig = async (k: string, v: string) => {
    try {
      await apiPost('/config', { k, v });
    } catch {
      toast('保存失败', 'error');
    }
  };

  const saveServerConfig = async () => {
    await saveConfig('server_port', config.server_port || '8080');
    await saveConfig('admin_port', config.admin_port || '8081');
    await saveConfig('platform_name', config.platform_name || '');
    await saveConfig('platform_logo', config.platform_logo || '');
    toast('保存成功');
  };

  const saveWebdavConfig = async () => {
    await saveConfig('webdav_url', config.webdav_url || '');
    await saveConfig('webdav_user', config.webdav_user || '');
    await saveConfig('webdav_pass', config.webdav_pass || '');
    toast('保存成功');
  };

  const saveOauthConfig = async () => {
    await saveConfig('oauth_prefix', config.oauth_prefix || '');
    await saveConfig('oauth_client_id', config.oauth_client_id || '');
    await saveConfig('oauth_client_secret', config.oauth_client_secret || '');
    await saveConfig('oauth_redirect_uri', config.oauth_redirect_uri || '');
    toast('保存成功');
  };

  const saveFrpcConfig = async () => {
    await apiPost('/frpc/config', { frpc_config: config.frpc_config || '' });
    toast('保存成功');
    load();
  };

  const triggerBackup = async () => {
    try {
      const r = await apiPost('/backup');
      toast(r as string);
    } catch {
      toast('备份失败', 'error');
    }
  };

  const updateConfig = (key: keyof AppConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="settings-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="card">
            <div className="skeleton" style={{width:'60%',height:18,marginBottom:18}} />
            <div className="skeleton" style={{width:'100%',height:14,marginBottom:8}} />
            <div className="skeleton" style={{width:'80%',height:14,marginBottom:8}} />
            <div className="skeleton" style={{width:'50%',height:14}} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="settings-grid">
      {/* 服务器配置 */}
      <div className="card">
        <h2><IconSettings size={16} /> 服务器配置</h2>
        <div className="form-row">
          <div className="form-group">
            <label>API 服务端口 <span style={{color:'var(--text-muted)',fontWeight:400}}>(重启生效)</span></label>
            <input type="number" value={config.server_port || '8080'} onChange={e => updateConfig('server_port', e.target.value)} />
          </div>
          <div className="form-group">
            <label>管理面板端口 <span style={{color:'var(--text-muted)',fontWeight:400}}>(重启生效)</span></label>
            <input type="number" value={config.admin_port || '8081'} onChange={e => updateConfig('admin_port', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>平台名称</label>
            <input type="text" value={config.platform_name || ''} onChange={e => updateConfig('platform_name', e.target.value)} placeholder="Memories" />
          </div>
          <div className="form-group">
            <label>平台 Logo URL</label>
            <input type="text" value={config.platform_logo || ''} onChange={e => updateConfig('platform_logo', e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveServerConfig}><IconSettings size={14} /> 保存服务器配置</button>
        </div>
      </div>

      {/* WebDAV 备份配置 */}
      <div className="card">
        <h2><IconCloud size={16} /> WebDAV 备份配置</h2>
        <div className="form-group">
          <label>WebDAV URL</label>
          <input type="text" value={config.webdav_url || ''} onChange={e => updateConfig('webdav_url', e.target.value)} placeholder="https://webdav.example.com/backup" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>用户名</label>
            <input type="text" value={config.webdav_user || ''} onChange={e => updateConfig('webdav_user', e.target.value)} />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input type="password" value={config.webdav_pass || ''} onChange={e => updateConfig('webdav_pass', e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveWebdavConfig}><IconCloud size={14} /> 保存 WebDAV</button>
          <button className="btn btn-success" onClick={triggerBackup}><IconCloudUpload size={14} /> 测试备份</button>
        </div>
      </div>

      {/* OAuth 配置 */}
      <div className="card">
        <h2><IconKey size={16} /> OAuth 配置</h2>
        <div className="form-group">
          <label>OAuth 前缀 (prefix)</label>
          <input type="text" value={config.oauth_prefix || ''} onChange={e => updateConfig('oauth_prefix', e.target.value)} placeholder="your-campus" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Client ID</label>
            <input type="text" value={config.oauth_client_id || ''} onChange={e => updateConfig('oauth_client_id', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Client Secret</label>
            <input type="password" value={config.oauth_client_secret || ''} onChange={e => updateConfig('oauth_client_secret', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Redirect URI</label>
          <input type="text" value={config.oauth_redirect_uri || ''} onChange={e => updateConfig('oauth_redirect_uri', e.target.value)} placeholder="https://..." />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveOauthConfig}><IconKey size={14} /> 保存 OAuth</button>
        </div>
      </div>

      {/* FRPC 内网穿透 */}
      <div className="card">
        <h2><IconLink size={16} /> FRPC 内网穿透</h2>
        <div className="form-group">
          <label>配置文件内容 (INI 格式)</label>
          <textarea
            rows={8} value={config.frpc_config || ''}
            onChange={e => updateConfig('frpc_config', e.target.value)}
            placeholder={'[common]\nserver_addr = example.com\nserver_port = 7000\ntoken = your_token\n\n[web]\ntype = tcp\nlocal_ip = 127.0.0.1\nlocal_port = 8080\nremote_port = 8080'}
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveFrpcConfig}><IconLink size={14} /> 保存 FRPC 配置</button>
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          <span className={`status-dot ${frpcStatus.configured ? 'on' : 'off'}`} />
          {frpcStatus.configured ? 'FRPC 已配置' : 'FRPC 未配置'}
        </div>
      </div>
    </div>
  );
}
