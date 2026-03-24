import { useMemo, useState } from "react";
import { refreshAll } from "../lib/commands";
import { useAccounts } from "../hooks/useAccounts";
import { useI18n } from "../lib/i18n";
import { AppIconMark } from "./AppIconMark";
import { AccountRow } from "./AccountRow";

interface AccountListProps {
  onOpenSettings: () => void;
  onOpenAddAccount: () => void;
  onOpenAccount: (accountId: string) => void;
}

function lastUpdatedLabel(
  isoValues: Array<string | null>,
  t: (key: "last_updated_never" | "last_updated_just_now" | "last_updated_minutes" | "last_updated_time", vars?: Record<string, string | number>) => string
) {
  const timestamps = isoValues
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return t("last_updated_never");
  }

  const lastUpdated = new Date(Math.max(...timestamps));
  const diffMinutes = Math.round((Date.now() - lastUpdated.getTime()) / 60_000);
  if (diffMinutes <= 1) {
    return t("last_updated_just_now");
  }
  if (diffMinutes < 60) {
    return t("last_updated_minutes", { minutes: diffMinutes });
  }

  return t("last_updated_time", {
    time: lastUpdated.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  });
}

export function AccountList({
  onOpenSettings,
  onOpenAddAccount,
  onOpenAccount,
}: AccountListProps) {
  const { t } = useI18n();
  const { accounts, error, loading, refresh } = useAccounts();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const footerLabel = useMemo(() => {
    if (isRefreshing) {
      return t("refreshing_accounts");
    }
    if (refreshSummary) {
      return refreshSummary;
    }
    return lastUpdatedLabel(accounts.map((account) => account.last_fetched), t);
  }, [accounts, isRefreshing, refreshSummary, t]);

  return (
    <div className="screen-shell">
      <header className="top-bar">
        <div className="top-bar-brand stitch-brand">
          <div className="stitch-brand-icon" aria-hidden="true">
            <AppIconMark className="h-5 w-5" />
          </div>
          <div className="top-bar-title display">{t("app_name")}</div>
        </div>
        <div className="top-bar-actions">
          <button
            type="button"
            onClick={onOpenAddAccount}
            aria-label={t("add_account")}
            className="icon-button"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
              <path
                d="M10 4.25c.414 0 .75.336.75.75v4.25H15c.414 0 .75.336.75.75s-.336.75-.75.75h-4.25V15c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-4.25H5c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h4.25V5c0-.414.336-.75.75-.75Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t("settings")}
            className="icon-button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
              <path
                d="M10.7 3.2h2.6l.4 2.1c.5.1 1 .3 1.4.6l1.9-1.1 1.8 1.8-1.1 1.9c.3.4.5.9.6 1.4l2.1.4v2.6l-2.1.4c-.1.5-.3 1-.6 1.4l1.1 1.9-1.8 1.8-1.9-1.1c-.4.3-.9.5-1.4.6l-.4 2.1h-2.6l-.4-2.1c-.5-.1-1-.3-1.4-.6l-1.9 1.1-1.8-1.8 1.1-1.9c-.3-.4-.5-.9-.6-1.4l-2.1-.4v-2.6l2.1-.4c.1-.5.3-1 .6-1.4L5.8 6.6l1.8-1.8 1.9 1.1c.4-.3.9-.5 1.4-.6Z"
                fill="currentColor"
              />
              <circle cx="12" cy="12" r="3" fill="white" />
            </svg>
          </button>
        </div>
      </header>

      <main className="screen-content screen-content-list">
        {loading && accounts.length === 0 ? (
          <div className="empty-state-card">{t("loading_accounts")}</div>
        ) : null}

        {!loading && accounts.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-title">{t("no_accounts")}</div>
            <p className="empty-state-copy">
              {t("no_accounts_copy")}
            </p>
            <button type="button" onClick={onOpenAddAccount} className="primary-button mt-4">
              {t("add_account")}
            </button>
          </div>
        ) : null}

        {accounts.length > 0 ? (
          <div className="account-list-stack flat refined">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                expanded={expandedAccountId === account.id}
                onToggleExpand={() => {
                  setExpandedAccountId((current) => (current === account.id ? null : account.id));
                }}
                onOpenEdit={() => onOpenAccount(account.id)}
                onRefreshList={refresh}
              />
            ))}
          </div>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
        {refreshError ? <div className="error-banner">{refreshError}</div> : null}
      </main>

      <footer className="bottom-bar refined">
        <div className="bottom-bar-caption">{footerLabel}</div>
        <div className="bottom-bar-actions">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={async () => {
              setIsRefreshing(true);
              setRefreshSummary(null);
              try {
                const summary = await refreshAll();
                await refresh();
                const nextError =
                  summary.failed_accounts.length > 0
                    ? summary.failed_accounts.join(" | ")
                    : null;
                setRefreshError(nextError);
                setRefreshSummary(
                  summary.failed_accounts.length > 0
                    ? t("refresh_summary_failed", {
                        refreshed: summary.refreshed_accounts,
                        skipped: summary.skipped_accounts,
                        failed: summary.failed_accounts.length,
                      })
                    : t("refresh_summary", {
                        refreshed: summary.refreshed_accounts,
                        skipped: summary.skipped_accounts,
                      })
                );
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                setRefreshError(message);
                setRefreshSummary(null);
              } finally {
                setIsRefreshing(false);
              }
            }}
            className="refresh-button compact"
          >
            {t("refresh")}
          </button>
        </div>
      </footer>
    </div>
  );
}
