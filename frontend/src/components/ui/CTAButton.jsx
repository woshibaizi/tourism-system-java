import React from 'react';
import { clsx } from 'clsx';

const variants = {
  primary: 'bg-heading text-white hover:bg-heading/90 shadow-sm',
  secondary: 'bg-surface text-heading border border-border hover:bg-accent-soft hover:border-accent/20',
  ghost: 'bg-transparent text-heading hover:bg-accent-soft',
  outline: 'bg-transparent text-white border border-white/80 hover:bg-white hover:text-heading',
  accent: 'bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shadow-sm',
};

const sizes = {
  sm: 'px-4 py-2 text-xs tracking-wide',
  md: 'px-6 py-3 text-sm tracking-wide',
  lg: 'px-10 py-4 text-base tracking-wide',
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
        'font-sans font-semibold transition-all duration-300 rounded-lg cursor-pointer btn-press',
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
