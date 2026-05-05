import React, { useState } from 'react';
import { clsx } from 'clsx';
import { PLACEHOLDER_IMAGE } from '../../utils/constants';

export default function LazyImage({ src, alt, className, containerClassName }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={clsx('overflow-hidden bg-surface-container', containerClassName)}>
      <img
        src={error ? PLACEHOLDER_IMAGE : src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={clsx(
          'w-full h-full object-cover transition-all duration-700',
          loaded ? 'opacity-100' : 'opacity-0 blur-sm',
          className
        )}
      />
    </div>
  );
}
