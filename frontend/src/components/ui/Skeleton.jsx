import React from 'react';
import { clsx } from 'clsx';

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded-sm animate-pulse"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={clsx('animate-pulse', className)}>
      <div className="aspect-[3/4] bg-gray-200 rounded-sm mb-6" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded-sm w-1/3" />
        <div className="h-6 bg-gray-200 rounded-sm w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonImage({ aspectRatio = 'aspect-video', className }) {
  return (
    <div className={clsx('bg-gray-200 rounded-sm animate-pulse', aspectRatio, className)} />
  );
}

export default function Skeleton({ type = 'text', ...props }) {
  if (type === 'card') return <SkeletonCard {...props} />;
  if (type === 'image') return <SkeletonImage {...props} />;
  return <SkeletonText {...props} />;
}
