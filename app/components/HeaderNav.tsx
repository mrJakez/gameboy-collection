"use client";

import { useState, useEffect } from "react";

export default function HeaderNav() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setAuthenticated(d.authenticated));
  }, []);

  return (
    <>
      <a
        href="/playtime"
        className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
      >
        <span className="sm:hidden">⏱</span>
        <span className="hidden sm:inline">⏱ Play Time</span>
      </a>
      {authenticated && (
        <a
          href="/pocket-sync"
          className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
          title="Pocket Sync"
        >
          <span className="sm:hidden">🔄</span>
          <span className="hidden sm:inline">🔄 Pocket Sync</span>
        </a>
      )}
    </>
  );
}
