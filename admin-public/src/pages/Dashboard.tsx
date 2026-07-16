import { useEffect, useState } from 'react';
import { apiGet } from '../api';
import { IconImage, IconRefresh, IconBattery, IconCpu, IconMemory, IconDisk } from '../components/Icons';
import type { ServerStatus, ImageItem, ResourceInfo, MemoryDiskInfo } from '../types';

interface Props { toast: (m: string, t?: 'success' | 'error') => void; }

/** 格式化字节为可读大小 */
function fmtBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/** 根据百分比返回颜色类名 */
function pctClass(pct: number): 'ok' | 'warn' | 'danger' {
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warn';
  return 'ok';
}

/** 进度条组件 */
function ProgressBar({ percent, showLabel }: { percent: number; showLabel?: boolean }) {
  const cls = pctClass(percent);
  return (
    <div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      {showLabel && <div className="progress-detail"><span>{cls === 'danger' ? '高负载' : cls === 'warn' ? '中等' : '正常'}</span><span>{percent.toFixed(1)}%</span></div>}
    </div>
  );
}

/** UPS 状态卡片 */
function BatteryCard({ battery }: { battery: ResourceInfo }) {
  const pct = battery.percent;
  const cls = pct <= 20 ? 'danger' : pct <= 50 ? 'warn' : 'ok';
  return (
    <div className="resource-card">
      <div className="resource-header">
        <div className="resource-title"><IconBattery size={18} /> UPS</div>
        <span className={`resource-value ${cls}`}>{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div className="progress-detail">
        <span>{cls === 'danger' ? '电量低' : cls === 'warn' ? '中等电量' : '电量充足'}</span>
        <span>{battery.label || ''}</span>
      </div>
    </div>
  );
}

/** CPU 状态卡片（可展开显示各核心频率） */
function CpuCard({ cpu }: { cpu: ResourceInfo }) {
  const [expanded, setExpanded] = useState(false);
  const cls = pctClass(cpu.percent);
  const cores = cpu.cores || 0;
  const freqEntries = cpu.frequencies ? Object.entries(cpu.frequencies) : [];

  return (
    <div className={`resource-card cpu-card ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)} style={{cursor:'pointer'}}>
      <div className="resource-header">
        <div className="resource-title"><IconCpu size={18} /> CPU</div>
        <span className={`resource-value ${cls}`}>{cpu.percent.toFixed(1)}%</span>
      </div>
      <div className="cpu-summary">
        <span>{cores} 核</span>
        <span className="cpu-expand-hint">{expanded ? '▲ 收起' : '▼ 展开频率'}</span>
      </div>
      {expanded && freqEntries.length > 0 && (
        <div className="cpu-cores">
          {freqEntries.map(([key, f]) => {
            const mhz = f.cur_khz ? (f.cur_khz / 1000).toFixed(0) : '-';
            return (
              <div key={key} className="cpu-core-item">
                <span className="cpu-core-name">{key.replace('core', 'Core ')}</span>
                <span className="cpu-core-freq">{mhz} MHz</span>
                <span className="cpu-core-gov">{f.governor || ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 内存状态卡片 */
function MemoryCard({ memory }: { memory: MemoryDiskInfo }) {
  const cls = pctClass(memory.percent);
  return (
    <div className="resource-card">
      <div className="resource-header">
        <div className="resource-title"><IconMemory size={18} /> 内存</div>
        <span className={`resource-value ${cls}`}>{memory.percent.toFixed(1)}%</span>
      </div>
      <ProgressBar percent={memory.percent} />
      <div className="progress-detail">
        <span>已用 {fmtBytes(memory.used)}</span>
        <span>共 {fmtBytes(memory.total)}</span>
      </div>
    </div>
  );
}

/** 硬盘状态卡片 */
function DiskCard({ disk }: { disk: MemoryDiskInfo }) {
  const cls = pctClass(disk.percent);
  return (
    <div className="resource-card">
      <div className="resource-header">
        <div className="resource-title"><IconDisk size={18} /> 硬盘</div>
        <span className={`resource-value ${cls}`}>{disk.percent.toFixed(1)}%</span>
      </div>
      <ProgressBar percent={disk.percent} />
      <div className="progress-detail">
        <span>已用 {fmtBytes(disk.used)}</span>
        <span>共 {fmtBytes(disk.total)}</span>
      </div>
    </div>
  );
}

export function DashboardPage({ toast: _toast }: Props) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [recent, setRecent] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, imgs, sysInfo] = await Promise.all([
        apiGet<ServerStatus>('/status'),
        apiGet<ImageItem[]>('/images'),
        apiGet<any>('/sysinfo').catch(() => null),
      ]);
      // 将 /sysinfo 数据合并到 status 中
      if (sysInfo) {
        // 电池/UPS
        if (sysInfo.battery && typeof sysInfo.battery.level === 'number') {
          s.battery = {
            percent: sysInfo.battery.level,
            label: sysInfo.battery.power_source || sysInfo.battery.status || '',
          };
        }
        // CPU（用 load avg1 / cores 估算使用率，同时取核心频率）
        if (sysInfo.cpu && sysInfo.cpu.load && typeof sysInfo.cpu.cores === 'number') {
          const cores = sysInfo.cpu.cores;
          const load1 = sysInfo.cpu.load.avg1 || 0;
          s.cpu = {
            percent: Math.min(100, (load1 / cores) * 100),
            cores,
            frequencies: sysInfo.cpu.frequencies || {},
          };
        }
        // 内存
        if (sysInfo.memory && sysInfo.memory.sys_total > 0) {
          const total = sysInfo.memory.sys_total;
          const available = sysInfo.memory.sys_available || 0;
          const used = total - available;
          s.memory = {
            used,
            total,
            percent: total > 0 ? (used / total) * 100 : 0,
          };
        }
        // 硬盘
        if (sysInfo.disk && sysInfo.disk.total > 0) {
          const total = sysInfo.disk.total;
          const used = sysInfo.disk.used || 0;
          s.disk = {
            used,
            total,
            percent: (used / total) * 100,
          };
        }
      }
      setStatus(s);
      setRecent(Array.isArray(imgs) ? imgs.slice(0, 6) : []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const iv = setInterval(load, 5000); return () => clearInterval(iv); }, []);

  const s: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const b: Record<number, string> = { 0: 'b0', 1: 'b1', 2: 'b2' };

  if (loading) return <div className="skeleton" style={{height:300}} />;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><IconImage size={20} /></div>
          <div><div className="num">{status?.image_count ?? 0}</div><div className="label">图片总数</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <div><div className="num" style={{fontSize:18}}><span className="dot green" /> 运行中</div><div className="label">服务状态</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>
          </div>
          <div><div className="num">{uptime(status?.uptime || 0)}</div><div className="label">运行时间</div></div>
        </div>
      </div>

      {/* ---- 系统资源状态 ---- */}
      {status && (status.battery || status.cpu || status.memory || status.disk) && (
        <div className="resource-grid">
          {status.battery && <BatteryCard battery={status.battery} />}
          {status.cpu && <CpuCard cpu={status.cpu} />}
          {status.memory && <MemoryCard memory={status.memory} />}
          {status.disk && <DiskCard disk={status.disk} />}
        </div>
      )}

      <div className="card">
        <h2><IconImage size={16} /> 最近图片</h2>
        {recent.length === 0 ? <div className="empty">暂无数据</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr></thead>
              <tbody>
                {recent.map(i => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent)',fontWeight:600}}>#{i.id}</td>
                    <td className="url" title={i.url}>{i.url}</td>
                    <td><span className={`badge ${b[i.status]}`}>{s[i.status]}</span></td>
                    <td>{fmt(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <button className="btn ghost sm" onClick={load}><IconRefresh size={14} /> 刷新</button>
      </div>
    </div>
  );
}

function uptime(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h/24)}天 ${h%24}时`;
  if (h > 0) return `${h}时 ${m}分`;
  return `${m}分`;
}
function fmt(ts?: string) { return ts ? new Date(ts).toLocaleString('zh-CN') : '-'; }
