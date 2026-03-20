import { useMemo, useState } from "react";
import type { AccountWithStats } from "../types";
import { MiniChart } from "./MiniChart";

const PROVIDER_FAVICONS: Record<string, string> = {
  youtube: "https://www.youtube.com/favicon.ico",
  x: "https://x.com/favicon.ico",
  bilibili: "https://www.bilibili.com/favicon.ico",
  wechat: "https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico",
  xiaohongshu: "https://www.xiaohongshu.com/favicon.ico",
  douyin: "https://www.douyin.com/favicon.ico",
};

function formatChange(change: number | null) {
  if (change === null) {
    return null;
  }

  const prefix = change >= 0 ? "+" : "-";
  const formatted = Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(Math.abs(change))
    .toLowerCase();

  return `${prefix}${formatted} today`;
}

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

function providerLabel(provider: string) {
  switch (provider) {
    case "x":
      return "X";
    case "youtube":
      return "YouTube";
    case "bilibili":
      return "Bilibili";
    case "wechat":
      return "WeChat";
    case "xiaohongshu":
      return "Xiaohongshu";
    case "douyin":
      return "Douyin";
    default:
      return provider;
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const favicon = PROVIDER_FAVICONS[provider];

  return (
    <div className="provider-badge">
      {favicon ? (
        <img src={favicon} alt="" className="h-5 w-5 rounded-[4px]" />
      ) : (
        <span className="provider-badge-fallback">{providerLabel(provider).slice(0, 1)}</span>
      )}
    </div>
  );
}

interface AccountRowProps {
  account: AccountWithStats;
  onVerifyInBrowser?: (account: AccountWithStats) => void;
}

export function AccountRow({ account, onVerifyInBrowser }: AccountRowProps) {
  const [expanded, setExpanded] = useState(false);
  const changeLabel = formatChange(account.today_change);
  const displayName = account.display_name?.trim() || account.username;

  const changeClassName = useMemo(() => {
    if (account.today_change === null) {
      return "caption-muted";
    }

    return account.today_change >= 0 ? "status-good" : "status-bad";
  }, [account.today_change]);

  const providerStatusLabel =
    account.provider_state === "challenge_required"
      ? account.provider_message ?? "Manual verification required"
      : null;

  return (
    <article className="account-row overflow-hidden transition">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-6 py-4 text-left transition"
      >
        <div className="flex min-w-0 items-center gap-4">
          <ProviderBadge provider={account.provider} />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-slate-800">
              {displayName}
            </div>
            <div className="mt-0.5 text-[11px] font-medium title-muted">
              {providerLabel(account.provider)}
            </div>
          </div>
        </div>

        <div className="w-[96px] shrink-0 pl-2 text-right">
          <div className="text-[15px] font-semibold tracking-[-0.03em] text-slate-800">
            {formatFollowers(account.followers)}
          </div>
          {providerStatusLabel ? (
            <>
              <div className="mt-0.5 text-[10px] font-semibold text-amber-700">
                Verification needed
              </div>
              {account.can_verify_in_browser ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onVerifyInBrowser?.(account);
                  }}
                  className="mt-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 transition hover:bg-amber-100"
                >
                  Verify
                </button>
              ) : null}
            </>
          ) : (
            <div className={`mt-0.5 text-[10px] font-semibold ${changeClassName}`}>
              {changeLabel ?? "Waiting for first refresh"}
            </div>
          )}
        </div>
      </div>

      {expanded ? (
        <div className="border-t border-[#eceef4] px-6 pb-4 pt-3">
          {providerStatusLabel ? (
            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-700">
              <div>{providerStatusLabel}</div>
            </div>
          ) : null}
          <MiniChart accountId={account.id} />
        </div>
      ) : null}
    </article>
  );
}
