import { useEffect, useRef, useState } from 'react';
import { ContainerNode } from '../engine/types';
import { MEDIUM_LABELS } from './mediaMeta';

interface PosterArtProps {
  container: ContainerNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function PosterArt({ container, size = 'md', className = '' }: PosterArtProps) {
  const [imgStage, setImgStage] = useState<'primary' | 'fallback' | 'none'>(
    container.coverUrl ? 'primary' : container.fallbackCoverUrl ? 'fallback' : 'none'
  );
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgStage(
      container.coverUrl ? 'primary' : container.fallbackCoverUrl ? 'fallback' : 'none'
    );
  }, [container.coverUrl, container.fallbackCoverUrl]);

  const sizeClasses = {
    xs: 'w-9 h-12 rounded-lg',
    sm: 'w-14 h-20 rounded-xl',
    md: 'w-20 h-28 sm:w-24 sm:h-34 rounded-2xl',
    lg: 'w-28 h-40 sm:w-32 sm:h-46 rounded-2xl',
  }[size];

  const monogramClasses = {
    xs: 'text-[10px] tracking-wider',
    sm: 'text-sm tracking-wider',
    md: 'text-lg sm:text-xl tracking-wider',
    lg: 'text-2xl sm:text-3xl tracking-wider',
  }[size];

  const activeImgSrc =
    imgStage === 'primary'
      ? container.coverUrl
      : imgStage === 'fallback'
        ? container.fallbackCoverUrl
        : undefined;

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImgLoaded(true);
    } else {
      setImgLoaded(false);
    }
  }, [activeImgSrc]);

  const handleImgError = () => {
    setImgLoaded(false);
    if (imgStage === 'primary' && container.fallbackCoverUrl) {
      setImgStage('fallback');
    } else {
      setImgStage('none');
    }
  };

  if (activeImgSrc) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border border-[#2A2D37] bg-[#252731] select-none ${sizeClasses} ${className}`}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 bg-[#252731] animate-pulse" />
        )}
        <img
          ref={imgRef}
          src={activeImgSrc}
          alt={container.title}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {size !== 'xs' && (
          <div className="absolute inset-x-0 bottom-0 border-t border-[#2A2D37] bg-[#111216]/90 px-2 py-1">
            <span
              title={container.kindLabel}
              className="block truncate text-[9px] font-semibold uppercase tracking-wider text-[#F1F2F6]"
            >
              {container.kindLabel}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-[#303340] bg-[#252731] select-none flex flex-col justify-between ${sizeClasses} ${className}`}
    >
      {/* Flat solid top accent bar (zero gradients) */}
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: container.accentFrom }}
      />

      {size !== 'sm' && size !== 'xs' && (
        <div className="px-2 pt-1.5">
          <span className="inline-flex items-center gap-1 rounded-md border border-[#303340] bg-[#1B1D24] px-1.5 py-0.5 text-[10px] font-medium text-[#9397A5]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: container.accentFrom }}
            />
            {MEDIUM_LABELS[container.medium]}
          </span>
        </div>
      )}

      {/* Center crisp monogram */}
      <div className="flex flex-1 items-center justify-center px-1">
        <span className={`font-bold text-[#F1F2F6] ${monogramClasses}`}>
          {container.monogram}
        </span>
      </div>

      {/* Flat bottom kind label */}
      {size !== 'xs' && (
        <div className="border-t border-[#303340] bg-[#1B1D24] px-2 py-1">
          <span
            title={container.kindLabel}
            className="block truncate text-[10px] font-semibold uppercase tracking-wider text-[#9397A5]"
          >
            {container.kindLabel}
          </span>
        </div>
      )}
    </div>
  );
}
