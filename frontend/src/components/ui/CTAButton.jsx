import React from 'react';
import { clsx } from 'clsx';

const variants = {
  primary: 'bg-heading text-white border border-heading hover:bg-neutral-800',
  secondary: 'bg-surface text-heading border border-border hover:bg-accent-soft',
  ghost: 'bg-transparent text-heading border border-transparent hover:bg-accent-soft',
  outline: 'bg-transparent text-white border border-white/80 hover:bg-white hover:text-heading',
  accent: 'bg-accent text-white border border-accent hover:opacity-90 active:scale-[0.98]',
};

const sizes = {
  sm: 'px-4 py-2 text-xs tracking-widest',
  md: 'px-6 py-3 text-sm tracking-widest',
  lg: 'px-10 py-4 text-sm tracking-[0.3em]',
};

export default function CTAButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  return (
    <button
      className={clsx(
        'uppercase font-sans font-medium transition-all duration-300 rounded-sm cursor-pointer',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
