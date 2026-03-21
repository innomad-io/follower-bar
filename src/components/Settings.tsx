import { useEffect, useState } from "react";
import { useI18n, type SupportedLocale } from "../lib/i18n";
import {
  getAutostart,
  getMilestoneEnabled,
  getRefreshInterval,
  setAutostart,
  setMilestoneEnabled,
  setRefreshInterval,
} from "../lib/commands";

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
    <button type="button" onClick={onToggle} className={`toggle ${enabled ? "enabled" : ""}`}>
      <span className="toggle-knob" />
    </button>
  );
}

export function Settings({ onBack }: SettingsProps) {
  const { t, preference, setPreference } = useI18n();
  const [interval, setIntervalValue] = useState(15);
  const [milestoneEnabled, setMilestoneEnabledValue] = useState(true);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getRefreshInterval(), getMilestoneEnabled(), getAutostart()])
      .then(([nextInterval, nextMilestoneEnabled, nextAutostart]) => {
        setIntervalValue(nextInterval);
        setMilestoneEnabledValue(nextMilestoneEnabled);
        setAutostartEnabled(nextAutostart);
      })
      .catch((err) => setSettingsError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className="screen-shell">
      <header className="top-bar with-divider">
        <div className="settings-header-left">
          <button type="button" onClick={onBack} className="icon-button" aria-label="Back">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
              <path
                d="M11.28 4.22a.75.75 0 0 1 0 1.06L6.56 10l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <div className="top-bar-title">{t("general")} {t("settings")}</div>
        </div>
        <button type="button" className="icon-button" aria-label={t("settings")}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5">
            <path
              d="M10.7 3.2h2.6l.4 2.1c.5.1 1 .3 1.4.6l1.9-1.1 1.8 1.8-1.1 1.9c.3.4.5.9.6 1.4l2.1.4v2.6l-2.1.4c-.1.5-.3 1-.6 1.4l1.1 1.9-1.8 1.8-1.9-1.1c-.4.3-.9.5-1.4.6l-.4 2.1h-2.6l-.4-2.1c-.5-.1-1-.3-1.4-.6l-1.9 1.1-1.8-1.8 1.1-1.9c-.3-.4-.5-.9-.6-1.4l-2.1-.4v-2.6l2.1-.4c.1-.5.3-1 .6-1.4L5.8 6.6l1.8-1.8 1.9 1.1c.4-.3.9-.5 1.4-.6Z"
              fill="currentColor"
            />
            <circle cx="12" cy="12" r="3" fill="white" />
          </svg>
        </button>
      </header>

      <main className="screen-content settings-content">
        {settingsError ? <div className="error-banner">{settingsError}</div> : null}

        <section className="settings-section">
          <div className="section-kicker">{t("general")}</div>

          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-copy">
                <div className="settings-row-title">{t("refresh_interval")}</div>
                <div className="settings-row-subtitle">{t("refresh_interval_copy")}</div>
              </div>
              <div className="settings-select-wrap">
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
                  className="settings-select"
                >
                  {[5, 15, 30, 60].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes < 60 ? `${minutes}m` : "1h"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-card">
            <div className="settings-row">
              <div className="settings-row-copy">
                <div className="settings-row-title">{t("notifications")}</div>
                <div className="settings-row-subtitle">{t("notifications_copy")}</div>
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

            <div className="settings-separator" />

            <div className="settings-row">
              <div className="settings-row-copy">
                <div className="settings-row-title">{t("launch_at_login")}</div>
                <div className="settings-row-subtitle">{t("launch_at_login_copy")}</div>
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

            <div className="settings-separator" />

            <div className="settings-row">
              <div className="settings-row-copy">
                <div className="settings-row-title">{t("language")}</div>
                <div className="settings-row-subtitle">{t("language_copy")}</div>
              </div>
              <div className="settings-select-wrap">
                <select
                  value={preference}
                  onChange={(event) => setPreference(event.target.value as SupportedLocale)}
                  className="settings-select"
                >
                  <option value="system">System</option>
                  <option value="en">English</option>
                  <option value="zh-CN">简体中文</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-about refined">
          <div className="about-mark">
            <div className="brand-mark invert" aria-hidden="true">
              <span className="brand-mark-bar brand-mark-bar-sm" />
              <span className="brand-mark-bar brand-mark-bar-md" />
              <span className="brand-mark-bar brand-mark-bar-lg" />
            </div>
          </div>
          <div className="text-[14px] font-semibold text-slate-800">FollowerBar</div>
          <div className="text-[12px] text-[#6f7882]">{t("minimal_global_settings")}</div>
        </section>
      </main>

      <footer className="bottom-bar refined">
        <div className="bottom-bar-caption">Last updated: Just now</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="primary-button compact">
            {t("done")}
          </button>
        </div>
      </footer>
    </div>
  );
}
