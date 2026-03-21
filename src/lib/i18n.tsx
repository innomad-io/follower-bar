import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SupportedLocale = "system" | "en" | "zh-CN";

type MessageKey =
  | "app_name"
  | "add_account"
  | "settings"
  | "no_accounts"
  | "no_accounts_copy"
  | "loading_accounts"
  | "last_updated_never"
  | "last_updated_just_now"
  | "last_updated_minutes"
  | "last_updated_time"
  | "refresh"
  | "today"
  | "waiting_first_refresh"
  | "needs_verification"
  | "followers"
  | "general"
  | "refresh_interval"
  | "refresh_interval_copy"
  | "notifications"
  | "notifications_copy"
  | "launch_at_login"
  | "launch_at_login_copy"
  | "language"
  | "language_copy"
  | "done"
  | "minimal_global_settings";

interface I18nContextValue {
  preference: SupportedLocale;
  locale: string;
  setPreference: (locale: SupportedLocale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const STORAGE_KEY = "followbar.locale";

const messages: Record<Exclude<SupportedLocale, "system">, Record<MessageKey, string>> = {
  en: {
    app_name: "FollowerBar",
    add_account: "Add Account",
    settings: "Settings",
    no_accounts: "No accounts yet",
    no_accounts_copy: "Add your first profile to start tracking follower updates in the menu bar.",
    loading_accounts: "Loading your accounts...",
    last_updated_never: "Last updated: Never",
    last_updated_just_now: "Last updated: Just now",
    last_updated_minutes: "Last updated: {minutes}m ago",
    last_updated_time: "Last updated: {time}",
    refresh: "Refresh",
    today: "Today",
    waiting_first_refresh: "Waiting for first refresh",
    needs_verification: "Needs verification",
    followers: "followers",
    general: "General",
    refresh_interval: "Refresh interval",
    refresh_interval_copy: "Choose how frequently FollowerBar checks follower counts.",
    notifications: "Notifications",
    notifications_copy: "Notify you when tracked accounts cross saved milestones.",
    launch_at_login: "Launch at Login",
    launch_at_login_copy: "Open FollowerBar automatically when you sign in to macOS.",
    language: "Language",
    language_copy: "Choose the interface language or follow the macOS system setting.",
    done: "Done",
    minimal_global_settings: "Minimal global settings only",
  },
  "zh-CN": {
    app_name: "FollowerBar",
    add_account: "添加账号",
    settings: "设置",
    no_accounts: "还没有账号",
    no_accounts_copy: "添加第一个账号后，就可以在菜单栏里跟踪粉丝变化。",
    loading_accounts: "正在加载账号...",
    last_updated_never: "上次更新：从未",
    last_updated_just_now: "上次更新：刚刚",
    last_updated_minutes: "上次更新：{minutes} 分钟前",
    last_updated_time: "上次更新：{time}",
    refresh: "刷新",
    today: "今日",
    waiting_first_refresh: "等待第一次刷新",
    needs_verification: "需要验证",
    followers: "粉丝",
    general: "通用",
    refresh_interval: "刷新频率",
    refresh_interval_copy: "设置 FollowerBar 检查粉丝数变化的频率。",
    notifications: "通知",
    notifications_copy: "当账号达到保存的里程碑时通知你。",
    launch_at_login: "登录时启动",
    launch_at_login_copy: "登录 macOS 后自动打开 FollowerBar。",
    language: "语言",
    language_copy: "选择界面语言，或跟随 macOS 系统设置。",
    done: "完成",
    minimal_global_settings: "仅保留全局设置",
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveLocale(preference: SupportedLocale): string {
  if (preference !== "system") {
    return preference;
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language || "en";
}

function normalizeLocale(locale: string): Exclude<SupportedLocale, "system"> {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<SupportedLocale>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "zh-CN" || saved === "system" ? saved : "system";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  const locale = resolveLocale(preference);
  const dictionary = messages[normalizeLocale(locale)];

  const value = useMemo<I18nContextValue>(
    () => ({
      preference,
      locale,
      setPreference,
      t: (key, vars) => {
        const template = dictionary[key] ?? messages.en[key];
        if (!vars) {
          return template;
        }

        return Object.entries(vars).reduce(
          (result, [name, value]) => result.replace(`{${name}}`, String(value)),
          template
        );
      },
    }),
    [dictionary, locale, preference]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export type { SupportedLocale };
