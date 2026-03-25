import { useEffect, useMemo, useState } from "react";
import { formatAccountDisplayValue } from "../lib/accountDisplay";
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
import { providerLabel } from "../lib/providerMeta";
import type { AdvancedProviderStatus } from "../types";

type ProviderMethod = "public_page" | "official_api" | "browser_link";

interface ProviderOption {
  id: ProviderMethod;
  labelKey:
    | "provider_method_public_page"
    | "provider_method_official_api"
    | "provider_method_browser_link";
  icon: string;
  descriptionKey:
    | "provider_method_public_page_copy"
    | "provider_method_official_api_copy"
    | "provider_method_browser_link_copy";
}

function providerMethodOptions(provider: string): ProviderOption[] {
  switch (provider) {
    case "x":
    case "youtube":
      return [
        {
          id: "public_page",
          labelKey: "provider_method_public_page",
          icon: "◌",
          descriptionKey: "provider_method_public_page_copy",
        },
        {
          id: "official_api",
          labelKey: "provider_method_official_api",
          icon: "◇",
          descriptionKey: "provider_method_official_api_copy",
        },
      ];
    case "bilibili":
    case "douyin":
    case "threads":
    case "instagram":
    case "zhihu":
      return [
        {
          id: "public_page",
          labelKey: "provider_method_public_page",
          icon: "◌",
          descriptionKey: "provider_method_public_page_copy",
        },
      ];
    case "xiaohongshu":
    case "wechat":
      return [
        {
          id: "browser_link",
          labelKey: "provider_method_browser_link",
          icon: "↗",
          descriptionKey: "provider_method_browser_link_copy",
        },
      ];
    default:
      return [
        {
          id: "public_page",
          labelKey: "provider_method_public_page",
          icon: "◌",
          descriptionKey: "provider_method_public_page_copy",
        },
      ];
  }
}

function providerMethodDescriptionKey(provider: string, method: ProviderMethod) {
  const option = providerMethodOptions(provider).find((item) => item.id === method);
  return option?.descriptionKey ?? "provider_method_public_page_copy";
}

function providerStatusCopyKey(status: AdvancedProviderStatus | null) {
  if (!status) {
    return "provider_actions_not_required";
  }

  if (!status.runtime_installed) {
    return "runtime_not_installed";
  }

  if (!status.browser_installed) {
    return "runtime_browser_missing";
  }

  if (!status.session_connected) {
    return "runtime_session_not_connected";
  }

  return "runtime_ready";
}

