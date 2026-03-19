import { useMemo } from "react";
import { refreshAll } from "../lib/commands";
import { useAccounts } from "../hooks/useAccounts";
import { AccountRow } from "./AccountRow";
import { useState } from "react";

interface AccountListProps {
  onOpenSettings: () => void;
}

export function AccountList({ onOpenSettings }: AccountListProps) {
  const { accounts, error, loading, refresh } = useAccounts();
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const lastUpdated = useMemo(() => {
    const timestamps = accounts
      .map((account) => account.last_fetched)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(Math.max(...timestamps));
  }, [accounts]);

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return "Last updated: Never";
    }

    const diffMinutes = Math.round((Date.now() - lastUpdated.getTime()) / 60_000);
    if (diffMinutes <= 1) {
      return "Last updated: Just now";
    }
    if (diffMinutes < 60) {
      return `Last updated: ${diffMinutes}m ago`;
    }

    return `Last updated: ${lastUpdated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }, [lastUpdated]);

  return (
    <div className="flex h-full flex-col">
      <header className="chrome-divider flex items-center justify-between border-b px-6 pb-5 pt-5">
        <div className="text-[22px] font-semibold tracking-[-0.05em] text-slate-900">
          FollowBar
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="flex h-8 w-8 items-center justify-center text-[#7b8aa5] transition hover:text-slate-700"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
            <path
              d="M10.7 3.2h2.6l.4 2.1c.5.1 1 .3 1.4.6l1.9-1.1 1.8 1.8-1.1 1.9c.3.4.5.9.6 1.4l2.1.4v2.6l-2.1.4c-.1.5-.3 1-.6 1.4l1.1 1.9-1.8 1.8-1.9-1.1c-.4.3-.9.5-1.4.6l-.4 2.1h-2.6l-.4-2.1c-.5-.1-1-.3-1.4-.6l-1.9 1.1-1.8-1.8 1.1-1.9c-.3-.4-.5-.9-.6-1.4l-2.1-.4v-2.6l2.1-.4c.1-.5.3-1 .6-1.4L5.8 6.6l1.8-1.8 1.9 1.1c.4-.3.9-.5 1.4-.6Z"
              fill="currentColor"
            />
            <circle cx="12" cy="12" r="3" fill="#fff" />
          </svg>
        </button>
      </header>

      <div className="scroll-area list-surface flex-1 overflow-y-auto py-1">
        {loading && accounts.length === 0 ? (
          <div className="mx-7 rounded-[18px] bg-white px-5 py-8 text-center text-sm title-muted">
            Loading your accounts...
          </div>
        ) : null}

        {!loading && accounts.length === 0 ? (
          <div className="mx-7 rounded-[18px] bg-white px-5 py-7 text-center">
            <div className="text-lg font-semibold text-slate-800">No accounts yet</div>
            <p className="mt-2 text-sm title-muted">
              Click the settings button to add your first profile and start tracking.
            </p>
          </div>
        ) : null}

        {accounts.length > 0 ? (
          <div className="divide-y divide-[#eceef4]">
            {accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="mx-7 mt-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-xs text-rose-500">
            {error}
          </div>
        ) : null}

        {refreshError ? (
          <div className="mx-7 mt-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-xs text-rose-500">
            {refreshError}
          </div>
        ) : null}
      </div>

      <footer className="chrome-divider flex items-center justify-between border-t px-6 py-3">
        <div className="text-[11px] font-medium text-[#aab6cb]">{lastUpdatedLabel}</div>
        <button
          type="button"
          onClick={async () => {
            try {
              const summary = await refreshAll();
              await refresh();
              setRefreshError(
                summary.failed_accounts.length > 0
                  ? summary.failed_accounts.join(" | ")
                  : null
              );
            } catch (err) {
              setRefreshError(err instanceof Error ? err.message : String(err));
            }
          }}
          className="text-[11px] font-medium text-[#2464e8] transition hover:text-[#215bc4]"
        >
          Refresh
        </button>
      </footer>
    </div>
  );
}
