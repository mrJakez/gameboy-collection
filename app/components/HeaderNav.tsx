"use client";

import { useState, useEffect } from "react";

const btnCls = "flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

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
        <a href="/pocket-sync" className={btnCls}>
          <UploadIcon />
          <span className="hidden sm:inline">Pocket Sync</span>
        </a>
      )}
    </>
  );
}
