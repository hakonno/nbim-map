"use client";

import { useEffect, useRef, useState } from "react";

type PropertyShareButtonProps = {
  /** Absolute URL to share (the property's page). */
  url: string;
  /** Human label used as the share-sheet title, e.g. the property name. */
  title: string;
  className?: string;
};

export default function PropertyShareButton({
  url,
  title,
  className = "",
}: PropertyShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const flashCopied = () => {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    // Prefer the native share sheet (mobile); fall back to clipboard.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Cancelling the share sheet rejects with AbortError — respect the
        // cancel rather than silently copying the link instead.
        if ((error as { name?: string })?.name === "AbortError") {
          return;
        }
        // A genuine share failure falls through to the clipboard copy below.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flashCopied();
    } catch {
      // Clipboard blocked (e.g. insecure context) — last-resort prompt.
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${title}`}
      title="Share"
      className={`inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 ${className}`}
    >
      {copied ? (
        <span className="text-emerald-600">Copied</span>
      ) : (
        <>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
            <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
          </svg>
          <span>Share</span>
        </>
      )}
    </button>
  );
}
