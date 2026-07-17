import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { HEALTH_CHECK_URL } from '../config';

export function LoginPage() {
  const { login, handleCallback } = useAuth();
  const [phase, setPhase] = useState<'idle' | 'checking' | 'denied'>('idle');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasToken = params.get('token');
    const hasQq = params.get('qq');
    const error = params.get('error');

    // 后端拒绝访问（管理面板但非管理员/审核员）
    if (error === 'access_denied') {
      setPhase('denied');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (hasToken || hasQq) {
      setPhase('checking');
      const ok = handleCallback();
      if (!ok) setPhase('denied');
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetch(HEALTH_CHECK_URL, { mode: 'no-cors' })
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, [handleCallback]);

  if (phase === 'checking') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo"><Logo /></div>
          <h1 className="login-title">Memories 校园墙</h1>
          <p className="login-desc">正在验证身份...</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="login-page">
        <div className="login-card card-denied">
          <div className="login-icon denied">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="login-title" style={{color:'#f87171'}}>访问被拒绝</h1>
          <p className="login-desc">您的 QQ 号没有管理员或审核员权限。<br />如需访问请联系管理员添加。</p>
          <button className="btn primary" onClick={login}>重新登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo"><Logo /></div>
        <h1 className="login-title">Memories</h1>
        <p className="login-sub">校园墙管理面板</p>
        <p className="login-desc">请使用校园墙 OAuth 授权登录<br />系统将自动验证您的管理员/审核员身份</p>
        <button className="btn primary login-btn" onClick={login}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          校园墙 OAuth 登录
        </button>
        <div className="login-footer">
          <div className={`login-status ${serverOnline === true ? 'on' : serverOnline === false ? 'off' : ''}`}>
            <span className={`dot ${serverOnline === true ? 'green' : serverOnline === false ? 'red' : ''}`} />
            {serverOnline === null ? '检测服务器...' : serverOnline ? '服务器在线' : '服务器离线'}
          </div>
          <div className="login-url">{HEALTH_CHECK_URL.replace('/health', '')}</div>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="56" height="56" viewBox="0 0 108 108" fill="none">
      <path fill="#1D6E5A" d="M18,16h72a16,16 0,0 1,16 16v44a16,16 0,0 1,-16 16H18a16,16 0,0 1,-16 -16V32a16,16 0,0 1,16 -16z"/>
      <path fill="#53C49E" fillOpacity="0.42" d="M8,76c18,-26 40,-36 92,-49v49a10,10 0,0 1,-10 10H18a10,10 0,0 1,-10 -10z"/>
      <path fill="#F8F7F2" d="M24,72l18,-22 14,15 9,-11 19,18z"/>
      <circle cx="72" cy="34" r="9" fill="#E9C46A"/>
      <path fill="#FFFFFF" fillOpacity="0.36" d="M22,24h42a5,5 0,0 1,0 10H22a5,5 0,0 1,0 -10z"/>
    </svg>
  );
}
