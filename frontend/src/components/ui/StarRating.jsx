import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';

export default function StarRating({
  value = 0,
  max = 5,
  size = 16,
  interactive = false,
  onChange,
  className,
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = interactive && hoverValue ? hoverValue : value;

  return (
    <div className={clsx('flex items-center gap-0.5', className)}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < displayValue;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={clsx(
              'transition-colors',
              interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default',
              filled ? 'text-amber-500' : 'text-gray-300'
            )}
            onMouseEnter={() => interactive && setHoverValue(i + 1)}
            onMouseLeave={() => interactive && setHoverValue(0)}
            onClick={() => {
              if (interactive && onChange) {
                onChange(i + 1);
                setHoverValue(0);
              }
            }}
          >
            <Star size={size} fill={filled ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}
