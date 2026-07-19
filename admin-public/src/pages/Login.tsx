import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { HEALTH_CHECK_URL } from '../config';

type Phase = 'idle' | 'checking' | 'denied' | 'error' | 'retrying';

// 错误码到用户友好提示的映射
const ERROR_MESSAGES: Record<string, { title: string; desc: string; retryable: boolean }> = {
  access_denied: {
    title: '访问被拒绝',
    desc: '您的 QQ 号没有管理员或审核员权限。<br />如需访问请联系管理员添加。',
    retryable: false,
  },
  banned: {
    title: '账号已被封禁',
    desc: '您的账号已被管理员封禁，无法登录。',
    retryable: false,
  },
  // frp 隧道瞬断导致 token 交换失败，可重试
  token_exchange_failed: {
    title: '登录暂时失败',
    desc: '网络通道（frp）瞬断导致授权令牌交换失败。<br />请点击下方按钮重新登录。',
    retryable: true,
  },
  // code 已被使用或过期（通常是刷新回调页导致），需重新登录
  invalid_grant: {
    title: '授权码已失效',
    desc: '授权码已被使用或过期（可能是页面刷新导致）。<br />请重新发起登录。',
    retryable: true,
  },
  // state 在服务器端已过期/丢失（浏览器缓存了旧登录链接）
  state_expired: {
    title: '登录状态已过期',
    desc: '登录状态已过期或丢失，请重新登录。',
    retryable: true,
  },
  missing_code: {
    title: '授权码缺失',
    desc: '回调未收到授权码（可能是网络代理截断）。<br />请重新登录。',
    retryable: true,
  },
  no_access_token: {
    title: '登录异常',
    desc: '服务器未返回访问令牌，请重试。',
    retryable: true,
  },
  userinfo_failed: {
    title: '获取用户信息失败',
    desc: '已成功授权但拉取用户信息失败（网络波动）。<br />请重新登录，已授权的状态会被复用。',
    retryable: true,
  },
  network_error: {
    title: '网络错误',
    desc: '无法连接到授权服务器，请检查网络后重试。',
    retryable: true,
  },
};

export function LoginPage() {
  const { login, handleCallback } = useAuth();
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [errorCode, setErrorCode] = useState<string>('');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasToken = params.get('token');
    const hasQq = params.get('qq');
    const error = params.get('error');
    const errorMsgParam = params.get('error_msg') || '';

    if (error) {
      // 后端重定向回来的错误，根据错误码显示对应提示
      const info = ERROR_MESSAGES[error] || {
        title: '登录失败',
        desc: '未知错误，请重试。',
        retryable: true,
      };
      setErrorCode(error);
      setErrorMsg(errorMsgParam || info.desc);
      setPhase(info.retryable ? 'error' : 'denied');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (hasToken || hasQq) {
      setPhase('checking');
      const ok = handleCallback();
      if (!ok) {
        // 回调参数无效（token/qq 缺失或格式错误），可能是 frp 重定向丢失了部分参数
        setErrorCode('invalid_callback');
        setErrorMsg('回调参数不完整或无效，可能是网络通道（frp）丢包导致。请重新登录。');
        setPhase('error');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    fetch(HEALTH_CHECK_URL, { mode: 'no-cors' })
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, [handleCallback]);

  // 重新登录：清掉 URL 参数后跳转到后端 /oauth/login
  const retryLogin = () => {
    setPhase('retrying');
    login();
  };

  // 首次登录按钮：防止 frp 延迟期间用户重复点击
  const [loggingIn, setLoggingIn] = useState(false);
  const startLogin = () => {
    if (loggingIn) return;
    setLoggingIn(true);
    login();
    // 5 秒后恢复按钮（兜底，正常情况下页面已跳走）
    setTimeout(() => setLoggingIn(false), 5000);
  };

  if (phase === 'checking' || phase === 'retrying') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo"><Logo /></div>
          <h1 className="login-title">Memories 校园墙</h1>
          <p className="login-desc">{phase === 'retrying' ? '正在重新发起登录...' : '正在验证身份...'}</p>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (phase === 'denied') {
    const deniedInfo = errorCode ? ERROR_MESSAGES[errorCode] : null;
    const deniedTitle = deniedInfo?.title || '访问被拒绝';
    const deniedDesc = deniedInfo?.desc || '您的 QQ 号没有管理员或审核员权限。<br />如需访问请联系管理员添加。';
    return (
      <div className="login-page">
        <div className="login-card card-denied">
          <div className="login-icon denied">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="login-title" style={{color:'#f87171'}}>{deniedTitle}</h1>
          <p className="login-desc" dangerouslySetInnerHTML={{ __html: deniedDesc }} />
          <button className="btn primary" onClick={login}>重新登录</button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="login-page">
        <div className="login-card card-denied">
          <div className="login-icon denied">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h1 className="login-title" style={{color:'#f59e0b'}}>登录遇到问题</h1>
          <p className="login-desc" dangerouslySetInnerHTML={{ __html: errorMsg || '登录过程中遇到问题，请重试。' }} />
          <button className="btn primary" onClick={retryLogin}>重新登录</button>
          <p className="login-desc" style={{ marginTop: '12px', fontSize: '12px', opacity: 0.7 }}>
            提示：若反复失败，可尝试清除浏览器缓存或使用无痕模式。
          </p>
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
        <button className="btn primary login-btn" onClick={startLogin} disabled={loggingIn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          {loggingIn ? '正在跳转...' : '校园墙 OAuth 登录'}
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
