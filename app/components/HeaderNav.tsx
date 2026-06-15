"use client";

import { useState, useEffect } from "react";

const btnCls = "flex items-center gap-1.5 px-2.5 sm:px-4 h-10 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export default function HeaderNav() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setAuthenticated(d.authenticated));
  }, []);

  return (
    <>
      <a href="/playtime" className={btnCls}>
        <ClockIcon />
        <span className="hidden sm:inline">Play Time</span>
      </a>
      {authenticated && (
        <>
          <a href="/pocket-sync" className={`${btnCls} hidden sm:flex`}>
            <UploadIcon />
            <span className="hidden sm:inline">Pocket Sync</span>
          </a>
          <a href="/api/export-excel" className={`${btnCls} hidden sm:flex`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </a>
        </>
      )}
    </>
  );
}
