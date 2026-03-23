import { useMemo, useState } from "react";
import { refreshAll } from "../lib/commands";
import { useAccounts } from "../hooks/useAccounts";
import { useI18n } from "../lib/i18n";
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
            <svg viewBox="0 0 20 20" className="h-4 w-4">
              <path d="M2.8125 3.75C2.8125 3.05964 3.37214 2.5 4.0625 2.5H5.15625C5.84661 2.5 6.40625 3.05964 6.40625 3.75V16.25C6.40625 16.9404 5.84661 17.5 5.15625 17.5H4.0625C3.37214 17.5 2.8125 16.9404 2.8125 16.25V3.75Z" fill="currentColor"/>
              <path d="M4.53125 2.5H10.9375C11.6279 2.5 12.1875 3.05964 12.1875 3.75V4.84375C12.1875 5.53411 11.6279 6.09375 10.9375 6.09375H4.53125V2.5Z" fill="currentColor"/>
              <path d="M4.53125 10H9.6875C10.3779 10 10.9375 10.5596 10.9375 11.25V12.3438C10.9375 13.0341 10.3779 13.5938 9.6875 13.5938H4.53125V10Z" fill="currentColor"/>
              <path d="M13.2812 11.4062C13.2812 10.7159 13.8409 10.1562 14.5312 10.1562H14.6875C15.3779 10.1562 15.9375 10.7159 15.9375 11.4062V15C15.9375 15.6904 15.3779 16.25 14.6875 16.25H14.5312C13.8409 16.25 13.2812 15.6904 13.2812 15V11.4062Z" fill="currentColor"/>
              <path d="M16.875 9.84375C16.875 9.15339 17.4346 8.59375 18.125 8.59375H18.2812C18.9716 8.59375 19.5312 9.15339 19.5312 9.84375V15C19.5312 15.6904 18.9716 16.25 18.2812 16.25H18.125C17.4346 16.25 16.875 15.6904 16.875 15V9.84375Z" fill="currentColor"/>
              <path d="M20.4688 8.125C20.4688 7.43464 21.0284 6.875 21.7188 6.875H21.875C22.5654 6.875 23.125 7.43464 23.125 8.125V15C23.125 15.6904 22.5654 16.25 21.875 16.25H21.7188C21.0284 16.25 20.4688 15.6904 20.4688 15V8.125Z" fill="currentColor" transform="translate(-3.125)"/>
            </svg>
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
          className="refresh-link"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M15.49 6.15a.75.75 0 0 1 1.06 0 6.5 6.5 0 1 1-1.2 9.86.75.75 0 1 1 1.2-.9 5 5 0 1 0 .95-7.58V10a.75.75 0 0 1-1.5 0V6.68a.53.53 0 0 1 .53-.53h3.3a.75.75 0 0 1 0 1.5h-2.26a6.54 6.54 0 0 1-1.08-1.5Z"
              fill="currentColor"
            />
          </svg>
          {isRefreshing ? t("refreshing_accounts") : t("refresh")}
        </button>
      </footer>
    </div>
  );
}
