import { useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { ImagesPage } from './pages/Images';
import { UsersPage } from './pages/Users';
import { BansPage } from './pages/Bans';
import { SettingsPage } from './pages/Settings';
import { useToast, ToastContainer } from './components/Toast';
import { IconHome, IconImage, IconUsers, IconBan, IconSettings, IconLogout, IconSun, IconMoon, IconArrowLeft } from './components/Icons';
import { API_BASE_URL } from './config';
import './App.css';

type Tab = 'home' | 'images' | 'users' | 'bans' | 'settings';

const allTabs: { key: Tab; label: string; Icon: React.ComponentType<{size?:number}>; roles: (1|2)[] }[] = [
  { key: 'home', label: '服务状态', Icon: IconHome, roles: [1, 2] },
  { key: 'images', label: '图片管理', Icon: IconImage, roles: [1, 2] },
  { key: 'users', label: '用户管理', Icon: IconUsers, roles: [2] },
  { key: 'bans', label: '封禁管理', Icon: IconBan, roles: [1, 2] },
  { key: 'settings', label: '网站配置', Icon: IconSettings, roles: [2] },
];

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppShell() {
  const { loading, user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<Tab>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { list, toast } = useToast();

  const visibleTabs = useMemo(
    () => allTabs.filter(t => t.roles.includes(user?.role ?? 1)),
    [user?.role],
  );

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
    // 审核员不能访问管理员专属页面
    const canAccess = visibleTabs.some(t => t.key === tab);
    const activeTab = canAccess ? tab : 'home';
    switch (activeTab) {
      case 'home': return <DashboardPage toast={toast} />;
      case 'images': return <ImagesPage toast={toast} />;
      case 'users': return <UsersPage toast={toast} />;
      case 'bans': return <BansPage toast={toast} />;
      case 'settings': return <SettingsPage toast={toast} />;
    }
  };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ---- 侧边栏 ---- */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <LogoSmall />
          {!sidebarCollapsed && <h1 className="sidebar-title">Memories</h1>}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          >
            <IconArrowLeft size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleTabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`sidebar-item ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span>{label}</span>}
              {tab === key && <span className="sidebar-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div className="sidebar-user">
              <span className={`badge ${user.role === 2 ? 'b-admin' : 'b-reviewer'}`}>{roleLabel}</span>
              <span className="sidebar-qq">QQ: {user.qq}</span>
            </div>
          )}
          <button className="sidebar-theme-btn" onClick={toggle} title={theme === 'dark' ? '亮色模式' : '暗色模式'}>
            {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <button className="sidebar-logout" onClick={logout} title="退出登录">
            <IconLogout size={16} />
          </button>
        </div>
      </aside>

      {/* ---- 主区域 ---- */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-page-title">
              {visibleTabs.find(t => t.key === tab)?.label || ''}
            </span>
          </div>
          <div className="topbar-right">
            <span className="api-url-badge">{API_BASE_URL}</span>
          </div>
        </header>

        <main className="content">{renderPage()}</main>
      </div>

      {/* ---- 移动端底部导航 ---- */}
      <nav className="mobile-nav">
        {visibleTabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            className={`mobile-nav-item ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <ToastContainer list={list} />
    </div>
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
