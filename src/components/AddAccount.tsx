import { useEffect, useMemo, useState } from "react";
import { addAccount, getAvailableProviders } from "../lib/commands";
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

const PROVIDER_GLYPHS: Record<string, string> = {
  x: "𝕏",
  youtube: "▶",
  bilibili: "◉",
  xiaohongshu: "✦",
  douyin: "♬",
  wechat: "◔",
};

export function AddAccount({ onAdded, onCancel }: AddAccountProps) {
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
      ? "You can add the account first. Provider method and optional token are configured on the account detail screen."
      : selectedProvider?.id === "xiaohongshu"
        ? "Add the account first, then connect browser-assisted mode from the account detail screen."
      : selectedProvider?.id === "wechat"
        ? "This account uses browser-assisted mode. Add it first, then connect WeChat from the account detail screen."
        : "Add the account first. Platform-specific connection details appear on the account detail screen.";

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
        <button type="button" onClick={onCancel} className="text-[13px] font-medium text-[#2364e6]">
          Cancel
        </button>
        <div className="top-bar-title centered">Add Account</div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !provider || !username.trim()}
          className="text-[13px] font-medium text-[#2364e6] disabled:text-[#b7c0ca]"
        >
          Next
        </button>
      </header>

      <div className="progress-track">
        <div className="progress-fill" />
      </div>

      <main className="screen-content add-flow-content">
        <section className="mb-5">
          <div className="mb-1 text-[20px] font-bold tracking-[-0.04em] text-slate-900">
            Choose Platform
          </div>
          <p className="text-[13px] leading-5 text-[#6f7882]">
            Select the platform first. FollowerBar will show the right provider options after the account is added.
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
                <div className="platform-card-icon">{PROVIDER_GLYPHS[item.id] ?? "•"}</div>
                <div className="platform-card-label">{PROVIDER_LABELS[item.id] ?? item.name}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          <div className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7d8690]">
            Account Identifier
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
        <div className="bottom-bar-caption">Next: provider method</div>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !provider || !username.trim()}
          className="primary-button"
        >
          {saving ? "Adding..." : "Continue"}
        </button>
      </footer>
    </div>
  );
}
