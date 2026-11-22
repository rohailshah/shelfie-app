import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface PosterLightboxProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  hqUrl?: string;
  coverUrl?: string;
  fallbackUrl?: string;
  onClose: () => void;
}

export function PosterLightbox({
  isOpen,
  title,
  subtitle,
  hqUrl,
  coverUrl,
  fallbackUrl,
  onClose,
}: PosterLightboxProps) {
  const [stage, setStage] = useState<'hq' | 'cover' | 'fallback' | 'none'>('hq');

  useEffect(() => {
    if (!isOpen) return;
    if (hqUrl) setStage('hq');
    else if (coverUrl) setStage('cover');
    else if (fallbackUrl) setStage('fallback');
    else setStage('none');
  }, [isOpen, hqUrl, coverUrl, fallbackUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeSrc =
    stage === 'hq'
      ? hqUrl
      : stage === 'cover'
        ? coverUrl
        : stage === 'fallback'
          ? fallbackUrl
          : undefined;

  const handleError = () => {
    if (stage === 'hq' && coverUrl && coverUrl !== hqUrl) {
      setStage('cover');
    } else if (stage !== 'fallback' && fallbackUrl && fallbackUrl !== activeSrc) {
      setStage('fallback');
    } else {
      setStage('none');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} fullscreen poster`}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/92 p-4 sm:p-8"
    >
      {/* Close Button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close fullscreen poster"
        className="fixed right-4 top-4 sm:right-6 sm:top-6 z-[61] rounded-xl border border-[#2A2D37] bg-[#1B1D24] p-2.5 text-[#F1F2F6] hover:border-[#E87151] hover:bg-[#252731] transition cursor-pointer"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Poster Frame */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center max-w-[92vw]"
      >
        {activeSrc ? (
          <img
            src={activeSrc}
            alt={title}
            onError={handleError}
            className="max-h-[82vh] max-w-[92vw] rounded-2xl border border-[#2A2D37] bg-[#15161B] object-contain shadow-2xl"
          />
        ) : (
          <div className="flex h-64 w-52 items-center justify-center rounded-2xl border border-[#2A2D37] bg-[#1B1D24] px-4 text-center text-sm text-[#9397A5]">
            No high-resolution poster available
          </div>
        )}

        {/* Caption */}
        <div className="mt-4 text-center max-w-md">
          <p className="text-sm sm:text-base font-semibold text-[#F1F2F6]">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-[#9397A5]">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
