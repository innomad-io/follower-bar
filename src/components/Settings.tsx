import { useEffect, useState } from "react";
import { useI18n, type SupportedLocale } from "../lib/i18n";
import {
  getAutostart,
  getMilestoneEnabled,
  getRefreshInterval,
  openRefreshLogs,
  setAutostart,
  setMilestoneEnabled,
  setRefreshInterval,
} from "../lib/commands";

interface SettingsProps {
  onBack: () => void;
}

function AppIconMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-12 w-12" aria-hidden="true">
      <defs>
        <linearGradient id="settings-app-icon-bg" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#86FAF8" />
          <stop offset="0.28" stopColor="#43CFF8" />
          <stop offset="0.64" stopColor="#2D79F6" />
          <stop offset="1" stopColor="#2755D8" />
        </linearGradient>
        <linearGradient id="settings-app-icon-glow" x1="20" y1="16" x2="48" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="settings-app-icon-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2454d8" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter="url(#settings-app-icon-shadow)">
        <rect x="6" y="6" width="52" height="52" rx="14" fill="url(#settings-app-icon-bg)" />
      </g>
      <circle cx="22" cy="18" r="12" fill="url(#settings-app-icon-glow)" opacity="0.7" />
      <path
        d="M21 19.5C21 18.12 22.12 17 23.5 17H39.5C40.88 17 42 18.12 42 19.5V21.5C42 22.88 40.88 24 39.5 24H26V30H36.5C37.88 30 39 31.12 39 32.5V34.5C39 35.88 37.88 37 36.5 37H26V44.5C26 45.88 24.88 47 23.5 47H22.5C21.12 47 20 45.88 20 44.5V19.5H21Z"
        fill="white"
      />
      <rect x="43.5" y="30" width="4" height="17" rx="2" fill="white" />
      <rect x="49.5" y="25" width="4" height="22" rx="2" fill="white" />
      <rect x="37.5" y="35" width="4" height="12" rx="2" fill="white" />
    </svg>
  );
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
            <div className="settings-row settings-row-stacked">
              <div className="settings-row-title">{t("refresh_interval")}</div>
              <div className="settings-row-detail-line">
                <div className="settings-row-subtitle">{t("refresh_interval_copy")}</div>
                <div className="settings-row-control">
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
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-card">
            <div className="settings-row settings-row-stacked">
              <div className="settings-row-title">{t("notifications")}</div>
              <div className="settings-row-detail-line">
                <div className="settings-row-subtitle">{t("notifications_copy")}</div>
                <div className="settings-row-control">
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
              </div>
            </div>

            <div className="settings-separator" />

            <div className="settings-row settings-row-stacked">
              <div className="settings-row-title">{t("launch_at_login")}</div>
              <div className="settings-row-detail-line">
                <div className="settings-row-subtitle">{t("launch_at_login_copy")}</div>
                <div className="settings-row-control">
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
              </div>
            </div>

            <div className="settings-separator" />

            <div className="settings-row settings-row-stacked">
              <div className="settings-row-title">{t("language")}</div>
              <div className="settings-row-detail-line">
                <div className="settings-row-subtitle">{t("language_copy")}</div>
                <div className="settings-row-control">
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
          </div>
        </section>

        <section className="settings-about refined">
          <div className="about-mark">
            <AppIconMark />
          </div>
          <div className="text-[14px] font-semibold text-slate-800">FollowerBar</div>
          <div className="settings-about-copy">
            Made by{" "}
            <a
              href="https://x.com/innomad_io"
              target="_blank"
              rel="noreferrer"
              className="settings-about-link"
            >
              Innomad (X: innomad_io)
            </a>
            {" · "}
            <a
              href="https://github.com/innomad-io/follower-bar"
              target="_blank"
              rel="noreferrer"
              className="settings-about-link"
            >
              GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="bottom-bar refined">
        <div className="bottom-bar-caption">{t("last_updated_just_now")}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await openRefreshLogs();
                setSettingsError(null);
              } catch (err) {
                setSettingsError(err instanceof Error ? err.message : String(err));
              }
            }}
            className="secondary-button compact"
          >
            {t("view_logs")}
          </button>
          <button type="button" onClick={onBack} className="primary-button compact">
            {t("done")}
          </button>
        </div>
      </footer>
    </div>
  );
}
