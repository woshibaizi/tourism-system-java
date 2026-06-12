import React from 'react';
import { clsx } from 'clsx';

export default function SectionLabel({ children, className }) {
  return (
    <span className={clsx('block font-sans text-xs tracking-[0.1em] text-muted font-medium mb-2', className)}>
      {children}
    </span>
  );
}
