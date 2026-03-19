export interface AccountWithStats {
  id: string;
  provider: string;
  username: string;
  display_name: string | null;
  resolved_id: string | null;
  followers: number | null;
  today_change: number | null;
  last_fetched: string | null;
}

export interface Snapshot {
  id: number;
  account_id: string;
  followers: number;
  extra: string | null;
  fetched_at: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  needs_api_key: boolean;
  coming_soon: boolean;
}
