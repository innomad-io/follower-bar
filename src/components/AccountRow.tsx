import { useState } from "react";
import { connectAdvancedProvider, refreshAccount, verifyXiaohongshuAccount } from "../lib/commands";
import { formatAccountDisplayValue } from "../lib/accountDisplay";
import { useI18n } from "../lib/i18n";
import { providerLabel } from "../lib/providerMeta";
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
  zhihu: "https://static.zhihu.com/heifetz/favicon.ico",
};

function ProviderLogo({ provider }: { provider: string }) {
  if (provider === "threads") {
    return <span className="provider-badge-brand provider-badge-threads">＠</span>;
  }

  if (provider === "instagram") {
    return <span className="provider-badge-brand provider-badge-instagram">◎</span>;
  }

  const favicon = PROVIDER_FAVICONS[provider];
  if (!favicon) {
    return <span className="provider-badge-fallback">{providerLabel(provider).slice(0, 1)}</span>;
  }

  return <img src={favicon} alt="" className="provider-logo-image" />;
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
  const displayTitle =
    account.display_name?.trim() || formatAccountDisplayValue(account.provider, account.username);

  const triggerRefresh = async () => {
    setBusy(true);
    setError(null);
    try {
      await refreshAccount(account.id);
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
        window.confirm(t("verify_prompt_xiaohongshu"))
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
              <div className="account-row-title" title={account.display_name?.trim() ? undefined : account.username}>
                {displayTitle}
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
      </div>

      {expanded ? (
        <div className="account-row-expanded">
          <div className="account-row-expanded-actions">
            <span className="expansion-kicker">{t("growth_7d")}</span>
            <div className="expansion-actions-right">
              <button
                type="button"
                className="ghost-button compact"
                aria-label="Edit account"
                onClick={onOpenEdit}
              >
                {t("edit")}
              </button>
              {account.can_verify_in_browser ? (
                <button type="button" className="ghost-button compact" onClick={() => void handleVerify()}>
                  {busy ? t("verifying") : t("verify")}
                </button>
              ) : (
                <button type="button" className="ghost-button compact" onClick={() => void triggerRefresh()}>
                  {busy ? t("refreshing") : t("refresh")}
                </button>
              )}
              <span className="expansion-meta">
                {account.today_change === null
                  ? t("waiting_first_refresh")
                  : t("avg_per_day", { delta: formatDelta(account.today_change) })}
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
