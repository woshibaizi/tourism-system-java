import React from 'react';
import { clsx } from 'clsx';

export default function LineInput({
  icon: Icon,
  className,
  containerClassName,
  ...props
}) {
  return (
    <div className={clsx('relative', containerClassName)}>
      {Icon && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted">
          <Icon size={18} />
        </span>
      )}
      <input
        className={clsx(
          'w-full bg-transparent border-0 border-b border-border py-4 font-sans text-body',
          'focus:border-b-2 focus:border-black focus:ring-0 focus:outline-none',
          'placeholder:text-muted transition-colors',
          Icon && 'pl-10',
          className
        )}
        {...props}
      />
    </div>
  );
}
