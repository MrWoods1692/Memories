import { IconAlert } from './Icons';

interface Props {
  msg: string;
  onOk: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ msg, onOk, onCancel }: Props) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3><IconAlert size={18} /> 确认操作</h3>
        <p>{msg}</p>
        <div className="dialog-btns">
          <button className="btn ghost sm" onClick={onCancel}>取消</button>
          <button className="btn danger sm" onClick={onOk}>确认</button>
        </div>
      </div>
    </div>
  );
}
