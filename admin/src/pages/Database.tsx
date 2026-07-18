import { useEffect, useState, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IconDatabase, IconSearch, IconRefresh, IconPlay, IconX, IconCopy, IconTrash, IconAlert, IconCheck } from '../components/Icons';
import type { DbTable, DbTableData, DbQueryResult } from '../types';

interface DatabaseProps {
  toast: (msg: string, type?: 'success' | 'error') => void;
}

function isWriteSql(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return (
    upper.startsWith('INSERT') || upper.startsWith('UPDATE') ||
    upper.startsWith('DELETE') || upper.startsWith('CREATE') ||
    upper.startsWith('ALTER') || upper.startsWith('DROP') ||
    upper.startsWith('REPLACE')
  );
}

/** 从行数据中提取主键值，用于 WHERE 条件 */
function getPkValue(row: Record<string, unknown>, pkCols: { name: string }[]): string | null {
  if (pkCols.length === 0) return null;
  const parts: string[] = [];
  for (const col of pkCols) {
    const v = row[col.name];
    if (v === null || v === undefined) return null;
    parts.push(typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v));
  }
  return parts.join('_');
}

function buildPkWhere(row: Record<string, unknown>, pkCols: { name: string }[]): string {
  return pkCols.map(c => {
    const v = row[c.name];
    if (v === null || v === undefined) return `${c.name} IS NULL`;
    return `${c.name} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)}`;
  }).join(' AND ');
}

