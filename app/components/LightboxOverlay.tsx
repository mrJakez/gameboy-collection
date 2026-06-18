"use client";

import { useEffect, useRef, useCallback, ReactNode } from "react";

export function LightboxChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function LightboxChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface LightboxOverlayProps {
  srcs: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  header?: ReactNode;    // centered info shown below the button row (date, filename, etc.)
  actions?: ReactNode;   // action buttons shown left of the close button (top-right)
  bottomBar?: ReactNode; // full custom bottom bar
  pixelated?: boolean;
  imgStyle?: React.CSSProperties;
}

export default function LightboxOverlay({
  srcs, index, onClose, onIndexChange,
  header, actions, bottomBar, pixelated, imgStyle,
}: LightboxOverlayProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const axis = useRef<"h" | "v" | null>(null);
  const prevIndex = useRef(index);

  // Slide-in animation on index change
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const prev = prevIndex.current;
    prevIndex.current = index;
    const dir = index > prev ? "left" : index < prev ? "right" : null;
    const isTouch = !window.matchMedia("(pointer: fine)").matches;
    if (dir && isTouch) {
      const from = dir === "left" ? window.innerWidth : -window.innerWidth;
      img.style.transition = "none";
      img.style.transform = `translateX(${from}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        img.style.transition = "transform 0.22s ease-out";
        img.style.transform = "translate(0px,0px)";
      }));
    } else {
      img.style.transition = "none";
      img.style.transform = "translate(0px,0px)";
    }
  }, [index]);

  // Scroll lock — iOS-safe: position:fixed + restore scroll position on close
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "ArrowDown") { onClose(); return; }
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < srcs.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, srcs.length, onClose, onIndexChange]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
    axis.current = null;
    if (imgRef.current) {
      imgRef.current.style.transition = "none";
      imgRef.current.style.transform = "translate(0px,0px)";
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchX.current === null || touchY.current === null || !imgRef.current) return;
    const dx = e.touches[0].clientX - touchX.current;
    const dy = e.touches[0].clientY - touchY.current;
    if (!axis.current) {
      if (Math.abs(dy) > Math.abs(dx) + 5) axis.current = "v";
      else if (Math.abs(dx) > Math.abs(dy) + 5) axis.current = "h";
      else return;
    }
    if (axis.current === "v") {
      imgRef.current.style.transform = `translateY(${dy > 0 ? dy : dy * 0.2}px)`;
    } else {
      const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === srcs.length - 1);
      imgRef.current.style.transform = `translateX(${atEdge ? dx * 0.2 : dx}px)`;
    }
  }, [index, srcs.length]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchX.current === null || !imgRef.current) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = e.changedTouches[0].clientY - (touchY.current ?? 0);
    touchX.current = null; touchY.current = null;
    const a = axis.current; axis.current = null;
    const img = imgRef.current;
    img.style.transition = "transform 0.22s ease-out";
    if (a === "v" && dy > 80) {
      img.style.transform = `translateY(${window.innerHeight}px)`;
      setTimeout(onClose, 220);
    } else if (a === "h" && dx < -60 && index < srcs.length - 1) {
      img.style.transform = `translateX(-${window.innerWidth}px)`;
      setTimeout(() => onIndexChange(index + 1), 220);
    } else if (a === "h" && dx > 60 && index > 0) {
      img.style.transform = `translateX(${window.innerWidth}px)`;
      setTimeout(() => onIndexChange(index - 1), 220);
    } else {
      img.style.transform = "translate(0px,0px)";
    }
  }, [index, srcs.length, onClose, onIndexChange]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={onClose}>
      {/* Top-right: actions + close */}
      <div className="absolute top-0 right-0 flex items-center z-10 p-1" onClick={e => e.stopPropagation()}>
        {actions}
        <button
          onClick={onClose}
          className="p-5 sm:p-2 text-zinc-400 hover:text-zinc-100 text-xl leading-none"
        >✕</button>
      </div>
      {/* Centered header info */}
      {header && (
        <div className="shrink-0 pt-3 pb-1 px-16 text-center" onClick={e => e.stopPropagation()}>
          {header}
        </div>
      )}

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {index > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onIndexChange(index - 1); }}
            className="absolute left-0 inset-y-0 w-32 flex items-center justify-start pl-4 text-zinc-500 hover:text-zinc-100 transition-colors hidden sm:flex"
          >
            <LightboxChevronLeft />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={srcs[index]}
          alt={`Image ${index + 1}`}
          className="max-h-full max-w-full object-contain rounded-sm"
          style={{
            ...(pixelated ? { imageRendering: "pixelated" } : {}),
            touchAction: "none",
            willChange: "transform",
            ...imgStyle,
          }}
          onClick={e => e.stopPropagation()}
          draggable={false}
          onContextMenu={e => e.preventDefault()}
        />
        {index < srcs.length - 1 && (
          <button
            onClick={e => { e.stopPropagation(); onIndexChange(index + 1); }}
            className="absolute right-0 inset-y-0 w-32 flex items-center justify-end pr-4 text-zinc-500 hover:text-zinc-100 transition-colors hidden sm:flex"
          >
            <LightboxChevronRight />
          </button>
        )}
      </div>

      {bottomBar && <div onClick={e => e.stopPropagation()}>{bottomBar}</div>}
    </div>
  );
}
