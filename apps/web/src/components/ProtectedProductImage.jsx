import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Product image with casual download deterrence (no context menu / drag)
 * and consistent 1:1 contain presentation.
 */
const ProtectedProductImage = ({
  src,
  alt = '',
  className,
  imgClassName,
  aspect = 'square',
  ...rest
}) => {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-secondary/40 select-none',
        aspect === 'square' && 'aspect-square',
        className
      )}
      onContextMenu={stop}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onDragStart={stop}
        onContextMenu={stop}
        loading="lazy"
        decoding="async"
        className={cn(
          'h-full w-full object-contain pointer-events-none select-none',
          imgClassName
        )}
        style={{ WebkitUserDrag: 'none', userSelect: 'none' }}
        {...rest}
      />
    </div>
  );
};

export default ProtectedProductImage;
