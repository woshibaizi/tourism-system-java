import React from 'react';
import { clsx } from 'clsx';

const variants = {
  primary: 'bg-black text-white border border-black hover:bg-neutral-800',
  secondary: 'bg-white text-black border border-black hover:bg-neutral-50',
  ghost: 'bg-transparent text-black border border-transparent hover:bg-neutral-100',
  outline: 'bg-transparent text-white border border-white/80 hover:bg-white hover:text-black',
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
