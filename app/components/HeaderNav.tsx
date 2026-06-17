"use client";

import { useState, useEffect, useRef } from "react";

const btnCls = "flex items-center gap-1.5 px-2.5 sm:px-4 h-10 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 bg-zinc-800 hover:bg-zinc-700";

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function HeaderNav() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [syncOverdue, setSyncOverdue] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(d => setAuthenticated(d.authenticated));
    fetch("/api/sync-status").then(r => r.json()).then(d => setSyncOverdue(d.overdue ?? false));
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function login() {
    setLoginLoading(true);
    setLoginError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoginLoading(false);
    if (res.ok) { setShowLogin(false); setPassword(""); window.location.reload(); }
    else setLoginError("Wrong password");
  }

  async function logout() {
    setMenuOpen(false);
    await fetch("/api/auth", { method: "DELETE" });
    window.location.reload();
  }

  const menuItemCls = "flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-left";

  return (
    <>
      {/* Always visible: Playtime + Screenshots */}
      <a href="/playtime" className={btnCls}>
        <ClockIcon />
        <span className="hidden sm:inline">Play Time</span>
      </a>
      <a href="/screenshots" className={btnCls}>
        <ImageIcon />
        <span className="hidden sm:inline">Screenshots</span>
      </a>

      {/* Desktop only: Add Game (authenticated) */}
      {authenticated && (
        <a href="/games/new" className="hidden sm:flex items-center gap-1.5 px-4 h-10 rounded-lg text-sm font-medium text-zinc-100 bg-zinc-700 border border-zinc-600 hover:bg-zinc-600 hover:border-zinc-500 transition-colors">
          <span>+</span>
          <span>Add game</span>
        </a>
      )}

      {/* Menu button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`${btnCls} relative`}
          aria-label="Menu"
        >
          <MenuIcon />
          {syncOverdue && authenticated && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-zinc-900" />
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
            {authenticated ? (
              <>
                {/* Mobile only: Add Game */}
                <a href="/games/new" className={`${menuItemCls} sm:hidden text-zinc-100 font-medium`}>
                  <span className="text-base leading-none">+</span>
                  Add game
                </a>
                <a href="/pocket-sync" className={menuItemCls} onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Pocket Sync
                  {syncOverdue && <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                </a>
                <a href="/api/export-excel" className={menuItemCls} onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="12" x2="12" y2="18" /><line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  Export
                </a>
                <div className="border-t border-zinc-700 mt-1 pt-1">
                  <button onClick={logout} className={menuItemCls}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => { setMenuOpen(false); setShowLogin(true); }} className={menuItemCls}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Login
              </button>
            )}
          </div>
        )}
      </div>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLogin(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-zinc-100">Admin Login</h2>
            <input
              type="password"
              placeholder="Password"
              value={password}
              autoFocus
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {loginError && <p className="text-xs text-red-400">{loginError}</p>}
            <div className="flex gap-2">
              <button onClick={login} disabled={loginLoading || !password}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-100 rounded-lg transition-colors">
                {loginLoading ? "…" : "Sign in"}
              </button>
              <button onClick={() => { setShowLogin(false); setPassword(""); setLoginError(""); }}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
