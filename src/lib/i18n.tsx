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
  | "view_logs"
  | "view_logs_copy"
  | "done"
  | "minimal_global_settings"
  | "refreshing_accounts"
  | "refresh_summary"
  | "refresh_summary_failed"
  | "cancel"
  | "next"
  | "choose_platform"
  | "choose_platform_copy"
  | "account_identifier"
  | "next_provider_method"
  | "adding"
  | "continue"
  | "add_account_helper_x"
  | "add_account_helper_xiaohongshu"
  | "add_account_helper_wechat"
  | "add_account_helper_default"
  | "back"
  | "save"
  | "saving"
  | "edit_account"
  | "account"
  | "account_not_found"
  | "basic_info"
  | "display_name"
  | "optional_display_name"
  | "account_identifier_url"
  | "handle_url_identifier"
  | "connection_provider"
  | "provider_actions"
  | "provider_method_public_page"
  | "provider_method_official_api"
  | "provider_method_browser_link"
  | "provider_method_public_page_copy"
  | "provider_method_official_api_copy"
  | "provider_method_browser_link_copy"
  | "provider_actions_not_required"
  | "runtime_not_installed"
  | "runtime_browser_missing"
  | "runtime_session_not_connected"
  | "runtime_ready"
  | "runtime_running"
  | "runtime_idle"
  | "bearer_token"
  | "api_key"
  | "renew"
  | "replace_bearer_token"
  | "replace_api_key"
  | "enter_bearer_token"
  | "enter_api_key"
  | "save_credential"
  | "runtime"
  | "browser"
  | "session"
  | "installed"
  | "not_installed"
  | "ready"
  | "missing"
  | "connected"
  | "not_connected"
  | "installing"
  | "install_runtime"
  | "opening"
  | "connect_browser"
  | "verification_complete"
  | "verifying"
  | "verify_connection"
  | "public_page_ready"
  | "danger_zone"
  | "removing"
  | "remove_account"
  | "remove_account_copy"
  | "edit"
  | "verify"
  | "refreshing"
  | "growth_7d"
  | "avg_per_day"
  | "verify_prompt_xiaohongshu";

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
    view_logs: "View Logs",
    view_logs_copy: "Open the refresh log folder for troubleshooting.",
    done: "Done",
    minimal_global_settings: "Minimal global settings only",
    refreshing_accounts: "Refreshing accounts...",
    refresh_summary: "{refreshed} refreshed · {skipped} skipped",
    refresh_summary_failed: "{refreshed} refreshed · {skipped} skipped · {failed} failed",
    cancel: "Cancel",
    next: "Next",
    choose_platform: "Choose Platform",
    choose_platform_copy:
      "Select the platform first. FollowerBar will show the right provider options after the account is added.",
    account_identifier: "Account Identifier",
    next_provider_method: "Next: provider method",
    adding: "Adding...",
    continue: "Continue",
    add_account_helper_x:
      "You can add the account first. Provider method and optional token are configured on the account detail screen.",
    add_account_helper_xiaohongshu:
      "Add the account first, then connect browser-assisted mode from the account detail screen.",
    add_account_helper_wechat:
      "This account uses browser-assisted mode. Add it first, then connect WeChat from the account detail screen.",
    add_account_helper_default:
      "Add the account first. Platform-specific connection details appear on the account detail screen.",
    back: "Back",
    save: "Save",
    saving: "Saving...",
    edit_account: "Edit Account",
    account: "Account",
    account_not_found: "Account not found.",
    basic_info: "Basic Info",
    display_name: "Display Name",
    optional_display_name: "Optional display name",
    account_identifier_url: "Account Identifier / URL",
    handle_url_identifier: "Handle, URL, or identifier",
    connection_provider: "Connection & Provider",
    provider_actions: "Provider Actions",
    provider_method_public_page: "Public Page",
    provider_method_official_api: "Official API",
    provider_method_browser_link: "Browser Link",
    provider_method_public_page_copy:
      "Monitor from the public profile page. No API quota required.",
    provider_method_official_api_copy:
      "Use the platform API with your own credential for more reliable fetches.",
    provider_method_browser_link_copy:
      "Use the browser-assisted runtime and session managed on this Mac.",
    provider_actions_not_required: "Provider actions are not required for this method.",
    runtime_not_installed: "Runtime is not installed yet.",
    runtime_browser_missing: "Browser runtime is missing.",
    runtime_session_not_connected: "Browser session is not connected.",
    runtime_ready: "Runtime is ready.",
    runtime_running: "Runtime: Running",
    runtime_idle: "Runtime: Idle",
    bearer_token: "Bearer Token",
    api_key: "API Key",
    renew: "Renew",
    replace_bearer_token: "Replace bearer token",
    replace_api_key: "Replace API key",
    enter_bearer_token: "Enter bearer token",
    enter_api_key: "Enter API key",
    save_credential: "Save Credential",
    runtime: "Runtime",
    browser: "Browser",
    session: "Session",
    installed: "Installed",
    not_installed: "Not installed",
    ready: "Ready",
    missing: "Missing",
    connected: "Connected",
    not_connected: "Not connected",
    installing: "Installing...",
    install_runtime: "Install Runtime",
    opening: "Opening...",
    connect_browser: "Connect Browser",
    verification_complete: "Verification complete",
    verifying: "Verifying...",
    verify_connection: "Verify Connection",
    public_page_ready:
      "Public page mode is ready. Refresh uses the platform's public profile page and does not require extra setup.",
    danger_zone: "Danger Zone",
    removing: "Removing...",
    remove_account: "Remove Account",
    remove_account_copy:
      "Removing this account will stop all background monitoring and delete historical data stored for this identifier.",
    edit: "Edit",
    verify: "Verify",
    refreshing: "Refreshing...",
    growth_7d: "7D Growth",
    avg_per_day: "Avg. {delta}/day",
    verify_prompt_xiaohongshu: "Open a visible browser window to complete Xiaohongshu verification?",
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
    view_logs: "查看日志",
    view_logs_copy: "打开刷新日志目录，便于排查问题。",
    done: "完成",
    minimal_global_settings: "仅保留全局设置",
    refreshing_accounts: "正在刷新账号...",
    refresh_summary: "已刷新 {refreshed} 个 · 跳过 {skipped} 个",
    refresh_summary_failed: "已刷新 {refreshed} 个 · 跳过 {skipped} 个 · 失败 {failed} 个",
    cancel: "取消",
    next: "下一步",
    choose_platform: "选择平台",
    choose_platform_copy: "先选择平台。添加账号后，FollowerBar 会展示该平台对应的连接方式。",
    account_identifier: "账号标识",
    next_provider_method: "下一步：选择连接方式",
    adding: "添加中...",
    continue: "继续",
    add_account_helper_x: "可以先添加账号，再到账号详情页配置 provider 方式和可选 token。",
    add_account_helper_xiaohongshu: "先添加账号，再到账号详情页连接 browser-assisted 模式。",
    add_account_helper_wechat:
      "这个账号使用 browser-assisted 模式。请先添加，再到账号详情页连接微信。",
    add_account_helper_default: "请先添加账号，平台特定的连接配置会出现在账号详情页中。",
    back: "返回",
    save: "保存",
    saving: "保存中...",
    edit_account: "编辑账号",
    account: "账号",
    account_not_found: "未找到该账号。",
    basic_info: "基础信息",
    display_name: "显示名称",
    optional_display_name: "可选显示名称",
    account_identifier_url: "账号标识 / URL",
    handle_url_identifier: "Handle、URL 或账号标识",
    connection_provider: "连接方式与 Provider",
    provider_actions: "Provider 操作",
    provider_method_public_page: "公开页面",
    provider_method_official_api: "官方 API",
    provider_method_browser_link: "浏览器连接",
    provider_method_public_page_copy: "通过公开资料页监控，不需要 API 配额。",
    provider_method_official_api_copy: "使用平台官方 API 和你自己的凭据，获取更稳定的刷新结果。",
    provider_method_browser_link_copy: "使用本机管理的 browser-assisted 运行时和会话。",
    provider_actions_not_required: "当前连接方式不需要额外操作。",
    runtime_not_installed: "运行时尚未安装。",
    runtime_browser_missing: "浏览器运行时缺失。",
    runtime_session_not_connected: "浏览器会话尚未连接。",
    runtime_ready: "运行时已就绪。",
    runtime_running: "运行时：运行中",
    runtime_idle: "运行时：空闲",
    bearer_token: "Bearer Token",
    api_key: "API Key",
    renew: "更新",
    replace_bearer_token: "替换 Bearer Token",
    replace_api_key: "替换 API Key",
    enter_bearer_token: "输入 Bearer Token",
    enter_api_key: "输入 API Key",
    save_credential: "保存凭据",
    runtime: "运行时",
    browser: "浏览器",
    session: "会话",
    installed: "已安装",
    not_installed: "未安装",
    ready: "已就绪",
    missing: "缺失",
    connected: "已连接",
    not_connected: "未连接",
    installing: "安装中...",
    install_runtime: "安装运行时",
    opening: "打开中...",
    connect_browser: "连接浏览器",
    verification_complete: "验证完成",
    verifying: "验证中...",
    verify_connection: "验证连接",
    public_page_ready: "公开页面模式已就绪。刷新会直接读取平台公开资料页，不需要额外配置。",
    danger_zone: "危险区域",
    removing: "删除中...",
    remove_account: "删除账号",
    remove_account_copy: "删除该账号会停止后台监控，并移除这个标识的历史数据。",
    edit: "编辑",
    verify: "验证",
    refreshing: "刷新中...",
    growth_7d: "7日趋势",
    avg_per_day: "平均 {delta}/天",
    verify_prompt_xiaohongshu: "打开可见浏览器窗口以完成小红书验证？",
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
