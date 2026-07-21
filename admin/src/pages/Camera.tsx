import { useEffect, useState, useRef } from 'react';
import { apiGet } from '../api';
import { IconCamera, IconRefresh, IconVideo, IconPhoto } from '../components/Icons';
import type { SysInfo } from '../types';

interface CameraProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

interface CameraInfo {
  id: string;
  facing: string;
  maxJpegWidth: number;
  maxJpegHeight: number;
}

export function Camera({ toast }: CameraProps) {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState(80);
  const [maxWidth, setMaxWidth] = useState(1920);
  const streamImgRef = useRef<HTMLImageElement>(null);
  const [sysinfo, setSysinfo] = useState<SysInfo | null>(null);

  const load = async () => {
    try {
      const [info, si] = await Promise.all([
        apiGet<{cameras: CameraInfo[]}>('/camera/info'),
        apiGet<SysInfo>('/sysinfo').catch(() => null),
      ]);
      setCameras(Array.isArray(info.cameras) ? info.cameras : []);
      setSysinfo(si);
    } catch {
      toast('无法获取摄像头信息', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const apiBase = (window as any).__API_BASE__ || 'http://localhost:8080';

  const takeSnapshot = () => {
    setSnapshotUrl(`${apiBase}/camera/snapshot?quality=${quality}&maxWidth=${maxWidth}&t=${Date.now()}`);
  };

  const toggleStream = () => {
    if (streaming) {
      setStreaming(false);
      if (streamImgRef.current) streamImgRef.current.src = '';
    } else {
      setStreaming(true);
      setTimeout(() => {
        if (streamImgRef.current) {
          streamImgRef.current.src = `${apiBase}/camera/stream?quality=50&maxWidth=640&t=${Date.now()}`;
        }
      }, 100);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="stat-grid">
          {[1,2].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{width:44,height:44,borderRadius:10}} />
              <div><div className="skeleton" style={{width:80,height:20,marginBottom:6}} /><div className="skeleton" style={{width:50,height:12}} /></div>
            </div>
          ))}
        </div>
        <div className="card"><div className="skeleton" style={{width:'100%',height:300,borderRadius:8}} /></div>
      </div>
    );
  }

  const hasCamera = cameras.length > 0;

  return (
    <div>
      {/* 摄像头信息 */}
      <div className="stat-grid">
        {cameras.map(cam => (
          <div key={cam.id} className="stat-card">
            <div className="stat-icon camera">
              <IconCamera size={20} />
            </div>
            <div className="stat-info">
              <div className="num">{cam.facing}摄像头</div>
              <div className="label">{cam.maxJpegWidth}×{cam.maxJpegHeight}</div>
            </div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-icon status">
            <IconVideo size={20} />
          </div>
          <div className="stat-info">
            <div className="num" style={{fontSize:18}}>
              <span className={`status-dot ${hasCamera ? 'on' : 'off'}`} />
              {hasCamera ? '可用' : '不可用'}
            </div>
            <div className="label">摄像头状态</div>
          </div>
        </div>
      </div>

      {/* 快照 */}
      <div className="card">
        <h2><IconPhoto size={16} /> 拍照快照</h2>
        <div className="camera-toolbar">
          <div className="form-group" style={{margin:0,flex:'0 0 auto'}}>
            <label>JPEG 质量</label>
            <input type="range" min={10} max={100} value={quality}
              onChange={e => setQuality(Number(e.target.value))}
              style={{width:140}} />
            <span style={{fontSize:'0.75rem',color:'var(--text-tertiary)',marginLeft:8}}>{quality}%</span>
          </div>
          <div className="form-group" style={{margin:0,flex:'0 0 auto'}}>
            <label>最大宽度</label>
            <select value={maxWidth} onChange={e => setMaxWidth(Number(e.target.value))}
              style={{width:120}}>
              <option value={640}>640px</option>
              <option value={1280}>1280px</option>
              <option value={1920}>1920px</option>
              <option value={3840}>3840px</option>
            </select>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
            <button className="btn btn-primary" onClick={takeSnapshot} disabled={!hasCamera}>
              <IconPhoto size={14} /> 拍摄
            </button>
            <button className="btn btn-ghost" onClick={load}>
              <IconRefresh size={14} /> 刷新
            </button>
          </div>
        </div>

        {snapshotUrl && (
          <div className="camera-preview" style={{marginTop:16}}>
            <img src={snapshotUrl} alt="快照"
              style={{width:'100%',maxHeight:500,objectFit:'contain',borderRadius:8,border:'1px solid var(--border)'}} />
            <div style={{marginTop:8,display:'flex',gap:8}}>
              <a href={snapshotUrl} download="snapshot.jpg" className="btn btn-sm btn-primary">下载 JPEG</a>
              <button className="btn btn-sm btn-ghost" onClick={() => setSnapshotUrl(null)}>清除</button>
            </div>
          </div>
        )}
      </div>

      {/* MJPEG 实时流 */}
      <div className="card">
        <h2><IconVideo size={16} /> 实时视频流 (MJPEG)</h2>
        <p style={{fontSize:'0.78rem',color:'var(--text-tertiary)',marginBottom:12}}>
          MJPEG 流会持续消耗带宽和 CPU，请按需开启。在浏览器中直接访问 <code style={{fontSize:'0.7rem'}}>/camera/stream</code>
        </p>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <button className={`btn ${streaming ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleStream} disabled={!hasCamera}>
            <IconVideo size={14} />
            {streaming ? '停止推流' : '开始预览'}
          </button>
        </div>
        {streaming && (
          <div style={{background:'#000',borderRadius:8,overflow:'hidden',maxHeight:480,textAlign:'center'}}>
            <img ref={streamImgRef} alt="MJPEG Stream"
              style={{width:'100%',maxHeight:480,objectFit:'contain'}} />
          </div>
        )}
      </div>
    </div>
  );
}