function publicPageCopyKey(provider: string) {
  return provider === "douyin" || provider === "x"
    ? "public_page_runtime_required"
    : "public_page_ready";
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

        if (
          account.provider === "xiaohongshu" ||
          account.provider === "wechat" ||
          account.provider === "douyin" ||
          account.provider === "x" ||
          account.provider === "threads" ||
          account.provider === "instagram" ||
          account.provider === "zhihu"
        ) {
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
            {t("back")}
          </button>
          <div className="detail-header-copy">
            <div className="detail-header-kicker">{t("edit_account")}</div>
            <div className="top-bar-title">{t("account")}</div>
          </div>
          <button type="button" onClick={onBack} className="primary-button compact">
            {t("done")}
          </button>
        </header>
        <main className="screen-content settings-content">
          <div className="empty-state-card">{t("account_not_found")}</div>
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
  const supportsRuntime =
    supportsBrowserLink ||
    account.provider === "douyin" ||
    account.provider === "x" ||
    account.provider === "threads" ||
    account.provider === "instagram" ||
    account.provider === "zhihu";
  const isWechat = account.provider === "wechat";
  const editableUsername = isWechat && username === "__wechat_pending__" ? "" : username;
  const headerIdentifier =
    account.display_name?.trim() ||
    formatAccountDisplayValue(account.provider, editableUsername || account.username) ||
    t("account");

  return (
    <div className="screen-shell">
      <header className="top-bar with-divider">
          <button type="button" onClick={onBack} className="ghost-button compact">
          {t("back")}
        </button>
        <div className="detail-header-copy">
          <div className="detail-header-kicker">{t("edit_account")}</div>
          <div className="top-bar-title">{providerLabel(account.provider)}</div>
          <div className="detail-header-identifier" title={account.username}>
            {headerIdentifier}
          </div>
        </div>
        <button
          type="button"
          className="primary-button compact"
          onClick={() => void saveProfile()}
          disabled={busyAction === "save-profile" || (!isWechat && !username.trim())}
        >
          {busyAction === "save-profile" ? t("saving") : t("save")}
        </button>
      </header>

      <main className="screen-content settings-content">
        {message ? <div className="error-banner">{message}</div> : null}

        <section className="settings-section">
          <div className="section-kicker">{t("basic_info")}</div>
          <div className="settings-card stacked-form">
            <label className="field-label">
              <span>{t("display_name")}</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t("optional_display_name")}
                className="sheet-input"
              />
            </label>
            <label className="field-label">
              <span>{isWechat ? t("wechat_account_label") : t("account_identifier_url")}</span>
              <input
                value={editableUsername}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={isWechat ? t("wechat_account_label_placeholder") : t("handle_url_identifier")}
                className="sheet-input"
              />
            </label>
            {isWechat ? <div className="provider-status-note">{t("wechat_account_label_copy")}</div> : null}
          </div>
        </section>

        <section className="settings-section">
          <div className="section-kicker">{t("connection_provider")}</div>
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
                <span className="provider-method-label">{t(option.labelKey)}</span>
              </button>
            ))}
          </div>
          <p className="provider-method-copy">
            {t(providerMethodDescriptionKey(account.provider, providerMethod))}
          </p>
        </section>

        <section className="settings-section">
          <div className="provider-actions-header">
            <div className="section-kicker no-margin">{t("provider_actions")}</div>
            {supportsRuntime ? (
              <div className="runtime-pill">
                <span className={`runtime-dot ${advancedStatus?.session_connected ? "active" : ""}`} />
                {supportsBrowserLink && advancedStatus?.session_connected
                  ? t("runtime_running")
                  : t("runtime_idle")}
              </div>
            ) : null}
          </div>

          <div className="settings-card stacked-form">
            {providerMethod === "official_api" && supportsApiCredential ? (
              <>
                <label className="field-label">
                  <div className="field-label-row">
                    <span>{account.provider === "x" ? t("bearer_token") : t("api_key")}</span>
                    {apiKeyExists ? <span className="field-label-action">{t("renew")}</span> : null}
                  </div>
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    placeholder={
                      apiKeyExists
                        ? account.provider === "x"
                          ? t("replace_bearer_token")
                          : t("replace_api_key")
                        : account.provider === "x"
                          ? t("enter_bearer_token")
                          : t("enter_api_key")
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
                  {busyAction === "save-token" ? t("saving") : t("save_credential")}
                </button>
              </>
            ) : null}

            {providerMethod === "browser_link" && supportsBrowserLink ? (
              <>
                <div className="provider-status-grid">
                  <div className="status-block">
                    <span className="status-label">{t("runtime")}</span>
                    <strong>{advancedStatus?.runtime_installed ? t("installed") : t("not_installed")}</strong>
                  </div>
                  <div className="status-block">
                    <span className="status-label">{t("browser")}</span>
                    <strong>{advancedStatus?.browser_installed ? t("ready") : t("missing")}</strong>
                  </div>
                  <div className="status-block">
                    <span className="status-label">{t("session")}</span>
                    <strong>{advancedStatus?.session_connected ? t("connected") : t("not_connected")}</strong>
                  </div>
                </div>
                <div className="provider-status-note">{t(providerStatusCopyKey(advancedStatus))}</div>
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
                    {busyAction === "install-runtime" ? t("installing") : t("install_runtime")}
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
                    {busyAction === "connect-browser" ? t("opening") : t("connect_browser")}
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
                          setMessage(t("verification_complete"));
                        } catch (err) {
                          setMessage(err instanceof Error ? err.message : String(err));
                        } finally {
                          setBusyAction(null);
                        }
                      }}
                    >
                      {busyAction === "verify-browser" ? t("verifying") : t("verify_connection")}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {providerMethod === "public_page" ? (
              supportsRuntime ? (
                <>
                  <div className="provider-status-grid">
                    <div className="status-block">
                      <span className="status-label">{t("runtime")}</span>
                      <strong>{advancedStatus?.runtime_installed ? t("installed") : t("not_installed")}</strong>
                    </div>
                    <div className="status-block">
                      <span className="status-label">{t("browser")}</span>
                      <strong>{advancedStatus?.browser_installed ? t("ready") : t("missing")}</strong>
                    </div>
                    <div className="status-block">
                      <span className="status-label">{t("session")}</span>
                      <strong>{t("not_required")}</strong>
                    </div>
                  </div>
                  <div className="provider-status-note">{t(publicPageCopyKey(account.provider))}</div>
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
                      {busyAction === "install-runtime" ? t("installing") : t("install_runtime")}
                    </button>
                  </div>
                </>
              ) : (
                <div className="provider-status-note">
                  {t(publicPageCopyKey(account.provider))}
                </div>
              )
            ) : null}
          </div>
        </section>

        <section className="settings-section danger-zone">
          <div className="section-kicker">{t("danger_zone")}</div>
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
              {busyAction === "remove-account" ? t("removing") : t("remove_account")}
            </button>
            <div className="danger-copy">
              {t("remove_account_copy")}
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
