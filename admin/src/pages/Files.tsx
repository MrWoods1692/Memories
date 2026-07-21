import { useEffect, useState, useCallback, useRef } from 'react';
import { apiGet, apiDelete } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconFolder, IconFile, IconRefresh, IconSearch, IconTrash, IconPlus, IconDownload, IconChevronLeft, IconHardDrive, IconCopy } from '../components/Icons';
import { copyToClipboard, useDebounce } from '../hooks';

interface FilesProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  readableSize: string;
  lastModified: number;
  lastModifiedStr: string;
  isHidden: boolean;
  canRead: boolean;
  canWrite: boolean;
}

interface FileListResult {
  path: string;
  parent: string;
  absolute_path: string;
  items: FileItem[];
  count: number;
  freeSpace: number;
  totalSpace: number;
  freeSpaceReadable: string;
  totalSpaceReadable: string;
  error?: string;
}

interface StorageSummary {
  rootPath: string;
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  totalSpaceReadable: string;
  freeSpaceReadable: string;
  usedSpaceReadable: string;
  state: string;
}

interface SearchResult {
  query: string;
  items: FileItem[];
  count: number;
}

function fmtTs(ms: number): string {
  if (!ms) return '-';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sortItems(items: FileItem[], by: string, asc: boolean): FileItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    let cmp = 0;
    if (by === 'size') cmp = a.size - b.size;
    else if (by === 'date') cmp = a.lastModified - b.lastModified;
    else cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return asc ? cmp : -cmp;
  });
  return sorted;
}

