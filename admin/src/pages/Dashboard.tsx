import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api';
import { IconImage, IconCpu, IconStatusOn, IconCloudUpload, IconRefresh, IconServer, IconInbox, IconCheckCircle } from '../components/Icons';
import type { ServerStatus, ImageItem, AppConfig, SysInfo } from '../types';

interface DashboardProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function fmtUptime(elapsed: number): string {
  const hours = Math.floor(elapsed / 3600000);
  const mins = Math.floor((elapsed % 3600000) / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}天 ${hours % 24}小时`;
  }
  if (hours > 0) return `${hours}小时 ${mins}分`;
  if (mins > 0) return `${mins}分 ${secs}秒`;
  return `${secs}秒`;
}

export function Dashboard({ toast }: DashboardProps) {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [sysinfo, setSysinfo] = useState<SysInfo | null>(null);
  const [config, setConfig] = useState<AppConfig>({});
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [s, si, c, imgs] = await Promise.all([
        apiGet<ServerStatus>('/status'),
        apiGet<SysInfo>('/sysinfo'),
        apiGet<AppConfig>('/config'),
        apiGet<ImageItem[]>('/images'),
      ]);
      setStatus(s);
      setSysinfo(si);
      setConfig(c);
      setRecentImages(Array.isArray(imgs) ? imgs.slice(0, 8) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 1000);
    return () => clearInterval(iv);
  }, []);

  const triggerBackup = async () => {
    try {
      const r = await apiPost('/backup');
      toast(r as string);
    } catch {
      toast('备份失败', 'error');
    }
  };

  const statusLabels: Record<number, string> = { 0: '待审核', 1: '已通过', 2: '已拒绝' };
  const statusBadge: Record<number, string> = { 0: 'badge-0', 1: 'badge-1', 2: 'badge-2' };

  if (loading) {
    return (
      <div>
        <div className="stat-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{width:44,height:44,borderRadius:10}} />
              <div>
                <div className="skeleton" style={{width:60,height:24,marginBottom:6}} />
                <div className="skeleton" style={{width:40,height:12}} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2><IconImage size={16} /> 最近图片</h2>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton-row">
              <div className="skeleton" /><div className="skeleton" />
              <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const si = sysinfo;

  return (
    <div>
      {/* 概览统计 */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon images"><IconImage size={20} /></div>
          <div className="stat-info">
            <div className="num">{status?.image_count ?? 0}</div>
            <div className="label">图片总数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon port"><IconCpu size={20} /></div>
          <div className="stat-info">
            <div className="num">{config.server_port || '8080'}</div>
            <div className="label">API 端口</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon status"><IconStatusOn size={20} /></div>
          <div className="stat-info">
            <div className="num" style={{fontSize:20}}><span className="status-dot on" /> 运行中</div>
            <div className="label">服务状态</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon images"><IconInbox size={20} /></div>
          <div className="stat-info">
            <div className="num">{si ? fmtBytes(si.db_size) : '-'}</div>
            <div className="label">数据库大小</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon port"><IconServer size={20} /></div>
          <div className="stat-info">
            <div className="num">{si ? fmtUptime(si.uptime) : '-'}</div>
            <div className="label">运行时间</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon status"><IconCheckCircle size={20} /></div>
          <div className="stat-info">
            <div className="num" style={{fontSize:18}}>{si?.cpu.model || si?.cpu.arch || '-'}</div>
            <div className="label">{si ? `${si.cpu.cores} 核 · ${si.battery.device_model}` : 'CPU'}</div>
          </div>
        </div>
      </div>

      {/* 系统详情 */}
      {si && (
        <div className="sysinfo-grid">
          {/* 磁盘 */}
          <div className="card">
            <h2>💾 磁盘空间</h2>
            <div className="progress-stack">
              <div className="progress-item">
                <div className="progress-label"><span>已用</span><span>{fmtBytes(si.disk.used)}</span></div>
                <div className="progress-bar">
                  <div className="progress-fill used" style={{width: si.disk.total > 0 ? (si.disk.used/si.disk.total*100)+'%' : '0%'}} />
                </div>
              </div>
              <div className="progress-item">
                <div className="progress-label"><span>可用</span><span>{fmtBytes(si.disk.free)}</span></div>
                <div className="progress-bar">
                  <div className="progress-fill free" style={{width: si.disk.total > 0 ? (si.disk.free/si.disk.total*100)+'%' : '0%'}} />
                </div>
              </div>
            </div>
            <div className="progress-total">总计 {fmtBytes(si.disk.total)}</div>
          </div>

          {/* 内存 */}
          <div className="card">
            <h2>🧠 内存</h2>
            {si.memory.sys_total > 0 ? (
              <div className="progress-stack">
                <div className="progress-item">
                  <div className="progress-label"><span>已用</span><span>{fmtBytes(si.memory.sys_total - si.memory.sys_available)}</span></div>
                  <div className="progress-bar">
                    <div className="progress-fill used" style={{width: ((si.memory.sys_total - si.memory.sys_available) / si.memory.sys_total * 100)+'%'}} />
                  </div>
                </div>
                <div className="progress-item">
                  <div className="progress-label"><span>可用</span><span>{fmtBytes(si.memory.sys_available)}</span></div>
                  <div className="progress-bar">
                    <div className="progress-fill free" style={{width: (si.memory.sys_available / si.memory.sys_total * 100)+'%'}} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="progress-stack">
                <div className="progress-item">
                  <div className="progress-label"><span>JVM 已用</span><span>{fmtBytes(si.memory.jvm_allocated - si.memory.jvm_free)}</span></div>
                  <div className="progress-bar">
                    <div className="progress-fill used" style={{width: si.memory.jvm_max > 0 ? ((si.memory.jvm_allocated - si.memory.jvm_free)/si.memory.jvm_max*100)+'%' : '0%'}} />
                  </div>
                </div>
              </div>
            )}
            <div className="progress-total">JVM 最大 {fmtBytes(si.memory.jvm_max)}</div>
          </div>

          {/* 网络 & 设备 */}
          <div className="card">
            <h2>🌐 网络 & 设备</h2>
            <div className="info-rows">
              <div className="info-row"><span className="info-key">局域网 IP</span><code>{si.network.lan_ip}</code></div>
              {si.network.wifi_ssid && <div className="info-row"><span className="info-key">WiFi</span><span>{si.network.wifi_ssid}</span></div>}
              <div className="info-row"><span className="info-key">设备</span><span>{si.battery.device_model}</span></div>
              <div className="info-row"><span className="info-key">Android</span><span>{si.battery.android_version}</span></div>
            </div>
          </div>

          {/* CPU */}
          <div className="card">
            <h2>⚙️ CPU</h2>
            <div className="info-rows">
              <div className="info-row"><span className="info-key">型号</span><span>{si.cpu.model}</span></div>
              <div className="info-row"><span className="info-key">架构</span><span>{si.cpu.arch} · {si.cpu.cores} 核</span></div>
              {si.cpu.implementer && <div className="info-row"><span className="info-key">ID</span><code>{si.cpu.implementer}/{si.cpu.cpu_arch}/{si.cpu.variant}/{si.cpu.part} r{si.cpu.revision}</code></div>}
              {si.cpu.bogomips > 0 && <div className="info-row"><span className="info-key">BogoMIPS</span><span>{si.cpu.bogomips.toFixed(1)}</span></div>}
              {si.cpu.features && <div className="info-row" style={{flexDirection:'column',alignItems:'flex-start',gap:4}}>
                <span className="info-key">特性</span>
                <span style={{fontSize:'0.65rem',color:'var(--text-tertiary)',lineHeight:1.5,wordBreak:'break-all'}}>{si.cpu.features}</span>
              </div>}
            </div>
            {/* 各核心频率 */}
            {Object.keys(si.cpu.frequencies).length > 0 && (
              <>
                <div style={{marginTop:12,fontSize:'0.7rem',color:'var(--text-tertiary)',marginBottom:8,fontWeight:600}}>核心频率</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
                  {Object.entries(si.cpu.frequencies).slice(0,8).map(([k,v]) => (
                    <div key={k} style={{background:'var(--bg-input)',borderRadius:'var(--r-sm)',padding:'8px 10px',fontSize:'0.68rem'}}>
                      <div style={{color:'var(--accent)',fontWeight:600,marginBottom:2}}>Core {k.replace('core','')}</div>
                      {v.cur_khz && <div style={{color:'var(--text-secondary)'}}>{(v.cur_khz/1000).toFixed(0)} MHz</div>}
                      {v.governor && <div style={{color:'var(--text-tertiary)',fontSize:'0.62rem'}}>{v.governor}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
            {/* 负载 */}
            {si.cpu.load.avg1 > 0 && (
              <div style={{marginTop:12,display:'flex',gap:16}}>
                <div style={{textAlign:'center'}}><div style={{fontSize:'1rem',fontWeight:700,color:'var(--accent)'}}>{si.cpu.load.avg1.toFixed(1)}</div><div style={{fontSize:'0.62rem',color:'var(--text-tertiary)'}}>1min</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:'1rem',fontWeight:700,color:'var(--text-secondary)'}}>{si.cpu.load.avg5.toFixed(1)}</div><div style={{fontSize:'0.62rem',color:'var(--text-tertiary)'}}>5min</div></div>
                <div style={{textAlign:'center'}}><div style={{fontSize:'1rem',fontWeight:700,color:'var(--text-secondary)'}}>{si.cpu.load.avg15.toFixed(1)}</div><div style={{fontSize:'0.62rem',color:'var(--text-tertiary)'}}>15min</div></div>
                {si.cpu.load.running !== undefined && <div style={{textAlign:'center'}}><div style={{fontSize:'1rem',fontWeight:700,color:'var(--text-secondary)'}}>{si.cpu.load.running}/{si.cpu.load.total_procs}</div><div style={{fontSize:'0.62rem',color:'var(--text-tertiary)'}}>进程</div></div>}
              </div>
            )}
          </div>

          {/* UPS / 电池 */}
          <div className="card">
            <h2>🔋 UPS</h2>
            {si.battery.level >= 0 ? (
              <>
                <div className="progress-stack" style={{marginBottom:12}}>
                  <div className="progress-item">
                    <div className="progress-label">
                      <span>{si.battery.status}</span>
                      <span style={{color: si.battery.level > 20 ? 'var(--success)' : si.battery.level <= 10 ? 'var(--danger)' : 'var(--warning)'}}>{si.battery.level}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: si.battery.level+'%',
                        background: si.battery.level > 20
                          ? 'linear-gradient(90deg, var(--success), #22c55e)'
                          : si.battery.level > 10
                            ? 'linear-gradient(90deg, var(--warning), #f59e0b)'
                            : 'linear-gradient(90deg, var(--danger), #ef4444)'
                      }} />
                    </div>
                  </div>
                </div>
                <div className="info-rows">
                  <div className="info-row"><span className="info-key">供电方式</span><span>{si.battery.power_source}</span></div>
                  <div className="info-row"><span className="info-key">温度</span><span>{si.battery.temperature}°C</span></div>
                  <div className="info-row"><span className="info-key">电压</span><span>{si.battery.voltage}V</span></div>
                  <div className="info-row"><span className="info-key">健康</span><span style={{color: si.battery.health === '良好' ? 'var(--success)' : 'var(--warning)'}}>{si.battery.health}</span></div>
                  <div className="info-row"><span className="info-key">类型</span><span>{si.battery.technology}</span></div>
                </div>
              </>
            ) : (
              <div className="info-rows">
                <div className="info-row"><span className="info-key">状态</span><span style={{color:'var(--text-tertiary)'}}>不可用</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2><IconImage size={16} /> 最近图片</h2>
        {recentImages.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><IconImage size={48} /></div>
            <p>暂无图片数据</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>ID</th><th>URL</th><th>状态</th><th>时间</th></tr>
              </thead>
              <tbody>
                {recentImages.map(i => (
                  <tr key={i.id}>
                    <td style={{color:'var(--accent)',fontWeight:600,fontSize:'0.72rem'}}>#{i.id}</td>
                    <td className="url" title={i.url}>{i.url}</td>
                    <td><span className={`badge ${statusBadge[i.status]}`}>{statusLabels[i.status]}</span></td>
                    <td>{fmtTs(i.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2>🔧 快捷操作</h2>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={triggerBackup}>
            <IconCloudUpload size={15} /> 立即备份到 WebDAV
          </button>
          <button className="btn btn-ghost" onClick={load}>
            <IconRefresh size={15} /> 刷新数据
          </button>
        </div>
      </div>
    </div>
  );
}

export function fmtTs(ts?: string): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('zh-CN');
}

export function h(s?: string): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
