import React from 'react';
import { clsx } from 'clsx';

export default function SectionLabel({ children, className }) {
  return (
    <span className={clsx('block font-sans text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-2', className)}>
      {children}
    </span>
  );
}
