'use client';

import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded-[var(--radius-sm)]',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-[var(--radius-md)]',
  };

  const defaultHeight = variant === 'text' ? '1em' : variant === 'circular' ? width : '100%';

  return (
    <div
      className={`
        skeleton
        ${variantStyles[variant]}
        ${className}
      `}
      style={{
        width: width ?? '100%',
        height: height ?? defaultHeight,
        ...style,
      }}
      {...props}
    />
  );
}

// Convenience components for common skeletons
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height="1rem"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        p-4
        bg-[var(--color-surface)]
        border border-[var(--color-border)]
        rounded-[var(--radius-lg)]
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton variant="text" height="1.25rem" width="60%" />
          <Skeleton variant="text" height="0.875rem" width="40%" className="mt-2" />
        </div>
      </div>
      <div className="mt-4">
        <SkeletonText lines={2} />
      </div>
      <div className="flex gap-2 mt-4">
        <Skeleton variant="rounded" width={60} height={24} />
        <Skeleton variant="rounded" width={60} height={24} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div
      className={`
        grid
        grid-cols-1 md:grid-cols-2 lg:grid-cols-3
        gap-4
        ${className}
      `}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
