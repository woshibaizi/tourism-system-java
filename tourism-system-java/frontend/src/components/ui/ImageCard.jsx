import React from 'react';
import { clsx } from 'clsx';
import LazyImage from './LazyImage';
import SectionLabel from './SectionLabel';

export default function ImageCard({
  image,
  label,
  title,
  subtitle,
  aspectRatio = 'aspect-[3/4]',
  onClick,
  className,
}) {
  return (
    <div className={clsx('group cursor-pointer', className)} onClick={onClick}>
      <div className={clsx('overflow-hidden mb-6 bg-surface-container', aspectRatio)}>
        <LazyImage
          src={image}
          alt={title || label}
          className="group-hover:scale-105 transition-transform duration-1000"
        />
      </div>
      <div className="border-b border-border pb-4">
        {label && <SectionLabel>{label}</SectionLabel>}
        {title && (
          <h3 className="font-serif text-2xl text-heading font-normal">{title}</h3>
        )}
        {subtitle && (
          <p className="font-sans text-sm text-muted mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
