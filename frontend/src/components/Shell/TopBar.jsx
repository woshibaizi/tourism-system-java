import React from 'react';
import { Menu } from 'lucide-react';
import { clsx } from 'clsx';
import LogoText from '../ui/LogoText';

export default function TopBar({ onMenuClick, className }) {
  return (
    <header
      className={clsx(
        'flex justify-between items-center px-6 py-4 w-full bg-surface/80 backdrop-blur-md fixed top-0 z-50 border-b border-border',
        className
      )}
    >
      <LogoText variant="horizontal" />
      <button
        onClick={onMenuClick}
        className="text-heading hover:text-accent transition-colors"
      >
        <Menu size={24} />
      </button>
    </header>
  );
}
