import { useState } from "react";
import { connectAdvancedProvider, refreshAll, verifyXiaohongshuAccount } from "../lib/commands";
import { useI18n } from "../lib/i18n";
import type { AccountWithStats } from "../types";
import { MiniChart } from "./MiniChart";

function formatFollowers(followers: number | null) {
  if (followers === null) {
    return "—";
  }
  if (followers < 10_000) {
    return Intl.NumberFormat("en").format(followers);
  }
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: followers >= 100_000 ? 1 : 0,
  }).format(followers);
}

function formatDelta(delta: number | null) {
  if (delta === null) {
    return "+0";
  }
  return `${delta >= 0 ? "+" : ""}${Intl.NumberFormat("en").format(delta)}`;
}

const PROVIDER_FAVICONS: Record<string, string> = {
  youtube: "https://www.youtube.com/favicon.ico",
  x: "https://x.com/favicon.ico",
  bilibili: "https://www.bilibili.com/favicon.ico",
  wechat: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico",
  xiaohongshu: "https://www.xiaohongshu.com/favicon.ico",
  douyin: "https://www.douyin.com/favicon.ico",
};

function ProviderLogo({ provider }: { provider: string }) {
  const favicon = PROVIDER_FAVICONS[provider];
  if (!favicon) {
    return <span className="provider-badge-fallback">{providerLabel(provider).slice(0, 1)}</span>;
  }

  return <img src={favicon} alt="" className="provider-logo-image" />;
}

function providerLabel(provider: string) {
  switch (provider) {
    case "x":
      return "X";
    case "youtube":
      return "YouTube";
    case "bilibili":
      return "Bilibili";
    case "xiaohongshu":
      return "Xiaohongshu";
    case "douyin":
      return "Douyin";
    case "wechat":
      return "WeChat";
    default:
      return provider;
  }
}

export function AccountRow({
  account,
  expanded,
  onToggleExpand,
  onOpenEdit,
  onRefreshList,
}: {
  account: AccountWithStats;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpenEdit: () => void;
  onRefreshList: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerRefresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await refreshAll();
      await onRefreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyXiaohongshuAccount(account.id);
      await onRefreshList();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (
        message.includes("Xiaohongshu") &&
        window.confirm("Open a visible browser window to complete Xiaohongshu verification?")
      ) {
        await connectAdvancedProvider("xiaohongshu");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`account-row ${expanded ? "expanded" : ""}`}>
      <div className="account-row-main">
        <button
          type="button"
          className="account-row-button"
          onClick={() => {
            onToggleExpand();
            if (!expanded) {
              void triggerRefresh();
            }
          }}
        >
          <div className="account-row-leading">
            <div className="account-avatar">
              <ProviderLogo provider={account.provider} />
            </div>
            <div className="account-row-copy">
              <div className="account-row-title">
                {account.display_name?.trim() || account.username}
              </div>
              <div className="account-row-subtitle">{providerLabel(account.provider)}</div>
            </div>
          </div>

          <div className="account-row-trailing">
            <div className="account-row-metric">{formatFollowers(account.followers)}</div>
            <div className="account-row-delta">
              {formatDelta(account.today_change)} {t("today").toLowerCase()}
            </div>
          </div>
        </button>

        <button
          type="button"
          className="row-action-button"
          aria-label="Edit account"
          onClick={onOpenEdit}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path
              d="M5 10a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 5 10Zm5 0a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 10 10Zm5 0a1.2 1.2 0 1 0 0 2.4A1.2 1.2 0 0 0 15 10Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>

      {expanded ? (
        <div className="account-row-expanded">
          <div className="account-row-expanded-actions">
            <span className="expansion-kicker">7D Growth</span>
            <div className="expansion-actions-right">
              {account.can_verify_in_browser ? (
                <button type="button" className="ghost-button compact" onClick={() => void handleVerify()}>
                  {busy ? "Verifying..." : "Verify"}
                </button>
              ) : (
                <button type="button" className="ghost-button compact" onClick={() => void triggerRefresh()}>
                  {busy ? "Refreshing..." : t("refresh")}
                </button>
              )}
              <span className="expansion-meta">
                {account.today_change === null
                  ? t("waiting_first_refresh")
                  : `Avg. ${formatDelta(account.today_change)}/day`}
              </span>
            </div>
          </div>

          {account.provider_message ? (
            <div className="inline-hint">{account.provider_message}</div>
          ) : null}
          {error ? <div className="error-banner">{error}</div> : null}
          <MiniChart accountId={account.id} />
        </div>
      ) : null}
    </div>
  );
}
