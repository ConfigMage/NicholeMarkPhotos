"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UploadRow } from "@/lib/types";
import { downloadUrl, publicUrl } from "@/lib/storage";

interface LightboxProps {
  items: UploadRow[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}

export default function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: LightboxProps) {
  const item = items[index];
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    if (index > 0) onNavigate(index - 1);
  }, [index, onNavigate]);

  const goNext = useCallback(() => {
    if (index < items.length - 1) onNavigate(index + 1);
  }, [index, items.length, onNavigate]);

  // Keyboard navigation + lock background scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, goPrev, goNext]);

  if (!item) return null;

  const fileName = item.storage_path.replace(/^[^-]+-/, "");
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-charcoal/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 text-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm text-cream/80">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Media */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden px-2"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {item.media_type === "video" ? (
          <video
            key={item.id}
            src={publicUrl(item.storage_path)}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={publicUrl(item.storage_path)}
            alt={item.uploader_name ? `Shared by ${item.uploader_name}` : "Wedding photo"}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        )}

        {hasPrev && (
          <NavButton side="left" onClick={goPrev} ariaLabel="Previous" />
        )}
        {hasNext && (
          <NavButton side="right" onClick={goNext} ariaLabel="Next" />
        )}
      </div>

      {/* Footer: name + download */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 text-cream"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          {item.uploader_name ? (
            <p className="truncate font-serif text-lg">
              {item.uploader_name}
            </p>
          ) : (
            <p className="truncate font-serif text-lg text-cream/70">
              A guest
            </p>
          )}
        </div>
        <a
          href={downloadUrl(item.storage_path, fileName)}
          download={fileName}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-white"
        >
          <DownloadIcon className="h-4 w-4" />
          Download
        </a>
      </div>
    </div>
  );
}

function NavButton({
  side,
  onClick,
  ariaLabel,
}: {
  side: "left" | "right";
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-2" : "right-2"
      } flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-cream transition-colors hover:bg-white/25`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {side === "left" ? (
          <path d="m15 18-6-6 6-6" />
        ) : (
          <path d="m9 6 6 6-6 6" />
        )}
      </svg>
    </button>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 21h14" />
    </svg>
  );
}
