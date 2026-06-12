import React from 'react';

/**
 * 单点/多点切换控件 (Segmented Control 风格)
 */
export default function PointModeToggle({ value, onChange, className = '' }) {
  const options = [
    { key: 'single', label: '单点导航' },
    { key: 'multi', label: '多点导航' },
  ];

  return (
    <div className={`inline-flex border border-border rounded-sm overflow-hidden ${className}`}>
      {options.map((opt, i) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-4 py-1.5 text-xs font-sans transition-colors ${
            i > 0 ? 'border-l border-border' : ''
          } ${
            value === opt.key
              ? 'bg-heading text-white'
              : 'bg-surface text-muted hover:text-heading'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
