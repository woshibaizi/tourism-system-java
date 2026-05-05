import React from 'react';
import { clsx } from 'clsx';

export default function ScrollRow({ children, className }) {
  return (
    <div
      className={clsx(
        'flex overflow-x-auto gap-8 pb-8 -mx-6 px-6 lg:mx-0 lg:px-0 no-scrollbar snap-x snap-mandatory',
        className
      )}
    >
      {children}
    </div>
  );
}
