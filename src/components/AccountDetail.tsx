import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../hooks/useAccounts";
import { useI18n } from "../lib/i18n";
import {
  connectAdvancedProvider,
  getAdvancedProviderStatus,
  getApiKeyExists,
  installAdvancedProviderRuntime,
  removeAccount,
  setApiKey,
  updateAccount,
  verifyXiaohongshuAccount,
} from "../lib/commands";
import type { AdvancedProviderStatus } from "../types";

function providerName(provider: string) {
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

function providerIcon(provider: string) {
  switch (provider) {
    case "x":
      return "𝕏";
    case "youtube":
      return "▶";
    case "bilibili":
      return "◉";
    case "wechat":
      return "◔";
    case "xiaohongshu":
      return "✦";
    case "douyin":
      return "♬";
    default:
      return "•";
  }
}

export function AccountDetail({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { accounts, refresh } = useAccounts();
  const account = useMemo(
    () => accounts.find((item) => item.id === accountId),
    [accountId, accounts]
  );
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [xTokenInput, setXTokenInput] = useState("");
  const [xTokenExists, setXTokenExists] = useState(false);
  const [advancedStatus, setAdvancedStatus] = useState<AdvancedProviderStatus | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      return;
    }
    setDisplayName(account.display_name ?? "");
    setUsername(account.username);
    setMessage(null);

    void (async () => {
      try {
        if (account.provider === "x") {
          setXTokenExists(await getApiKeyExists("x"));
        } else {
          setXTokenExists(false);
        }
        if (account.provider === "xiaohongshu" || account.provider === "wechat") {
          setAdvancedStatus(await getAdvancedProviderStatus(account.provider));
        } else {
          setAdvancedStatus(null);
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [account]);

  if (!account) {
    return (
      <div className="screen-shell">
        <header className="top-bar with-divider">
          <button type="button" onClick={onBack} className="ghost-button">
            Back
          </button>
          <div className="detail-header-copy">
            <div className="detail-header-kicker">Edit Account</div>
            <div className="top-bar-title">Account</div>
          </div>
          <button type="button" onClick={onBack} className="primary-button compact">
            {t("done")}
          </button>
        </header>
        <main className="screen-content settings-content">
          <div className="empty-state-card">Account not found.</div>
        </main>
      </div>
    );
  }

  const saveProfile = async () => {
    setBusyAction("save-profile");
    setMessage(null);
    try {
      await updateAccount(account.id, username.trim(), displayName.trim() || null);
      await refresh();
      setMessage("Saved");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="screen-shell">
      <header className="top-bar with-divider">
        <button type="button" onClick={onBack} className="ghost-button">
          Back
        </button>
        <div className="detail-header-copy">
          <div className="detail-header-kicker">Edit Account</div>
          <div className="top-bar-title">
            {providerName(account.provider)} / {account.username}
          </div>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={() => void saveProfile()}
          disabled={busyAction === "save-profile" || !username.trim()}
        >
          {busyAction === "save-profile" ? "Saving..." : "Save"}
        </button>
      </header>

      <main className="screen-content settings-content">
        {message ? <div className="error-banner">{message}</div> : null}

        <section className="settings-section">
          <div className="section-kicker">Basic Info</div>
          <div className="settings-card stacked-form">
            <label className="field-label">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional display name"
                className="sheet-input"
              />
            </label>
            <label className="field-label">
              <span>Account identifier</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Handle, URL, or identifier"
                className="sheet-input"
              />
            </label>
          </div>
        </section>

        {account.provider === "x" ? (
          <section className="settings-section">
            <div className="section-kicker">Connection &amp; Provider</div>
            <div className="settings-card stacked-form">
              <div className="provider-line">
                <div>
                  <div className="settings-row-title">Public page</div>
                  <div className="settings-row-subtitle">
                    Default mode. Anonymous browser-assisted fetch from the public X profile.
                  </div>
                </div>
              </div>
              <div className="settings-separator" />
              <label className="field-label">
                <span>Official API bearer token</span>
                <input
                  type="password"
                  value={xTokenInput}
                  onChange={(event) => setXTokenInput(event.target.value)}
                  placeholder={xTokenExists ? "Replace bearer token" : "Optional bearer token"}
                  className="sheet-input"
                />
              </label>
              <div className="inline-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyAction === "save-token" || !xTokenInput.trim()}
                  onClick={async () => {
                    setBusyAction("save-token");
                    setMessage(null);
                    try {
                      await setApiKey("x", xTokenInput.trim());
                      setXTokenInput("");
                      setXTokenExists(true);
                      setMessage("Token saved");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "save-token" ? "Saving..." : "Save Token"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {account.provider === "xiaohongshu" || account.provider === "wechat" ? (
          <section className="settings-section">
            <div className="section-kicker">Provider Actions</div>
            <div className="settings-card stacked-form">
              <div className="provider-status-grid">
                <div className="status-block">
                  <span className="status-label">Runtime</span>
                  <strong>{advancedStatus?.runtime_installed ? "Installed" : "Not installed"}</strong>
                </div>
                <div className="status-block">
                  <span className="status-label">Browser</span>
                  <strong>{advancedStatus?.browser_installed ? "Ready" : "Missing"}</strong>
                </div>
                <div className="status-block">
                  <span className="status-label">Session</span>
                  <strong>{advancedStatus?.session_connected ? "Connected" : "Not connected"}</strong>
                </div>
              </div>

              <div className="inline-actions wrap">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyAction === "install-runtime"}
                  onClick={async () => {
                    setBusyAction("install-runtime");
                    setMessage(null);
                    try {
                      const nextStatus = await installAdvancedProviderRuntime(account.provider);
                      setAdvancedStatus(nextStatus);
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "install-runtime" ? "Installing..." : "Install Runtime"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyAction === "connect-browser"}
                  onClick={async () => {
                    setBusyAction("connect-browser");
                    setMessage(null);
                    try {
                      await connectAdvancedProvider(account.provider);
                      const nextStatus = await getAdvancedProviderStatus(account.provider);
                      setAdvancedStatus(nextStatus);
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "connect-browser" ? "Opening..." : "Connect Browser"}
                </button>
                {account.provider === "xiaohongshu" ? (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busyAction === "verify-browser"}
                    onClick={async () => {
                      setBusyAction("verify-browser");
                      setMessage(null);
                      try {
                        await verifyXiaohongshuAccount(account.id);
                        await refresh();
                        setMessage("Verification complete");
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : String(err));
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                  >
                    {busyAction === "verify-browser" ? "Verifying..." : "Verify in Browser"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="settings-section danger-zone">
          <div className="section-kicker">Danger Zone</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-copy">
                <div className="settings-row-title">Remove account</div>
                <div className="settings-row-subtitle">
                  Delete this account and its local history from FollowerBar.
                </div>
              </div>
              <button
                type="button"
                className="danger-button"
                disabled={busyAction === "remove-account"}
                onClick={async () => {
                  setBusyAction("remove-account");
                  setMessage(null);
                  try {
                    await removeAccount(account.id);
                    await refresh();
                    onBack();
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyAction(null);
                  }
                }}
              >
                {busyAction === "remove-account" ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bottom-bar refined">
        <div className="bottom-bar-caption">{account.last_fetched ? t("last_updated_just_now") : t("last_updated_never")}</div>
        <button type="button" onClick={onBack} className="refresh-link">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              d="M15.49 6.15a.75.75 0 0 1 1.06 0 6.5 6.5 0 1 1-1.2 9.86.75.75 0 1 1 1.2-.9 5 5 0 1 0 .95-7.58V10a.75.75 0 0 1-1.5 0V6.68a.53.53 0 0 1 .53-.53h3.3a.75.75 0 0 1 0 1.5h-2.26a6.54 6.54 0 0 1-1.08-1.5Z"
              fill="currentColor"
            />
          </svg>
          {t("refresh")}
        </button>
      </footer>
    </div>
  );
}
