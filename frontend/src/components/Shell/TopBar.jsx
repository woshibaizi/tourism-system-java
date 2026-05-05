import React from 'react';
import { Menu } from 'lucide-react';
import { clsx } from 'clsx';

export default function TopBar({ onMenuClick, className }) {
  return (
    <header
      className={clsx(
        'flex justify-between items-center px-6 py-4 w-full bg-white/80 backdrop-blur-md fixed top-0 z-50 border-b border-neutral-100',
        className
      )}
    >
      <div className="font-serif text-xl tracking-[0.3em] font-light text-neutral-900">
        VOYAGE
      </div>
      <button
        onClick={onMenuClick}
        className="text-neutral-900 hover:text-neutral-600 transition-colors"
      >
        <Menu size={24} />
      </button>
    </header>
  );
}
