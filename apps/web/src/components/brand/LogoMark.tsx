'use client';

import Image from 'next/image';

type Props = {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export function LogoMark({ size = 32, className, alt = 'SoulForge', priority = false }: Props) {
  return (
    <Image
      src="/brand/logo.svg"
      alt={alt}
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
