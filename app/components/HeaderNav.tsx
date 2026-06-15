"use client";

import { useState, useEffect } from "react";

const btnCls = "px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

export default function HeaderNav() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setAuthenticated(d.authenticated));
  }, []);

  return (
    <>
      <a href="/playtime" className={btnCls}>
        <span className="sm:hidden">⏱</span>
        <span className="hidden sm:inline">⏱ Play Time</span>
      </a>
      {authenticated && (
        <a href="/pocket-sync" className={btnCls}>
          <span className="sm:hidden">🔄</span>
          <span className="hidden sm:inline">🔄 Pocket Sync</span>
        </a>
      )}
    </>
  );
}
