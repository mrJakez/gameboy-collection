"use client";

import { useState, useEffect } from "react";

export default function AuthButton() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((d) => setAuthenticated(d.authenticated));
  }, []);

  async function login() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      setShowModal(false);
      setPassword("");
      window.location.reload();
    } else {
      setError("Wrong password");
    }
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.reload();
  }

  if (authenticated === null) return null;

  return (
    <>
      {authenticated ? (
        <button
          onClick={logout}
          className="px-2.5 sm:px-4 h-10 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          Logout
        </button>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="px-2.5 sm:px-4 h-10 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          Login
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-100">Admin Login</h2>
            <input
              type="password"
              placeholder="Password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={login}
                disabled={loading || !password}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-sm text-zinc-100 rounded-lg transition-colors"
              >
                {loading ? "…" : "Sign in"}
              </button>
              <button
                onClick={() => { setShowModal(false); setPassword(""); setError(""); }}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
