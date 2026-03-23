import { invoke } from "@tauri-apps/api/core";
import type {
  AccountWithStats,
  AdvancedProviderStatus,
  ProviderInfo,
  RefreshSummary,
  Snapshot,
} from "../types";

export function listAccounts(): Promise<AccountWithStats[]> {
  return invoke("list_accounts");
}

export function addAccount(provider: string, username: string): Promise<string> {
  return invoke("add_account", { provider, username });
}

export function updateAccount(
  accountId: string,
  username: string,
  displayName: string | null,
  providerMethod: string | null
): Promise<void> {
  return invoke("update_account", { accountId, username, displayName, providerMethod });
}

export function removeAccount(accountId: string): Promise<void> {
  return invoke("remove_account", { accountId });
}

export function getSnapshots7d(accountId: string): Promise<Snapshot[]> {
  return invoke("get_snapshots_7d", { accountId });
}

export function getAvailableProviders(): Promise<ProviderInfo[]> {
  return invoke("get_available_providers");
}

export function refreshAll(): Promise<RefreshSummary> {
  return invoke("refresh_all");
}

export function refreshAccount(accountId: string): Promise<void> {
  return invoke("refresh_account", { accountId });
}

export function setApiKey(provider: string, key: string): Promise<void> {
  return invoke("set_api_key", { provider, key });
}

export function getApiKeyExists(provider: string): Promise<boolean> {
  return invoke("get_api_key_exists", { provider });
}

export function getRefreshInterval(): Promise<number> {
  return invoke("get_refresh_interval");
}

export function setRefreshInterval(minutes: number): Promise<void> {
  return invoke("set_refresh_interval", { minutes });
}

export function getAutostart(): Promise<boolean> {
  return invoke("get_autostart");
}

export function setAutostart(enabled: boolean): Promise<void> {
  return invoke("set_autostart", { enabled });
}

export function getMilestoneEnabled(): Promise<boolean> {
  return invoke("get_milestone_enabled");
}

export function setMilestoneEnabled(enabled: boolean): Promise<void> {
  return invoke("set_milestone_enabled", { enabled });
}

export function getAdvancedProviderStatus(
  provider: string
): Promise<AdvancedProviderStatus> {
  return invoke("get_advanced_provider_status", { provider });
}

export function installAdvancedProviderRuntime(
  provider: string
): Promise<AdvancedProviderStatus> {
  return invoke("install_advanced_provider_runtime", { provider });
}

export function connectAdvancedProvider(provider: string): Promise<void> {
  return invoke("connect_advanced_provider", { provider });
}

export function verifyXiaohongshuAccount(accountId: string): Promise<void> {
  return invoke("verify_xiaohongshu_account", { accountId });
}

export function openRefreshLogs(): Promise<void> {
  return invoke("open_refresh_logs");
}
