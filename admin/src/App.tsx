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
          <svg className="header-logo" width="24" height="24" viewBox="0 0 108 108" fill="none">
            <path fill="#1D6E5A" d="M18,16h72a16,16 0,0 1,16 16v44a16,16 0,0 1,-16 16H18a16,16 0,0 1,-16 -16V32a16,16 0,0 1,16 -16z"/>
            <path fill="#53C49E" fillOpacity="0.42" d="M8,76c18,-26 40,-36 92,-49v49a10,10 0,0 1,-10 10H18a10,10 0,0 1,-10 -10z"/>
            <path fill="#F8F7F2" d="M24,72l18,-22 14,15 9,-11 19,18z"/>
            <circle cx="72" cy="34" r="9" fill="#E9C46A"/>
            <path fill="#FFFFFF" fillOpacity="0.36" d="M22,24h42a5,5 0,0 1,0 10H22a5,5 0,0 1,0 -10z"/>
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
