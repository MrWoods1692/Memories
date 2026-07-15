interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 12,
        padding: 24, maxWidth: 400, width: '90%',
      }}>
        <h3 style={{ color: '#e0e0e0', marginBottom: 12 }}>确认操作</h3>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  );
}