export function Database({ toast }: DatabaseProps) {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<DbTableData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // SQL 查询
  const [queryMode, setQueryMode] = useState(false);
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<DbQueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // 移动端侧栏开关
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 确认对话框
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // 内联编辑
  const [editingCell, setEditingCell] = useState<{ rowKey: string; col: string; value: string } | null>(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadTables = useCallback(async () => {
    try {
      setLoading(true);
      const t = await apiGet<DbTable[]>('/db/tables');
      setTables(Array.isArray(t) ? t : []);
    } catch {
      toast('加载表列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const loadTableData = useCallback(async (tableName: string, p: number) => {
    try {
      setTableLoading(true);
      const data = await apiGet<DbTableData>(`/db/table/${tableName}?page=${p}&limit=50`);
      setTableData(data);
    } catch {
      toast('加载表数据失败', 'error');
    } finally {
      setTableLoading(false);
    }
  }, [toast]);

  const selectTable = (name: string) => {
    setSelectedTable(name);
    setQueryMode(false);
    setQueryResult(null);
    setPage(1);
    setSidebarOpen(false);
    loadTableData(name, 1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    if (selectedTable) loadTableData(selectedTable, p);
  };

  const executeQuery = async () => {
    if (!sql.trim()) { toast('请输入 SQL 语句', 'error'); return; }
    const trimmed = sql.trim();
    if (isWriteSql(trimmed)) {
      const preview = trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed;
      setConfirmMsg(`⚠️ 即将执行写入操作：\n\n${preview}\n\n此操作不可撤销，确定继续？`);
      setConfirmAction(() => async () => {
        setConfirmAction(null);
        await doExecute(trimmed);
      });
      return;
    }
    await doExecute(trimmed);
  };

  const doExecute = async (stmt: string) => {
    try {
      setQueryLoading(true);
      const result = await apiPost<DbQueryResult>('/db/query', { sql: stmt });
      setQueryResult(result);
      if (result.error) {
        toast(result.error, 'error');
      } else if (result.type === 'write') {
        toast(result.message || `影响 ${result.affected ?? 0} 行`, 'success');
        loadTables();
        if (selectedTable) loadTableData(selectedTable, page);
      }
    } catch {
      toast('执行失败', 'error');
    } finally {
      setQueryLoading(false);
    }
  };

  /** 快速删除表中行（通过主键）；无主键时自动转入 SQL 控制台 */
  const quickDelete = (row: Record<string, unknown>) => {
    if (!selectedTable || !selectedTableInfo) return;
    const pkCol = selectedTableInfo.columns.find(c => c.pk);
    if (!pkCol) {
      // 无主键：自动转入 SQL 控制台，预填带所有列值的 DELETE 语句
      const conditions = selectedTableInfo.columns
        .filter(c => row[c.name] !== null && row[c.name] !== undefined)
        .map(c => {
          const v = row[c.name];
          return `${c.name} = ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)}`;
        });
      const stmt = conditions.length > 0
        ? `DELETE FROM ${selectedTable} WHERE ${conditions.join(' AND ')};`
        : `DELETE FROM ${selectedTable} /* 请手动补全 WHERE 条件 */;`;
      setSql(stmt);
      setQueryMode(true);
      setSelectedTable(null);
      setTableData(null);
      setQueryResult(null);
      toast('已转入 SQL 控制台，请确认 DELETE 语句后执行', 'success');
      return;
    }
    const pkVal = row[pkCol.name];
    if (pkVal === null || pkVal === undefined) {
      toast('主键值为空，无法删除', 'error');
      return;
    }
    const valStr = typeof pkVal === 'string' ? `'${pkVal.replace(/'/g, "''")}'` : String(pkVal);
    const stmt = `DELETE FROM ${selectedTable} WHERE ${pkCol.name} = ${valStr}`;
    setConfirmMsg(`⚠️ 确定删除 ${selectedTable} 中 ${pkCol.name}=${renderValue(pkVal)} 的行？`);
    setConfirmAction(() => async () => {
      setConfirmAction(null);
      try {
        await apiPost<DbQueryResult>('/db/query', { sql: stmt });
        toast('已删除', 'success');
        loadTables();
        loadTableData(selectedTable, page);
      } catch {
        toast('删除失败', 'error');
      }
    });
  };

  /** 保存内联编辑；无主键时自动转入 SQL 控制台 */
  const saveCellEdit = async () => {
    if (!editingCell || !selectedTable || !selectedTableInfo) return;
    const pkCols = selectedTableInfo.columns.filter(c => c.pk);
    if (pkCols.length === 0) {
      // 无主键：自动转入 SQL 控制台，预填 UPDATE 模板，由用户补全 WHERE 条件
      const valLiteral = editingCell.value === 'NULL'
        ? 'NULL'
        : `'${editingCell.value.replace(/'/g, "''")}'`;
      const stmt = `UPDATE ${selectedTable} SET ${editingCell.col} = ${valLiteral} WHERE /* 请补全 WHERE 条件 */;`;
      setSql(stmt);
      setQueryMode(true);
      setSelectedTable(null);
      setTableData(null);
      setQueryResult(null);
      setEditingCell(null);
      toast('已转入 SQL 控制台，请补全 UPDATE 语句后执行', 'success');
      return;
    }
    // 从 rowKey 还原 where 条件
    const pkCol = pkCols[0];
    const pkVal = editingCell.rowKey;
    const isNumberPk = !pkVal.startsWith("'");
    const whereClause = isNumberPk
      ? `${pkCol.name} = ${pkVal}`
      : `${pkCol.name} = ${pkVal}`;

    const newVal = editingCell.value;
    const valLiteral = newVal === 'NULL'
      ? 'NULL'
      : `'${newVal.replace(/'/g, "''")}'`;

    const stmt = `UPDATE ${selectedTable} SET ${editingCell.col} = ${valLiteral} WHERE ${whereClause}`;
    try {
      setEditingSaving(true);
      const result = await apiPost<DbQueryResult>('/db/query', { sql: stmt });
      if (result.error) {
        toast(result.error, 'error');
      } else {
        toast('已更新', 'success');
        loadTables();
        loadTableData(selectedTable, page);
      }
    } catch {
      toast('更新失败', 'error');
    } finally {
      setEditingSaving(false);
      setEditingCell(null);
    }
  };

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const cellClass = (val: unknown): string => {
    if (val === null || val === undefined) return 'cell-null';
    if (typeof val === 'number') return 'cell-num';
    return '';
  };

  const copyCell = async (val: unknown) => {
    try {
      await navigator.clipboard.writeText(renderValue(val));
      toast('已复制');
    } catch {
      toast('复制失败', 'error');
    }
  };

  const selectedTableInfo = tables.find(t => t.name === selectedTable);
  const pkColumns = selectedTableInfo?.columns.filter(c => c.pk) ?? [];
  const canEdit = pkColumns.length > 0;

  /** 开始编辑某个单元格 */
  const startEdit = (row: Record<string, unknown>, col: string) => {
    const val = row[col];
    const strVal = val === null || val === undefined ? 'NULL' : String(val);
    const rowKey = getPkValue(row, pkColumns);
    if (!rowKey) return;
    setEditingCell({ rowKey, col, value: strVal });
    // 延迟聚焦输入框
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const renderResultTable = (columns: string[], rows: Record<string, unknown>[]) => (
    <div className="table-wrapper">
      <table className="db-data-table">
        <thead>
          <tr>
            <th style={{width:40}}>#</th>
            {columns.map(col => <th key={col}>{col}</th>)}
            <th style={{width:50}}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowKey = getPkValue(row, pkColumns);
            const isEditing = editingCell?.rowKey === rowKey;
            return (
            <tr key={i} className={isEditing ? 'row-editing' : ''}>
              <td className="row-num">{i + 1}</td>
              {columns.map(col => {
                const editingThis = isEditing && editingCell?.col === col;
                const isPk = pkColumns.some(c => c.name === col);
                if (editingThis) {
                  return (
                    <td key={col} className="cell-editing">
                      <div className="edit-cell-wrap">
                        <input
                          ref={editInputRef}
                          className="edit-cell-input"
                          value={editingCell!.value}
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCellEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          onBlur={() => saveCellEdit()}
                          disabled={editingSaving}
                        />
                        <button
                          className="btn btn-success btn-xs edit-save-btn"
                          onMouseDown={e => { e.preventDefault(); saveCellEdit(); }}
                          disabled={editingSaving}
                          title="保存"
                        >
                          {editingSaving ? <span className="spin"><IconRefresh size={10} /></span> : <IconCheck size={10} />}
                        </button>
                        <button
                          className="btn btn-ghost btn-xs edit-cancel-btn"
                          onMouseDown={e => { e.preventDefault(); setEditingCell(null); }}
                          title="取消"
                        >
                          <IconX size={10} />
                        </button>
                      </div>
                    </td>
                  );
                }
                return (
                  <td
                    key={col}
                    className={`${canEdit ? 'cell-editable ' : ''}${cellClass(row[col])}`}
                    onClick={() => canEdit ? startEdit(row, col) : undefined}
                    title={!canEdit ? '' : isPk ? '主键不可编辑' : '点击编辑'}
                  >
                    <span className="cell-value">{renderValue(row[col])}</span>
                    <button className="btn-copy" onClick={e => { e.stopPropagation(); copyCell(row[col]); }} title="复制">
                      <IconCopy size={10} />
                    </button>
                    {canEdit && !isPk && <span className="cell-edit-hint">✎</span>}
                  </td>
                );
              })}
              <td>
                <button
                  className="btn btn-danger btn-xs"
                  onClick={() => quickDelete(row)}
                  title="删除此行"
                >
                  <IconTrash size={10} />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="db-layout">
        <button className="db-sidebar-toggle" disabled>
          <IconDatabase size={16} /> 加载中...
        </button>
        <div className="db-sidebar">
          <div className="card"><h2><IconDatabase size={16} /> 数据表</h2>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{height:32, marginBottom:6, borderRadius:6}} />)}
          </div>
        </div>
        <div className="db-main">
          <div className="empty"><p>加载中...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-layout">
      {/* 移动端侧栏切换按钮 */}
      <button
        className="db-sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
      >
        <IconDatabase size={16} /> 数据表 ({tables.length})
        <span className={`arrow${sidebarOpen ? ' open' : ''}`}>▾</span>
      </button>
      {/* 左侧表列表 */}
      <div className={`db-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="card">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
            <h2 style={{margin:0,padding:0,border:'none'}}><IconDatabase size={16} /> 数据表</h2>
            <button className="btn btn-ghost btn-xs" onClick={loadTables} title="刷新"><IconRefresh size={12} /></button>
          </div>
          <div style={{marginBottom:10}}>
            <button
              className={`btn btn-xs ${queryMode ? 'btn-primary' : 'btn-ghost'}`}
              style={{width:'100%'}}
              onClick={() => { setQueryMode(true); setSelectedTable(null); setTableData(null); setQueryResult(null); setSidebarOpen(false); }}
            >
              <IconSearch size={12} /> SQL 控制台
            </button>
          </div>
          {tables.map(t => (
            <div
              key={t.name}
              className={`db-table-item ${selectedTable === t.name ? 'active' : ''}`}
              onClick={() => selectTable(t.name)}
            >
              <div className="db-table-name">{t.name}</div>
              <div className="db-table-meta">{t.columns.length} 列 · {t.rowCount} 行</div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧主区域 */}
      <div className="db-main">
        {/* SQL 控制台 */}
        {queryMode && (
          <div className="card">
            <h2><IconSearch size={16} /> SQL 控制台</h2>
            <div className="query-warning">
              <IconAlert size={14} /> 支持读写操作。INSERT/UPDATE/DELETE 等写操作将弹出确认提示。
            </div>
            <div style={{display:'flex',gap:8,marginBottom:12}}>
              <textarea
                value={sql}
                onChange={e => setSql(e.target.value)}
                placeholder={'-- 查询示例:\nSELECT * FROM images ORDER BY created_at DESC LIMIT 10\n\n-- 修改示例:\nUPDATE images SET status = 1 WHERE id = 1\nDELETE FROM images WHERE id = 2'}
                style={{flex:1,minHeight:80,fontFamily:'var(--font-mono)',fontSize:'0.75rem'}}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) executeQuery(); }}
              />
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <button className="btn btn-primary btn-sm" onClick={executeQuery} disabled={queryLoading}>
                {queryLoading ? <span className="spin"><IconRefresh size={13} /></span> : <IconPlay size={13} />} 执行
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setQueryMode(false); setQueryResult(null); setSql(''); }}>
                <IconX size={13} /> 关闭
              </button>
              <span style={{fontSize:'0.68rem',color:'var(--text-tertiary)'}}>Ctrl+Enter 执行</span>
            </div>

            {queryResult && (
              <div style={{marginTop:16}}>
                {queryResult.error ? (
                  <div className="query-error">{queryResult.error}</div>
                ) : queryResult.type === 'write' ? (
                  <div className="query-success">
                    ✅ 执行成功，影响 <strong>{queryResult.affected ?? 0}</strong> 行
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:'0.72rem',color:'var(--text-tertiary)',marginBottom:8}}>
                      返回 {queryResult.returned} 行
                      {queryResult.truncated && <span style={{color:'var(--warning)',marginLeft:8}}>（已截断）</span>}
                    </div>
                    {queryResult.message && (
                      <div style={{fontSize:'0.72rem',color:'var(--warning)',marginBottom:8}}>{queryResult.message}</div>
                    )}
                    {queryResult.columns && queryResult.rows && renderResultTable(queryResult.columns, queryResult.rows)}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 表结构 + 数据 */}
        {selectedTable && selectedTableInfo && (
          <>
            {/* 表结构 */}
            <div className="card">
              <h2><IconDatabase size={16} /> {selectedTable} <span className="card-count">{selectedTableInfo.rowCount} 行</span></h2>
              <div className="table-wrapper" style={{marginBottom:0}}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>列名</th><th>类型</th><th>非空</th><th>主键</th><th>默认值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTableInfo.columns.map(col => (
                      <tr key={col.cid}>
                        <td style={{color:'var(--text-tertiary)',fontSize:'0.7rem'}}>{col.cid}</td>
                        <td style={{fontWeight:600,fontFamily:'var(--font-mono)',fontSize:'0.75rem'}}>{col.name}</td>
                        <td style={{color:'var(--accent)',fontFamily:'var(--font-mono)',fontSize:'0.72rem'}}>{col.type || '—'}</td>
                        <td>{col.notnull ? <span className="badge badge-2">NOT NULL</span> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
                        <td>{col.pk ? <span className="badge badge-1">PK</span> : <span style={{color:'var(--text-tertiary)'}}>—</span>}</td>
                        <td style={{fontFamily:'var(--font-mono)',fontSize:'0.7rem',color:'var(--text-tertiary)'}}>
                          {col.dflt_value !== null && col.dflt_value !== undefined ? String(col.dflt_value) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 表数据 */}
            <div className="card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:0,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
                <h2 style={{margin:0,padding:0,border:'none'}}>数据</h2>
                <button className="btn btn-ghost btn-xs" onClick={() => loadTableData(selectedTable, page)} title="刷新">
                  <IconRefresh size={12} />
                </button>
              </div>
              {tableLoading ? (
                <div style={{padding:20}}>
                  {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:28,marginBottom:4,borderRadius:4}} />)}
                </div>
              ) : tableData && tableData.rows.length > 0 ? (
                <>
                  {renderResultTable(tableData.columns, tableData.rows)}
                  {/* 分页 */}
                  {tableData.totalPages > 1 && (
                    <div className="pagination">
                      <button className="btn btn-ghost btn-xs" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>上一页</button>
                      {Array.from({ length: Math.min(tableData.totalPages, 7) }, (_, i) => {
                        let p: number;
                        if (tableData.totalPages <= 7) {
                          p = i + 1;
                        } else if (page <= 4) {
                          p = i + 1;
                        } else if (page >= tableData.totalPages - 3) {
                          p = tableData.totalPages - 6 + i;
                        } else {
                          p = page - 3 + i;
                        }
                        return (
                          <button
                            key={p}
                            className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => handlePageChange(p)}
                          >
                            {p}
                          </button>
                        );
                      })}
                      <button className="btn btn-ghost btn-xs" disabled={page >= tableData.totalPages} onClick={() => handlePageChange(page + 1)}>下一页</button>
                      <span className="pagination-info">
                        第 {tableData.page}/{tableData.totalPages} 页，共 {tableData.total} 行
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty"><p>表中暂无数据</p></div>
              )}
            </div>
          </>
        )}

        {/* 未选择表 */}
        {!selectedTable && !queryMode && (
          <div className="empty">
            <div className="empty-icon"><IconDatabase size={48} /></div>
            <p>选择左侧数据表浏览，或点击"SQL 控制台"执行读写操作</p>
          </div>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog message={confirmMsg} onConfirm={confirmAction} onCancel={() => setConfirmAction(null)} />
      )}
    </div>
  );
}
