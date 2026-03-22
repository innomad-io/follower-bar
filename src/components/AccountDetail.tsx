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

type ProviderMethod = "public_page" | "official_api" | "browser_link";

interface ProviderOption {
  id: ProviderMethod;
  label: string;
  icon: string;
  description: string;
}

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

function providerMethodOptions(provider: string): ProviderOption[] {
  switch (provider) {
    case "x":
    case "youtube":
      return [
        {
          id: "public_page",
          label: "Public Page",
          icon: "◌",
          description:
            "Monitor from the public profile page. No API quota required.",
        },
        {
          id: "official_api",
          label: "Official API",
          icon: "◇",
          description:
            "Use the platform API with your own credential for more reliable fetches.",
        },
      ];
    case "bilibili":
    case "douyin":
      return [
        {
          id: "public_page",
          label: "Public Page",
          icon: "◌",
          description: "Fetch from the public profile page.",
        },
      ];
    case "xiaohongshu":
    case "wechat":
      return [
        {
          id: "browser_link",
          label: "Browser Link",
          icon: "↗",
          description:
            "Use the browser-assisted runtime and session managed on this Mac.",
        },
      ];
    default:
      return [
        {
          id: "public_page",
          label: "Public Page",
          icon: "◌",
          description: "Fetch from the public profile page.",
        },
      ];
  }
}

function providerMethodDescription(provider: string, method: ProviderMethod) {
  const option = providerMethodOptions(provider).find((item) => item.id === method);
  return option?.description ?? "";
}

function providerStatusCopy(status: AdvancedProviderStatus | null) {
  if (!status) {
    return "Provider actions are not required for this method.";
  }

  if (!status.runtime_installed) {
    return "Runtime is not installed yet.";
  }

  if (!status.browser_installed) {
    return "Browser runtime is missing.";
  }

  if (!status.session_connected) {
    return "Browser session is not connected.";
  }

  return "Runtime is ready.";
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
  const [providerMethod, setProviderMethod] = useState<ProviderMethod>("public_page");
  const [tokenInput, setTokenInput] = useState("");
  const [apiKeyExists, setApiKeyExists] = useState(false);
  const [advancedStatus, setAdvancedStatus] = useState<AdvancedProviderStatus | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!account) {
      return;
    }

    setDisplayName(account.display_name ?? "");
    setUsername(account.username);
    setProviderMethod(account.provider_method as ProviderMethod);
    setTokenInput("");
    setMessage(null);

    void (async () => {
      try {
        const supportsApi = account.provider === "x" || account.provider === "youtube";
        setApiKeyExists(supportsApi ? await getApiKeyExists(account.provider) : false);

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
          <button type="button" onClick={onBack} className="ghost-button compact">
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
      await updateAccount(
        account.id,
        username.trim(),
        displayName.trim() || null,
        providerMethod
      );
      await refresh();
      onBack();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const supportsApiCredential = account.provider === "x" || account.provider === "youtube";
  const supportsBrowserLink = account.provider === "xiaohongshu" || account.provider === "wechat";

  return (
    <div className="screen-shell">
      <header className="top-bar with-divider">
        <button type="button" onClick={onBack} className="ghost-button compact">
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
              <span>Display Name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional display name"
                className="sheet-input"
              />
            </label>
            <label className="field-label">
              <span>Account Identifier / URL</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Handle, URL, or identifier"
                className="sheet-input"
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-kicker">Connection &amp; Provider</div>
          <div className="provider-method-grid">
            {providerMethodOptions(account.provider).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`provider-method-button ${
                  providerMethod === option.id ? "selected" : ""
                }`}
                onClick={() => setProviderMethod(option.id)}
              >
                <span className="provider-method-icon" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="provider-method-label">{option.label}</span>
              </button>
            ))}
          </div>
          <p className="provider-method-copy">
            {providerMethodDescription(account.provider, providerMethod)}
          </p>
        </section>

        <section className="settings-section">
          <div className="provider-actions-header">
            <div className="section-kicker no-margin">Provider Actions</div>
            {supportsBrowserLink ? (
              <div className="runtime-pill">
                <span className={`runtime-dot ${advancedStatus?.session_connected ? "active" : ""}`} />
                {advancedStatus?.session_connected ? "Runtime: Running" : "Runtime: Idle"}
              </div>
            ) : null}
          </div>

          <div className="settings-card stacked-form">
            {providerMethod === "official_api" && supportsApiCredential ? (
              <>
                <label className="field-label">
                  <div className="field-label-row">
                    <span>{account.provider === "x" ? "Bearer Token" : "API Key"}</span>
                    {apiKeyExists ? <span className="field-label-action">Renew</span> : null}
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    placeholder={
                      apiKeyExists
                        ? account.provider === "x"
                          ? "Replace bearer token"
                          : "Replace API key"
                        : account.provider === "x"
                          ? "Enter bearer token"
                          : "Enter API key"
                    }
                    className="sheet-input"
                  />
                </label>
                <button
                  type="button"
                  className="provider-action-button"
                  disabled={busyAction === "save-token" || !tokenInput.trim()}
                  onClick={async () => {
                    setBusyAction("save-token");
                    setMessage(null);
                    try {
                      await setApiKey(account.provider, tokenInput.trim());
                      setApiKeyExists(true);
                      setTokenInput("");
                      setMessage(
                        account.provider === "x" ? "Bearer token saved" : "API key saved"
                      );
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : String(err));
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                >
                  {busyAction === "save-token" ? "Saving..." : "Save Credential"}
                </button>
              </>
            ) : null}

            {providerMethod === "browser_link" && supportsBrowserLink ? (
              <>
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
                <div className="provider-status-note">{providerStatusCopy(advancedStatus)}</div>
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
                      className="provider-action-button subtle"
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
                      {busyAction === "verify-browser" ? "Verifying..." : "Verify Connection"}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {providerMethod === "public_page" ? (
              <div className="provider-status-note">
                Public page mode is ready. Refresh uses the platform&apos;s public profile page and
                does not require extra setup.
              </div>
            ) : null}
          </div>
        </section>

        <section className="settings-section danger-zone">
          <div className="section-kicker">Danger Zone</div>
          <div className="settings-card stacked-form">
            <button
              type="button"
              className="danger-inline-button"
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
              {busyAction === "remove-account" ? "Removing..." : "Remove Account"}
            </button>
            <div className="danger-copy">
              Removing this account will stop all background monitoring and delete historical data
              stored for this identifier.
            </div>
          </div>
        </section>
      </main>

      <footer className="bottom-bar refined">
        <div className="bottom-bar-caption">
          {account.last_fetched ? t("last_updated_just_now") : t("last_updated_never")}
        </div>
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