export function Files({ toast }: FilesProps) {
  const [path, setPath] = useState('/');
  const [files, setFiles] = useState<FileListResult | null>(null);
  const [storage, setStorage] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [mkdirPath, setMkdirPath] = useState('');
  const [showMkdir, setShowMkdir] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBase = (window as any).__API_BASE__ || 'http://localhost:8080';

  const loadFiles = useCallback(async (dir: string) => {
    setLoading(true);
    setSearchResults(null);
    try {
      const [data, stor] = await Promise.all([
        apiGet<FileListResult>(`/files/list?path=${encodeURIComponent(dir)}&sortBy=${sortBy}&order=${sortAsc ? 'asc' : 'desc'}`),
        apiGet<StorageSummary>('/files/storage'),
      ]);
      if (data.error) {
        toast(data.error, 'error');
      } else {
        setFiles(data);
      }
      setStorage(stor);
      setPath(dir);
    } catch {
      toast('加载文件列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortAsc, toast]);

  useEffect(() => {
    loadFiles(path);
  }, [loadFiles]);

  // Debounced search
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults(null);
      return;
    }
    const doSearch = async () => {
      setSearching(true);
      try {
        const data = await apiGet<SearchResult>(
          `/files/search?q=${encodeURIComponent(debouncedSearch)}&path=${encodeURIComponent(path)}&maxResults=100`
        );
        setSearchResults(data);
      } catch { toast('搜索失败', 'error'); }
      finally { setSearching(false); }
    };
    doSearch();
  }, [debouncedSearch]);

  const navigateTo = (newPath: string) => {
    setSearchQuery('');
    setSearchResults(null);
    loadFiles(newPath);
  };

  const handleDelete = (filePath: string, isDir: boolean) => {
    setConfirmMsg(isDir ? `确定删除目录 "${filePath}" 及其所有内容？` : `确定删除文件 "${filePath}"？`);
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/files/delete?path=${encodeURIComponent(filePath)}&recursive=true`);
        toast('已删除');
        loadFiles(path);
      } catch { toast('删除失败', 'error'); }
      setConfirmAction(null);
    });
  };

  const handleMkdir = async () => {
    if (!mkdirPath) return;
    try {
      const fullPath = path === '/' ? `/${mkdirPath}` : `${path}/${mkdirPath}`;
      const r = await fetch(`${apiBase}/files/mkdir?path=${encodeURIComponent(fullPath)}`, { method: 'POST' });
      const text = await r.text();
      const data = JSON.parse(text);
      if (data.success) {
        toast('目录已创建');
        loadFiles(path);
        setShowMkdir(false);
        setMkdirPath('');
      } else {
        toast(data.error || '创建失败', 'error');
      }
    } catch { toast('创建失败', 'error'); }
  };

  const handleRename = async () => {
    if (!renameFrom || !renameTo) return;
    try {
      const from = path === '/' ? `/${renameFrom}` : `${path}/${renameFrom}`;
      const to = path === '/' ? `/${renameTo}` : `${path}/${renameTo}`;
      const r = await fetch(`${apiBase}/files/rename?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { method: 'POST' });
      const data = JSON.parse(await r.text());
      if (data.success) {
        toast('已重命名');
        loadFiles(path);
        setShowRename(false);
        setRenameFrom('');
        setRenameTo('');
      } else {
        toast(data.error || '重命名失败', 'error');
      }
    } catch { toast('重命名失败', 'error'); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('content', file);
      const r = await fetch(`${apiBase}/files/upload?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: formData,
      });
      const data = JSON.parse(await r.text());
      if (data.success) {
        toast('上传成功');
        loadFiles(path);
      } else {
        toast(data.error || '上传失败', 'error');
      }
    } catch { toast('上传失败', 'error'); }
    finally { setUploading(false); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayItems = searchResults ? searchResults.items :
    (files ? sortItems(files.items, sortBy, sortAsc) : []);

  const getFileIcon = (item: FileItem) => item.isDirectory ? <IconFolder size={14} /> : <IconFile size={14} />;

  return (
    <div>
      {/* 存储概览 */}
      {storage && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon images"><IconHardDrive size={20} /></div>
            <div className="stat-info">
              <div className="num">{storage.totalSpaceReadable}</div>
              <div className="label">总容量</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon status"><IconFolder size={20} /></div>
            <div className="stat-info">
              <div className="num">{storage.freeSpaceReadable}</div>
              <div className="label">可用空间</div>
            </div>
          </div>
        </div>
      )}

      {/* 文件浏览器 */}
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {/* 工具栏 */}
        <div className="files-toolbar">
          {/* 路径导航 */}
          <div className="files-breadcrumb">
            <button className="btn btn-xs btn-ghost" onClick={() => navigateTo('/')}
              disabled={path === '/'}>📁 根目录</button>
            {path !== '/' && (
              <>
                <span style={{color:'var(--text-tertiary)',fontSize:'0.7rem'}}>/</span>
                <button className="btn btn-xs btn-ghost" onClick={() => navigateTo(files?.parent || '/')}
                  disabled={!files?.parent}>
                  <IconChevronLeft size={12} /> 上级
                </button>
              </>
            )}
            <div className="files-path-display">
              <code>{files?.absolute_path || path}</code>
              <button className="btn-copy" style={{opacity:0.6}}
                onClick={() => { copyToClipboard(files?.absolute_path || path); toast('路径已复制', 'success'); }}>
                <IconCopy size={12} />
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="files-actions">
            <div className="search-wrap" style={{minWidth:160}}>
              <span className="search-icon"><IconSearch size={14} /></span>
              <input className="search-input" placeholder="搜索文件..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{fontSize:'0.75rem',padding:'6px 10px 6px 30px'}} />
            </div>
            <button className="btn btn-xs btn-ghost" onClick={() => loadFiles(path)}>
              <IconRefresh size={12} />
            </button>
            <button className="btn btn-xs btn-ghost" onClick={() => setShowMkdir(true)}>
              <IconPlus size={12} /> 新建目录
            </button>
            <button className="btn btn-xs btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              📤 {uploading ? '上传中...' : '上传文件'}
            </button>
            <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleUpload} />
          </div>
        </div>

        {/* 表头排序 */}
        <div className="files-header">
          <span className="files-col-name" onClick={() => { setSortBy('name'); setSortAsc(sortBy==='name'?!sortAsc:true); }}>
            名称 {sortBy==='name' ? (sortAsc?'▲':'▼') : ''}
          </span>
          <span className="files-col-size" onClick={() => { setSortBy('size'); setSortAsc(sortBy==='size'?!sortAsc:true); }}>
            大小 {sortBy==='size' ? (sortAsc?'▲':'▼') : ''}
          </span>
          <span className="files-col-date" onClick={() => { setSortBy('date'); setSortAsc(sortBy==='date'?!sortAsc:true); }}>
            修改时间 {sortBy==='date' ? (sortAsc?'▲':'▼') : ''}
          </span>
          <span className="files-col-actions">操作</span>
        </div>

        {/* 文件列表 */}
        {loading || searching ? (
          <div className="loading"><span className="spin">⟳</span> 加载中...</div>
        ) : displayItems.length === 0 ? (
          <div className="empty">
            <div className="empty-icon" style={{fontSize:36}}>📂</div>
            <p>{searchResults ? '未找到匹配文件' : '此目录为空'}</p>
          </div>
        ) : (
          <div className="files-list">
            {displayItems.map(item => (
              <div key={item.path} className="files-row"
                onDoubleClick={() => item.isDirectory ? navigateTo(item.path) : null}>
                <span className="files-col-name">
                  <span className="files-item-icon">{getFileIcon(item)}</span>
                  <span className={`files-item-name ${item.isDirectory ? 'is-dir' : ''}`}
                    onClick={() => item.isDirectory ? navigateTo(item.path) : null}>
                    {item.name}
                  </span>
                </span>
                <span className="files-col-size">
                  {item.isDirectory ? '-' : item.readableSize}
                </span>
                <span className="files-col-date">{fmtTs(item.lastModified)}</span>
                <span className="files-col-actions">
                  {!item.isDirectory && (
                    <a href={`${apiBase}/files/download?path=${encodeURIComponent(item.path)}`}
                      className="btn btn-xs btn-ghost" download>
                      <IconDownload size={12} />
                    </a>
                  )}
                  <button className="btn btn-xs btn-ghost"
                    onClick={() => { setRenameFrom(item.name); setShowRename(true); }}>
                    重命名
                  </button>
                  <button className="btn btn-xs btn-danger"
                    onClick={() => handleDelete(item.path, item.isDirectory)}>
                    <IconTrash size={12} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {files && !searchResults && (
          <div className="files-footer">
            共 {files.count} 个项目 · {files.freeSpaceReadable} 可用
          </div>
        )}
      </div>

      {/* 新建目录对话框 */}
      {showMkdir && (
        <div className="dialog-overlay" onClick={() => setShowMkdir(false)}>
          <div className="dialog-box" onClick={e => e.stopPropagation()}>
            <h3><IconFolder size={16} /> 新建目录</h3>
            <div className="form-group">
              <label>目录名称</label>
              <input value={mkdirPath} onChange={e => setMkdirPath(e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleMkdir()} autoFocus
                placeholder="请输入目录名" />
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setShowMkdir(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleMkdir}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 重命名对话框 */}
      {showRename && (
        <div className="dialog-overlay" onClick={() => setShowRename(false)}>
          <div className="dialog-box" onClick={e => e.stopPropagation()}>
            <h3>重命名</h3>
            <div className="form-group">
              <label>原名</label>
              <input value={renameFrom} disabled style={{opacity:0.6}} />
            </div>
            <div className="form-group">
              <label>新名称</label>
              <input value={renameTo} onChange={e => setRenameTo(e.target.value)}
                onKeyDown={e => e.key==='Enter' && handleRename()} autoFocus />
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setShowRename(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleRename}>确认</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {confirmAction && (
        <ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={() => setConfirmAction(null)} />
      )}
    </div>
  );
}
