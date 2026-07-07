"use client";

import { useEffect, useId, useRef, useState } from "react";

type PopoverProps = {
  /** Rendered inside the trigger button. */
  trigger: React.ReactNode;
  /** Accessible label for the trigger. */
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
  panelClassName?: string;
};

export default function Popover({
  trigger,
  label,
  children,
  align = "left",
  triggerClassName = "",
  panelClassName = "",
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
