import { useEffect, useMemo, useState } from "react";
import { addAccount, getAvailableProviders } from "../lib/commands";
import { useI18n } from "../lib/i18n";
import type { ProviderInfo } from "../types";

interface AddAccountProps {
  onAdded: (accountId: string) => void;
  onCancel: () => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  x: "X",
  youtube: "YouTube",
  bilibili: "Bilibili",
  xiaohongshu: "Xiaohongshu",
  douyin: "Douyin",
  wechat: "WeChat",
};

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
    return <span className="provider-badge-fallback">{PROVIDER_LABELS[provider]?.slice(0, 1) ?? "•"}</span>;
  }

  return <img src={favicon} alt="" className="provider-logo-image" />;
}

export function AddAccount({ onAdded, onCancel }: AddAccountProps) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getAvailableProviders()
      .then((availableProviders) => {
        const supported = availableProviders.filter((item) => !item.coming_soon);
        setProviders(supported);
        if (supported[0]) {
          setProvider(supported[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const selectedProvider = useMemo(
    () => providers.find((item) => item.id === provider) ?? null,
    [provider, providers]
  );

  const placeholder =
    selectedProvider?.id === "youtube"
      ? "@channelhandle or youtube.com/@channelhandle"
      : selectedProvider?.id === "bilibili"
        ? "UID, nickname, or profile URL"
      : selectedProvider?.id === "x"
        ? "@username or x.com/username"
      : selectedProvider?.id === "douyin"
        ? "douyin.com/user/... URL or user ID"
      : selectedProvider?.id === "xiaohongshu"
        ? "user/profile URL or user ID"
      : selectedProvider?.id === "wechat"
        ? "公众号名称或备注标签"
      : "Handle, username, or profile URL";

  const helperText =
    selectedProvider?.id === "x"
      ? t("add_account_helper_x")
      : selectedProvider?.id === "xiaohongshu"
        ? t("add_account_helper_xiaohongshu")
      : selectedProvider?.id === "wechat"
        ? t("add_account_helper_wechat")
        : t("add_account_helper_default");

  const handleSubmit = async () => {
    if (!provider || !username.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const accountId = await addAccount(provider, username.trim());
      onAdded(accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-shell add-flow-shell">
      <header className="top-bar with-divider">
        <button type="button" onClick={onCancel} className="secondary-button compact add-flow-nav-button">
          {t("cancel")}
        </button>
        <div className="top-bar-title centered">{t("add_account")}</div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !provider || !username.trim()}
          className="primary-button compact add-flow-nav-button"
        >
          {t("next")}
        </button>
      </header>

      <div className="progress-track">
        <div className="progress-fill" />
      </div>

      <main className="screen-content add-flow-content">
        <section className="mb-5">
          <div className="mb-1 text-[20px] font-bold tracking-[-0.04em] text-slate-900">
            {t("choose_platform")}
          </div>
          <p className="text-[13px] leading-5 text-[#6f7882]">
            {t("choose_platform_copy")}
          </p>
        </section>

        <div className="platform-grid">
          {providers.map((item) => {
            const selected = item.id === provider;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setProvider(item.id)}
                className={`platform-card ${selected ? "selected" : ""}`}
              >
                <div className="platform-card-icon">
                  <ProviderLogo provider={item.id} />
                </div>
                <div className="platform-card-label">{PROVIDER_LABELS[item.id] ?? item.name}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d8690]">
            {t("account_identifier")}
          </div>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleSubmit();
              }
            }}
            placeholder={placeholder}
            className="sheet-input"
          />
          <p className="mt-3 text-[12px] leading-5 text-[#6f7882]">{helperText}</p>
        </div>

        {error ? <div className="error-banner mt-4">{error}</div> : null}
      </main>

      <footer className="bottom-bar">
        <div className="bottom-bar-caption">{t("next_provider_method")}</div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !provider || !username.trim()}
          className="primary-button"
        >
          {saving ? t("adding") : t("continue")}
        </button>
      </footer>
    </div>
  );
}
