import React from 'react';
import { clsx } from 'clsx';

export default function LogoText({ variant = 'default', className }) {
  if (variant === 'compact') {
    return (
      <span className={clsx('font-serif text-xl font-bold tracking-[0.05em] text-heading', className)}>
        邮
      </span>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={clsx('flex items-center gap-2 select-none', className)}>
        <span className="font-serif text-lg font-bold tracking-[0.05em] text-heading">邮迹</span>
        <span className="text-[9px] tracking-[0.3em] text-muted uppercase pt-0.5">Youji</span>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col items-center select-none', className)}>
      <span className="font-serif text-2xl font-bold tracking-[0.05em] text-heading leading-tight">
        邮迹
      </span>
      <span className="text-[10px] tracking-[0.3em] text-muted uppercase mt-1">
        Youji
      </span>
    </div>
  );
}
