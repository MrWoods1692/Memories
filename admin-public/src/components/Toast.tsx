import { useState, useCallback } from 'react';
import { IconCheck, IconX } from './Icons';

interface ToastItem { id: number; msg: string; type: 'success' | 'error'; }
let _id = 0;

export function useToast() {
  const [list, setList] = useState<ToastItem[]>([]);
  const toast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = ++_id;
    setList(p => [...p, { id, msg, type }]);
    setTimeout(() => setList(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { list, toast };
}

export function ToastContainer({ list }: { list: ToastItem[] }) {
  if (!list.length) return null;
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' ? <IconCheck size={14} /> : <IconX size={14} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
