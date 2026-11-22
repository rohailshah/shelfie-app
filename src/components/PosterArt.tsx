import { ContainerNode } from '../engine/types';
import { MEDIUM_LABELS } from './mediaMeta';

interface PosterArtProps {
  container: ContainerNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PosterArt({ container, size = 'md', className = '' }: PosterArtProps) {
  const sizeClasses = {
    sm: 'w-14 h-20 rounded-xl',
    md: 'w-20 h-28 sm:w-24 sm:h-34 rounded-2xl',
    lg: 'w-28 h-40 sm:w-32 sm:h-46 rounded-2xl',
  }[size];

  const monogramClasses = {
    sm: 'text-sm tracking-wider',
    md: 'text-xl sm:text-2xl tracking-wider',
    lg: 'text-2xl sm:text-3xl tracking-wider',
  }[size];

  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/15 shadow-lg select-none ${sizeClasses} ${className}`}
      style={{
        background: `radial-gradient(120% 100% at 15% 10%, ${container.accentFrom}cc 0%, ${container.accentTo} 68%, #09090B 100%)`,
      }}
    >
      {/* Subtle editorial grid / glass sheen */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 45%, rgba(0,0,0,0.45) 100%)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-white/30" />

      {/* Top badge */}
      {size !== 'sm' && (
        <div className="relative z-10 flex items-center justify-between px-2 pt-2">
          <span className="inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur-md border border-white/10">
            {MEDIUM_LABELS[container.medium]}
          </span>
        </div>
      )}

      {/* Center stylized monogram */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`font-extrabold text-white/90 drop-shadow-[0_4px_14px_rgba(0,0,0,0.65)] ${monogramClasses}`}
        >
          {container.monogram}
        </span>
      </div>

      {/* Bottom kind label */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 pb-1.5 pt-4">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-white/85">
          {container.kindLabel}
        </span>
      </div>
    </div>
  );
}
