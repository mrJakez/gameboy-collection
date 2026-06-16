"use client";

import { useEffect, useState } from "react";

export default function SyncWarningBanner() {
  const [syncedAt, setSyncedAt] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/sync-status")
      .then((r) => r.json())
      .then((d) => setSyncedAt(d.syncedAt ?? null));
  }, []);

  if (syncedAt === undefined) return null;

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const isOverdue = syncedAt === null || new Date(syncedAt) < twoMonthsAgo;
  if (!isOverdue) return null;

  const dateLabel = syncedAt
    ? new Date(syncedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const daysAgo = syncedAt
    ? Math.floor((Date.now() - new Date(syncedAt).getTime()) / 86_400_000)
    : null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-amber-300">
          {syncedAt === null
            ? "No Pocket Sync performed yet"
            : `Last Pocket Sync was ${daysAgo} days ago`}
        </span>
        {dateLabel && (
          <span className="ml-2 text-xs text-amber-400/70">Last import: {dateLabel}</span>
        )}
      </div>
      <a
        href="/pocket-sync"
        className="shrink-0 rounded-md border border-amber-500/40 px-3 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
      >
        Sync now →
      </a>
    </div>
  );
}
