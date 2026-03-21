import { useEffect, useMemo, useState } from "react";
import {
  connectAdvancedProvider,
  getAdvancedProviderStatus,
  getApiKeyExists,
  getAutostart,
  getAvailableProviders,
  getMilestoneEnabled,
  getRefreshInterval,
  installAdvancedProviderRuntime,
  removeAccount,
  setApiKey,
  setAutostart,
  setMilestoneEnabled,
  setRefreshInterval,
} from "../lib/commands";
import { useAccounts } from "../hooks/useAccounts";
import type { AdvancedProviderStatus, ProviderInfo } from "../types";
import { AddAccount } from "./AddAccount";

interface SettingsProps {
  onBack: () => void;
}

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
        enabled
          ? "bg-[linear-gradient(135deg,var(--accent),var(--accent-2))]"
          : "bg-slate-300"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function Settings({ onBack }: SettingsProps) {
  const { accounts, refresh } = useAccounts();
  const [showAdd, setShowAdd] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [interval, setIntervalValue] = useState(15);
  const [milestoneEnabled, setMilestoneEnabledValue] = useState(true);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [advancedStatus, setAdvancedStatus] = useState<Record<string, AdvancedProviderStatus>>({});
  const [busyProviderAction, setBusyProviderAction] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      getRefreshInterval(),
      getMilestoneEnabled(),
      getAutostart(),
      getAvailableProviders(),
    ])
      .then(async ([nextInterval, nextMilestoneEnabled, nextAutostart, nextProviders]) => {
        setIntervalValue(nextInterval);
        setMilestoneEnabledValue(nextMilestoneEnabled);
        setAutostartEnabled(nextAutostart);
        setProviders(nextProviders);

        const nextApiKeyStatus: Record<string, boolean> = {};
        for (const provider of nextProviders) {
          if (provider.needs_api_key) {
            nextApiKeyStatus[provider.id] = await getApiKeyExists(provider.id);
          }
        }
        setApiKeyStatus(nextApiKeyStatus);
        const [xiaohongshuStatus, wechatStatus] = await Promise.all([
          getAdvancedProviderStatus("xiaohongshu"),
          getAdvancedProviderStatus("wechat"),
        ]);
        setAdvancedStatus({ xiaohongshu: xiaohongshuStatus, wechat: wechatStatus });
        setSettingsError(null);
      })
      .catch((err) => {
        setSettingsError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const apiKeyProviders = useMemo(
    () => providers.filter((provider) => provider.needs_api_key),
    [providers]
  );

  const handleRemove = async (accountId: string) => {
    try {
      await removeAccount(accountId);
      await refresh();
      setSettingsError(null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSaveApiKey = async (providerId: string) => {
    const value =
      providerId === "wechat"
        ? JSON.stringify({
            app_id: apiKeyInputs["wechat:app_id"]?.trim() ?? "",
            app_secret: apiKeyInputs["wechat:app_secret"]?.trim() ?? "",
          })
        : apiKeyInputs[providerId]?.trim();
    if (!value) {
      return;
    }

    try {
      await setApiKey(providerId, value);
      setApiKeyInputs((current) =>
        providerId === "wechat"
          ? {
              ...current,
              "wechat:app_id": "",
              "wechat:app_secret": "",
            }
          : { ...current, [providerId]: "" }
      );
      setApiKeyStatus((current) => ({ ...current, [providerId]: true }));
      setSettingsError(null);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    }
  };

  const refreshAdvancedStatus = async (providerId: string) => {
    const nextStatus = await getAdvancedProviderStatus(providerId);
    setAdvancedStatus((current) => ({ ...current, [providerId]: nextStatus }));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="chrome-divider flex items-center justify-between border-b px-5 pb-4 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="subtle-button rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-white"
        >
          Back
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-800">Settings</div>
          <div className="caption-muted text-[11px] uppercase tracking-[0.24em]">
            Preferences
          </div>
        </div>
        <div className="w-[68px]" />
      </header>

      <div className="scroll-area flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {settingsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/85 px-4 py-3 text-xs text-rose-500">
            {settingsError}
          </div>
        ) : null}

        <section className="panel-section rounded-[24px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Accounts</h3>
              <p className="mt-1 text-xs title-muted">Manage tracked profiles.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="accent-button rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition hover:brightness-105"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
            {accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-xs title-muted">
                No accounts configured yet.
              </div>
            ) : (
              accounts.map((account) => (
                <div
                  key={account.id}
                  className="list-row flex items-center justify-between rounded-2xl px-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">
                      {account.display_name ?? account.username}
                    </div>
                    <div className="text-xs title-muted">
                      {account.provider} · {account.username}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemove(account.id)}
                    className="text-xs text-rose-500 transition hover:text-rose-400"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {showAdd ? (
            <div className="mt-4">
              <AddAccount
                onAdded={() => {
                  setShowAdd(false);
                  void refresh();
                }}
                onCancel={() => setShowAdd(false)}
              />
            </div>
          ) : null}
        </section>

        <section className="panel-section rounded-[24px] p-4">
          <h3 className="text-sm font-semibold text-slate-800">Refresh cadence</h3>
          <p className="mt-1 text-xs title-muted">
            Choose how frequently FollowBar checks follower counts.
          </p>

          <select
            value={interval}
            onChange={async (event) => {
              const minutes = Number(event.target.value);
              const previous = interval;
              setIntervalValue(minutes);
              try {
                await setRefreshInterval(minutes);
                setSettingsError(null);
              } catch (err) {
                setIntervalValue(previous);
                setSettingsError(err instanceof Error ? err.message : String(err));
              }
            }}
            className="soft-input mt-3 w-full rounded-2xl px-3 py-2.5 text-sm"
          >
            {[5, 15, 30, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                Every {minutes} minutes
              </option>
            ))}
          </select>
        </section>

        {apiKeyProviders.length > 0 ? (
          <section className="panel-section rounded-[24px] p-4">
            <h3 className="text-sm font-semibold text-slate-800">Credentials</h3>
            <p className="mt-1 text-xs title-muted">
              Credentials are stored in the macOS Keychain, not SQLite.
            </p>

            <div className="mt-4 space-y-3">
              {apiKeyProviders.map((provider) => (
                <div key={provider.id} className="list-row rounded-2xl p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-800">{provider.name}</span>
                    <span className="caption-muted text-[11px] uppercase tracking-[0.18em]">
                      {apiKeyStatus[provider.id] ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <p className="mb-2 text-xs title-muted">
                    {provider.id === "x"
                      ? "Bearer token"
                      : provider.id === "wechat"
                        ? "AppID and AppSecret"
                        : "API key"}
                  </p>
                  {provider.id === "wechat" ? (
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={apiKeyInputs["wechat:app_id"] ?? ""}
                        onChange={(event) =>
                          setApiKeyInputs((current) => ({
                            ...current,
                            "wechat:app_id": event.target.value,
                          }))
                        }
                        placeholder="Paste AppID"
                        className="soft-input min-w-0 w-full rounded-2xl px-3 py-2.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInputs["wechat:app_secret"] ?? ""}
                          onChange={(event) =>
                            setApiKeyInputs((current) => ({
                              ...current,
                              "wechat:app_secret": event.target.value,
                            }))
                          }
                          placeholder="Paste AppSecret"
                          className="soft-input min-w-0 flex-1 rounded-2xl px-3 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveApiKey(provider.id)}
                          className="subtle-button rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKeyInputs[provider.id] ?? ""}
                        onChange={(event) =>
                          setApiKeyInputs((current) => ({
                            ...current,
                            [provider.id]: event.target.value,
                          }))
                        }
                        placeholder={provider.id === "x" ? "Paste bearer token" : "Paste API key"}
                        className="soft-input min-w-0 flex-1 rounded-2xl px-3 py-2.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveApiKey(provider.id)}
                        className="subtle-button rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel-section rounded-[24px] p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Advanced providers</h3>
            <p className="mt-1 text-xs title-muted">
              Xiaohongshu and WeChat use a browser-assisted runtime. Install Chromium once, then connect each session locally on this Mac.
            </p>
          </div>

          <div className="list-row rounded-2xl p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800">Xiaohongshu</div>
                <div className="mt-1 text-xs title-muted">
                  Status: {advancedStatus.xiaohongshu?.state ?? "checking"}
                </div>
              </div>
              <div className="caption-muted text-[11px] uppercase tracking-[0.18em]">
                {advancedStatus.xiaohongshu?.session_connected ? "Connected" : "Not Connected"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyProviderAction !== null}
                onClick={async () => {
                  setBusyProviderAction("xiaohongshu-install");
                  try {
                    const nextStatus = await installAdvancedProviderRuntime("xiaohongshu");
                    setAdvancedStatus((current) => ({
                      ...current,
                      xiaohongshu: nextStatus,
                    }));
                    setSettingsError(null);
                  } catch (err) {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyProviderAction(null);
                  }
                }}
                className="subtle-button rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Install runtime
              </button>
              <button
                type="button"
                disabled={busyProviderAction !== null}
                onClick={async () => {
                  setBusyProviderAction("xiaohongshu-connect");
                  try {
                    await connectAdvancedProvider("xiaohongshu");
                    for (let attempt = 0; attempt < 30; attempt += 1) {
                      await new Promise((resolve) => window.setTimeout(resolve, 2000));
                      await refreshAdvancedStatus("xiaohongshu");
                    }
                    setSettingsError(null);
                  } catch (err) {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyProviderAction(null);
                  }
                }}
                className="accent-button rounded-2xl px-3 py-2 text-sm font-medium transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Connect
              </button>
            </div>
          </div>

          <div className="mt-3 list-row rounded-2xl p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-800">WeChat Official Account</div>
                <div className="mt-1 text-xs title-muted">
                  Status: {advancedStatus.wechat?.state ?? "checking"}
                </div>
              </div>
              <div className="caption-muted text-[11px] uppercase tracking-[0.18em]">
                {advancedStatus.wechat?.session_connected ? "Connected" : "Not Connected"}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyProviderAction !== null}
                onClick={async () => {
                  setBusyProviderAction("wechat-install");
                  try {
                    const nextStatus = await installAdvancedProviderRuntime("wechat");
                    setAdvancedStatus((current) => ({
                      ...current,
                      wechat: nextStatus,
                    }));
                    setSettingsError(null);
                  } catch (err) {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyProviderAction(null);
                  }
                }}
                className="subtle-button rounded-2xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Install runtime
              </button>
              <button
                type="button"
                disabled={busyProviderAction !== null}
                onClick={async () => {
                  setBusyProviderAction("wechat-connect");
                  try {
                    await connectAdvancedProvider("wechat");
                    for (let attempt = 0; attempt < 30; attempt += 1) {
                      await new Promise((resolve) => window.setTimeout(resolve, 2000));
                      await refreshAdvancedStatus("wechat");
                    }
                    setSettingsError(null);
                  } catch (err) {
                    setSettingsError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusyProviderAction(null);
                  }
                }}
                className="accent-button rounded-2xl px-3 py-2 text-sm font-medium transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Connect
              </button>
            </div>
          </div>
        </section>

        <section className="panel-section rounded-[24px] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Milestone notifications</h3>
              <p className="mt-1 text-xs title-muted">
                Get a native macOS alert when a tracked account crosses a target.
              </p>
            </div>
            <Toggle
              enabled={milestoneEnabled}
              onToggle={async () => {
                const nextValue = !milestoneEnabled;
                setMilestoneEnabledValue(nextValue);
                try {
                  await setMilestoneEnabled(nextValue);
                  setSettingsError(null);
                } catch (err) {
                  setMilestoneEnabledValue(!nextValue);
                  setSettingsError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </div>
        </section>

        <section className="panel-section rounded-[24px] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Auto-start on login</h3>
              <p className="mt-1 text-xs title-muted">
                Launch FollowBar automatically when you sign in to macOS.
              </p>
            </div>
            <Toggle
              enabled={autostartEnabled}
              onToggle={async () => {
                const nextValue = !autostartEnabled;
                setAutostartEnabled(nextValue);
                try {
                  await setAutostart(nextValue);
                  setSettingsError(null);
                } catch (err) {
                  setAutostartEnabled(!nextValue);
                  setSettingsError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
