import React from 'react';
import { clsx } from 'clsx';
import CTAButton from './CTAButton';

export default function EmptyState({
  icon: Icon,
  title = '暂无数据',
  description,
  action,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && <Icon size={48} className="text-muted mb-4" strokeWidth={1} />}
      <h3 className="font-serif text-xl text-heading mb-2">{title}</h3>
      {description && <p className="font-sans text-sm text-muted max-w-md">{description}</p>}
      {actionLabel && onAction && (
        <CTAButton variant="secondary" size="sm" className="mt-6" onClick={onAction}>
          {actionLabel}
        </CTAButton>
      )}
    </div>
  );
}
