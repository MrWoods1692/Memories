import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Images } from './pages/Images';
import { Users } from './pages/Users';
import { Bans } from './pages/Bans';
import { Settings } from './pages/Settings';
import { useToast, ToastContainer } from './components/Toast';
import { IconDashboard, IconImage, IconUsers, IconBan, IconSettings } from './components/Icons';
import { API_BASE } from './api';
import './App.css';

type TabName = 'dashboard' | 'images' | 'users' | 'bans' | 'settings';

const tabs: { key: TabName; label: string; Icon: React.ComponentType<{size?:number}> }[] = [
  { key: 'dashboard', label: '仪表盘', Icon: IconDashboard },
  { key: 'images', label: '图片管理', Icon: IconImage },
  { key: 'users', label: '用户管理', Icon: IconUsers },
  { key: 'bans', label: '封禁管理', Icon: IconBan },
  { key: 'settings', label: '系统设置', Icon: IconSettings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const { toasts, toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  const switchTab = (tab: TabName) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setAnimKey(k => k + 1);
    }
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard toast={toast} />;
      case 'images':
        return <Images toast={toast} refreshKey={refreshKey} />;
      case 'users':
        return <Users toast={toast} />;
      case 'bans':
        return <Bans toast={toast} />;
      case 'settings':
        return <Settings toast={toast} />;
    }
  };

  return (
    <>
      <div className="header">
        <div className="header-brand">
          <svg className="header-logo" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="lg" x1="4" y1="4" x2="20" y2="20"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#6366f1"/></linearGradient>
            </defs>
            <rect x="3" y="5" width="18" height="14" rx="3" stroke="url(#lg)" strokeWidth="1.8"/>
            <circle cx="8.5" cy="10" r="1.8" stroke="url(#lg)" strokeWidth="1.2"/>
            <path d="M3 16.5 8 13l4 3 4.5-4 4.5 3" stroke="url(#lg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <h1>Memories</h1>
        </div>
        <div className="info">{API_BASE}</div>
      </div>

      <div className="tabs">
        {tabs.map(({ key, label, Icon }) => (
          <div
            key={key}
            className={`tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => switchTab(key)}
          >
            <Icon size={16} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="content" key={animKey} style={{ animation: 'pageIn 0.25s ease' }}>
        {renderPanel()}
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
