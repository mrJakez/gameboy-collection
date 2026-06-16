"use client";

import { useEffect, useState } from "react";

export default function AddGameButton() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setAuthenticated(d.authenticated));
  }, []);

  if (!authenticated) return null;

  return (
    <a
      href="/games/new"
      className="flex items-center gap-1.5 px-2.5 sm:px-4 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium text-zinc-200 transition-colors border border-zinc-700"
    >
      <span>+</span>
      <span className="hidden sm:inline">Add game</span>
    </a>
  );
}
