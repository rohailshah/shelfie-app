import { useEffect, useRef, useState } from 'react';
import { Medium } from '../engine/types';
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';

interface CoverThumbProps {
  title: string;
  medium: Medium;
  coverUrl?: string;
  fallbackCoverUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'SHF';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function CoverThumb({
  title,
  medium,
  coverUrl,
  fallbackCoverUrl,
  size = 'sm',
  className = '',
}: CoverThumbProps) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'none'>(
    coverUrl ? 'primary' : fallbackCoverUrl ? 'fallback' : 'none'
  );
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setStage(coverUrl ? 'primary' : fallbackCoverUrl ? 'fallback' : 'none');
  }, [coverUrl, fallbackCoverUrl]);

  const sizeClasses = {
    xs: 'w-9 h-12 rounded-lg',
    sm: 'w-12 h-16 rounded-xl',
    md: 'w-20 h-28 rounded-xl',
    lg: 'w-24 h-34 sm:w-28 sm:h-40 rounded-2xl',
  }[size];

  const src =
    stage === 'primary'
      ? coverUrl
      : stage === 'fallback'
        ? fallbackCoverUrl
        : undefined;

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    } else {
      setImgLoaded(false);
    }
  }, [src]);

  const handleError = () => {
    setImgLoaded(false);
    if (stage === 'primary' && fallbackCoverUrl && fallbackCoverUrl !== coverUrl) {
      setStage('fallback');
    } else {
      setStage('none');
    }
  };

  if (src) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-[#2A2D37] bg-[#252731] ${sizeClasses} ${className}`}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 bg-[#252731] animate-pulse" />
        )}
        <img
          ref={imgRef}
          src={src}
          alt={title}
          onLoad={() => setImgLoaded(true)}
          onError={handleError}
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />
      </div>
    );
  }

  const accent = MEDIUM_COLORS[medium];
  return (
    <div
      className={`shrink-0 overflow-hidden border border-[#303340] bg-[#252731] flex flex-col justify-between ${sizeClasses} ${className}`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-1 items-center justify-center px-1">
        <span className="text-[11px] font-bold tracking-wider text-[#F1F2F6]">
          {getInitials(title)}
        </span>
      </div>
      {size !== 'xs' && (
        <div className="border-t border-[#303340] bg-[#1B1D24] px-1.5 py-0.5 text-center">
          <span className="block truncate text-[9px] font-semibold uppercase text-[#9397A5]">
            {MEDIUM_LABELS[medium]}
          </span>
        </div>
      )}
    </div>
  );
}
