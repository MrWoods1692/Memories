import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ImagesPage } from './pages/Images';
import { UsersPage } from './pages/Users';
import { BansPage } from './pages/Bans';
import { SettingsPage } from './pages/Settings';
import { useToast, ToastContainer } from './components/Toast';
import { IconHome, IconImage, IconUsers, IconBan, IconSettings, IconLogout } from './components/Icons';
import { API_BASE_URL } from './config';
import './App.css';

type Tab = 'home' | 'images' | 'users' | 'bans' | 'settings';

const tabs: { key: Tab; label: string; Icon: React.ComponentType<{size?:number}> }[] = [
  { key: 'home', label: '服务状态', Icon: IconHome },
  { key: 'images', label: '图片管理', Icon: IconImage },
  { key: 'users', label: '用户管理', Icon: IconUsers },
  { key: 'bans', label: '封禁管理', Icon: IconBan },
  { key: 'settings', label: '网站配置', Icon: IconSettings },
];

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { loading, user, devMode, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const { list, toast } = useToast();

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo"><LogoSmall /></div>
          <h1 className="login-title">Memories</h1>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const roleLabel = user.role === 2 ? '管理员' : '审核员';

  const renderPage = () => {
    switch (tab) {
      case 'home': return <DashboardPage toast={toast} />;
      case 'images': return <ImagesPage toast={toast} />;
      case 'users': return <UsersPage toast={toast} />;
      case 'bans': return <BansPage toast={toast} />;
      case 'settings': return <SettingsPage toast={toast} />;
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <LogoSmall />
          <h1>Memories</h1>
        </div>
        <div className="header-right">
          <span className="user-info">
            <span className={`badge ${user.role === 2 ? 'b-admin' : 'b-reviewer'}`}>{roleLabel}</span>
            <span className="user-qq">QQ: {user.qq}</span>
          </span>
          <span className="api-url">{API_BASE_URL}</span>
          {devMode && <span className="badge b-dev">DEV</span>}
          <button className="btn ghost sm" onClick={logout} title="退出"><IconLogout size={14} /></button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="content">{renderPage()}</main>

      <ToastContainer list={list} />
    </>
  );
}

function LogoSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 108 108" fill="none">
      <path fill="#1D6E5A" d="M18,16h72a16,16 0,0 1,16 16v44a16,16 0,0 1,-16 16H18a16,16 0,0 1,-16 -16V32a16,16 0,0 1,16 -16z"/>
      <path fill="#53C49E" fillOpacity="0.42" d="M8,76c18,-26 40,-36 92,-49v49a10,10 0,0 1,-10 10H18a10,10 0,0 1,-10 -10z"/>
      <path fill="#F8F7F2" d="M24,72l18,-22 14,15 9,-11 19,18z"/>
      <circle cx="72" cy="34" r="9" fill="#E9C46A"/>
      <path fill="#FFFFFF" fillOpacity="0.36" d="M22,24h42a5,5 0,0 1,0 10H22a5,5 0,0 1,0 -10z"/>
    </svg>
  );
}
