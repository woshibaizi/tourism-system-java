import React from 'react';
import { clsx } from 'clsx';
import { Image } from 'lucide-react';

const CHIPS = [
  { key: 'diary', label: '生成游记', icon: Image, action: 'diary' },
];

export default function QuickChips({ onSelect, onDiaryOpen, disabled }) {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto border-t border-border bg-surface flex-shrink-0 scrollbar-none">
      {CHIPS.map((chip) => {
        const Icon = chip.icon;
        const handleClick = () => {
          if (chip.action === 'diary') {
            onDiaryOpen?.();
          } else {
            onSelect(chip.message);
          }
        };
        return (
          <button
            key={chip.key}
            onClick={handleClick}
            disabled={disabled}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap',
              'border border-border bg-white text-muted hover:text-heading hover:border-accent hover:bg-accent-soft',
              'transition-colors flex-shrink-0',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Icon size={13} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
