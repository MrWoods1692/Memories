import { useState, useCallback } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Images } from './pages/Images';
import { Users } from './pages/Users';
import { Bans } from './pages/Bans';
import { Settings } from './pages/Settings';
import { useToast, ToastContainer } from './components/Toast';
import { API_BASE } from './api';
import './App.css';

type TabName = 'dashboard' | 'images' | 'users' | 'bans' | 'settings';

const tabs: { key: TabName; label: string; icon: string }[] = [
  { key: 'dashboard', label: '仪表盘', icon: '📊' },
  { key: 'images', label: '图片管理', icon: '🖼️' },
  { key: 'users', label: '用户管理', icon: '👥' },
  { key: 'bans', label: '封禁管理', icon: '🚫' },
  { key: 'settings', label: '系统设置', icon: '⚙️' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('dashboard');
  const { toasts, toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
    toast('已刷新');
  }, [toast]);

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
        <h1>📋 Memories 管理面板</h1>
        <div className="info">LAN · API: {API_BASE}</div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <div
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon} {t.label}
          </div>
        ))}
      </div>

      <div className="content">
        {renderPanel()}
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
