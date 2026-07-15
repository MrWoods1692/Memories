import type { InputHTMLAttributes } from 'react';

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function NumberInput({ value, onChange, min, max, className, ...props }: NumberInputProps) {
  const step = props.step ? Number(props.step) : 1;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) onChange(v);
  };

  const spin = (delta: number) => {
    const next = value + delta;
    if (min !== undefined && next < min) return;
    if (max !== undefined && next > max) return;
    onChange(next);
  };

  return (
    <div className={`num-input ${className || ''}`}>
      <input
        type="number"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        {...props}
      />
      <div className="num-spin">
        <button type="button" onClick={() => spin(step)} tabIndex={-1} aria-label="增加">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button type="button" onClick={() => spin(-step)} tabIndex={-1} aria-label="减少">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  );
}
