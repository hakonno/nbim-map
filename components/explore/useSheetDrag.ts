"use client";

import { useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const DISMISS_THRESHOLD_PX = 120;

/**
 * Drag-to-dismiss for mobile bottom sheets. The grab handle becomes a real,
 * honest affordance: drag the sheet down past a threshold to close it. Upward
 * drag is resisted so the sheet feels anchored.
 */
export function useSheetDrag(onClose: () => void) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef(0);
  const startY = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const set = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const onPointerDown = (event: React.PointerEvent) => {
    startY.current = event.clientY;
    draggingRef.current = true;
    setIsDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current || startY.current == null) return;
    const delta = event.clientY - startY.current;
    set(delta > 0 ? delta : delta * 0.25);
  };

  const end = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    startY.current = null;
    if (offsetRef.current > DISMISS_THRESHOLD_PX) {
      onClose();
    }
    set(0);
  };

  return {
    offset,
    sheetStyle: {
      transform: offset ? `translateY(${offset}px)` : undefined,
      transition: isDragging ? "none" : "transform 0.25s ease-out",
    } as React.CSSProperties,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
