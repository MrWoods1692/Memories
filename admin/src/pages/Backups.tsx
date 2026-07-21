import { useEffect, useState, useCallback } from 'react';
import { apiGet, apiPost } from '../api';
import { IconCloudUpload, IconRefresh, IconDownload, IconHardDrive } from '../components/Icons';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface BackupItem {
  name: string;
  path: string;
  type: 'manual' | 'rolling';
  size: number;
  modified: number;
  label: string;
}

interface BackupsData {
  backups: BackupItem[];
  total: number;
  local_size: number;
  local_mtime: number;
}

interface BackupsProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return v.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatTime(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Backups({ toast }: BackupsProps) {
  const [data, setData] = useState<BackupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupItem | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<BackupsData>('/webdav/backups');
      setData(result);
    } catch {
      // WebDAV 未配置或获取失败
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const result = await apiPost<{ success: boolean; path: string; size: number; message: string }>('/webdav/backup');
      if (result.success) {
        toast(`备份成功 (${formatSize(result.size)})`, 'success');
        load();
      } else {
        toast(result.message || '备份失败', 'error');
      }
    } catch (e) {
      toast('备份失败，请检查 WebDAV 配置', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (item: BackupItem) => {
    setConfirmRestore(null);
    setRestoring(item.path);
    try {
      const result = await apiPost<{ success: boolean; images: number; message: string }>('/webdav/restore', { path: item.path });
      if (result.success) {
        toast(`恢复成功，共 ${result.images} 条记录`, 'success');
      } else {
        toast(result.message || '恢复失败', 'error');
      }
    } catch (e) {
      toast('恢复失败', 'error');
    } finally {
      setRestoring(null);
    }
  };

  // 判断 WebDAV 是否已配置（通过尝试加载数据）
  const notConfigured = !loading && (!data || (data.backups && data.backups.length === 0 && data.local_size === 0));

  if (loading) {
    return (
      <div className="settings-grid">
        <div className="card">
          <div className="skeleton" style={{ width: '60%', height: 18, marginBottom: 18 }} />
          <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '80%', height: 14 }} />
        </div>
      </div>
    );
  }

  const manualBackups = (data?.backups || []).filter(b => b.type === 'manual');
  const rollingBackups = (data?.backups || []).filter(b => b.type === 'rolling');

  return (
    <div className="backups-page">
      {/* 操作栏 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>数据库备份</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              本地数据库: {data?.local_size ? formatSize(data.local_size) : '-'}
              {data?.local_mtime ? ` · ${formatTime(data.local_mtime)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={load} title="刷新列表">
              <IconRefresh size={14} /> 刷新
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBackup}
              disabled={backingUp || notConfigured}
              title={notConfigured ? '请先在系统设置中配置 WebDAV' : '手动备份当前数据库'}
            >
              <IconCloudUpload size={14} />
              {backingUp ? '备份中...' : '手动备份'}
            </button>
          </div>
        </div>
      </div>

      {notConfigured && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <IconHardDrive size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>尚未配置 WebDAV 备份</p>
          <p style={{ fontSize: 13 }}>请前往「系统设置」配置 WebDAV 地址、用户名和密码</p>
        </div>
      )}

      {/* 手动备份列表 */}
      {manualBackups.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            📦 手动备份
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>
              ({manualBackups.length} 份，不会被自动删除)
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {manualBackups.map(item => (
              <BackupRow
                key={item.path}
                item={item}
                restoring={restoring}
                onRestore={() => setConfirmRestore(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 滚动备份列表 */}
      {rollingBackups.length > 0 && (
        <div className="card">
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔄 自动滚动备份
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-muted)' }}>
              (每 12h / 24h 自动覆盖)
            </span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rollingBackups.map(item => (
              <BackupRow
                key={item.path}
                item={item}
                restoring={restoring}
                onRestore={() => setConfirmRestore(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 恢复确认对话框 */}
      {confirmRestore && (
        <ConfirmDialog
          message={`确定要从「${confirmRestore.label}」恢复数据库吗？\n\n当前数据将被覆盖，此操作不可撤销。`}
          onConfirm={() => handleRestore(confirmRestore)}
          onCancel={() => setConfirmRestore(null)}
        />
      )}
    </div>
  );
}

function BackupRow({ item, restoring, onRestore }: {
  item: BackupItem;
  restoring: string | null;
  onRestore: () => void;
}) {
  const isRolling = item.type === 'rolling';
  const isRestoring = restoring === item.path;

  return (
    <div className={`backup-row ${isRolling ? 'backup-rolling' : ''}`}>
      <div className="backup-info">
        <span className="backup-label">{item.label}</span>
        <span className="backup-meta">
          <span className={`badge ${isRolling ? 'badge-info' : 'badge-success'}`}>
            {isRolling ? '自动' : '手动'}
          </span>
          <span>{formatSize(item.size)}</span>
          <span>{formatTime(item.modified)}</span>
        </span>
      </div>
      <button
        className="btn btn-sm btn-outline"
        onClick={onRestore}
        disabled={isRestoring}
        title="从此备份恢复"
      >
        <IconDownload size={13} />
        {isRestoring ? '恢复中...' : '恢复'}
      </button>
    </div>
  );
}
