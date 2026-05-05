"use client"

import { useState } from "react"

export default function DisclaimerModal() {
  const [open, setOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("disclaimer_seen");
    }
    return true;
  });

  const handleClose = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("disclaimer_seen", "true");
    }
    setOpen(false);
  };

  // Always render the modal structure to avoid hydration mismatch
  // Use CSS to hide/show based on open state
  return (
    <div className={`fixed inset-0 z-[1050] flex items-center justify-center bg-black/50 pointer-events-none ${!open ? "hidden" : ""}`}>
      <div className="bg-white rounded-2xl p-6 max-w-md shadow-xl pointer-events-auto">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          ⚠️ Early version
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
            Last updated: April 2026
          </span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This app is under active development and may contain errors or incomplete data.
          Financial figures and property data are sourced from third-party sources and may not be accurate.
        </p>
        <button
          onClick={handleClose}
          className="w-full bg-black text-white py-2 rounded-xl"
        >
          Got it
        </button>
      </div>
    </div>
  );
}