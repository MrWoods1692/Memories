import { IconAlert } from './Icons';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <h3><IconAlert size={18} /> 确认操作</h3>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </div>
  );
}
