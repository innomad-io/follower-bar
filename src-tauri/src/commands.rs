use crate::account_config::{AccountConfig, BROWSER_PROVIDER_COOLDOWN_MINUTES};
use crate::advanced_runtime::{self, AdvancedProviderStatus};
use crate::db::{Account, Database, Snapshot};
use crate::keychain;
use crate::providers::ProviderManager;
use chrono::Utc;
use futures::stream::{self, StreamExt};
use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;

fn serialize_utc_naive(naive: chrono::NaiveDateTime) -> String {
    chrono::DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc).to_rfc3339()
}

#[derive(Debug, Serialize)]
pub struct SnapshotDto {
    pub id: i64,
    pub account_id: String,
    pub followers: u64,
    pub extra: Option<String>,
    pub fetched_at: String,
}

fn snapshot_to_dto(snapshot: Snapshot) -> SnapshotDto {
    SnapshotDto {
        id: snapshot.id,
        account_id: snapshot.account_id,
        followers: snapshot.followers,
        extra: snapshot.extra,
        fetched_at: serialize_utc_naive(snapshot.fetched_at),
    }
}

pub struct AppState {
    pub db: Mutex<Database>,
    pub providers: ProviderManager,
    pub scheduler: Arc<crate::scheduler::Scheduler>,
    pub milestone_enabled: AtomicBool,
}

#[derive(Debug, Serialize)]
pub struct AccountWithStats {
    pub id: String,
    pub provider: String,
    pub username: String,
    pub display_name: Option<String>,
    pub resolved_id: Option<String>,
    pub followers: Option<u64>,
    pub today_change: Option<i64>,
    pub last_fetched: Option<String>,
    pub provider_state: Option<String>,
    pub provider_message: Option<String>,
    pub can_verify_in_browser: bool,
    pub provider_method: String,
}

#[derive(Debug, Serialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub needs_api_key: bool,
    pub coming_soon: bool,
}

#[derive(Debug, Serialize)]
pub struct RefreshSummary {
    pub refreshed_accounts: usize,
    pub skipped_accounts: usize,
    pub failed_accounts: Vec<String>,
}

const MIN_REFRESH_INTERVAL_SECONDS: i64 = 45;
const LIGHT_REFRESH_CONCURRENCY: usize = 3;

fn append_refresh_error_log(app: &tauri::AppHandle, message: &str) {
    let Some(app_data_dir) = app.path().app_data_dir().ok() else {
        return;
    };

    let logs_dir = app_data_dir.join("advanced-runtime").join("logs");
    if fs::create_dir_all(&logs_dir).is_err() {
        return;
    }

    let log_path = logs_dir.join("refresh-errors.log");
    let timestamp = Utc::now().to_rfc3339();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

enum RefreshOutcome {
    Refreshed,
    Skipped,
}

fn is_browser_provider(provider: &str) -> bool {
    matches!(provider, "xiaohongshu" | "wechat")
}

fn is_lightweight_refresh(provider: &str, provider_method: &str) -> bool {
    match provider {
        "bilibili" => true,
        "youtube" => true,
        "x" => provider_method == "official_api",
        _ => false,
    }
}

async fn refresh_single_account_internal(
    state: &AppState,
    app: &tauri::AppHandle,
    account: &Account,
) -> Result<RefreshOutcome, String> {
    let Some(provider) = state.providers.get(&account.provider) else {
        return Ok(RefreshOutcome::Skipped);
    };
    let mut account_config = AccountConfig::from_json(account.config.as_deref());
    let provider_method = account_config.provider_method_for(&account.provider);

    if account.provider == "xiaohongshu" && account_config.should_skip_xiaohongshu_refresh() {
        return Err(format!(
            "{} ({}) skipped during cooldown: {}",
            provider.name(),
            account.display_name.as_deref().unwrap_or(&account.username),
            account_config
                .provider_message
                .clone()
                .unwrap_or_else(|| "Xiaohongshu requires manual verification.".to_string())
        ));
    }
    if is_browser_provider(&account.provider) && account_config.should_skip_runtime_refresh() {
        return Err(format!(
            "{} ({}) skipped during cooldown: {}",
            provider.name(),
            account.display_name.as_deref().unwrap_or(&account.username),
            account_config
                .provider_message
                .clone()
                .unwrap_or_else(|| "Browser session needs attention before the next refresh.".to_string())
        ));
    }

    {
        let db = state.db.lock().map_err(|err| err.to_string())?;
        if let Some(latest) = db
            .get_latest_snapshot(&account.id)
            .map_err(|err| err.to_string())?
        {
            let seconds_since_last = (Utc::now().naive_utc() - latest.fetched_at).num_seconds();
            if seconds_since_last >= 0 && seconds_since_last < MIN_REFRESH_INTERVAL_SECONDS {
                return Ok(RefreshOutcome::Skipped);
            }
        }
    }

    let fetch_target = account
        .resolved_id
        .as_deref()
        .unwrap_or(account.username.as_str());
    let fetch_result = if account.provider == "xiaohongshu" {
        advanced_runtime::fetch_xiaohongshu_profile(app, fetch_target)
    } else if account.provider == "wechat" {
        advanced_runtime::fetch_wechat_profile(app, fetch_target)
    } else if account.provider == "douyin" {
        advanced_runtime::fetch_douyin_profile(app, fetch_target)
    } else if account.provider == "threads" {
        advanced_runtime::fetch_threads_profile(app, fetch_target)
    } else if account.provider == "instagram" {
        advanced_runtime::fetch_instagram_profile(app, fetch_target)
    } else if account.provider == "zhihu" {
        advanced_runtime::fetch_zhihu_profile(app, fetch_target)
    } else if account.provider == "x" {
        match provider_method.as_str() {
            "official_api" => {
                let api_key = keychain::get_api_key(&account.provider)
                    .map_err(|err| err.to_string())?;
                let token = api_key
                    .as_deref()
                    .ok_or_else(|| "X official API requires a bearer token".to_string())?;
                provider.fetch(fetch_target, Some(token)).await
            }
            _ => advanced_runtime::fetch_x_profile(app, fetch_target),
        }
    } else if account.provider == "youtube" {
        match provider_method.as_str() {
            "official_api" => {
                let api_key = keychain::get_api_key(&account.provider)
                    .map_err(|err| err.to_string())?;
                let key = api_key
                    .as_deref()
                    .ok_or_else(|| "YouTube official API requires an API key".to_string())?;
                provider.fetch(fetch_target, Some(key)).await
            }
            _ => provider.fetch(fetch_target, None).await,
        }
    } else {
        let api_key = if provider.needs_api_key() {
            keychain::get_api_key(&account.provider)
                .map_err(|err| err.to_string())?
        } else {
            None
        };
        provider.fetch(fetch_target, api_key.as_deref()).await
    };

    match fetch_result {
        Ok(data) => {
            let resolved_username = data
                .extra
                .as_ref()
                .and_then(|extra| extra.get("username"))
                .cloned()
                .unwrap_or_else(|| account.username.clone());
            let resolved_id = data
                .extra
                .as_ref()
                .and_then(|extra| extra.get("resolved_id"))
                .cloned()
                .or(account.resolved_id.clone());
            let display_name = data
                .extra
                .as_ref()
                .and_then(|extra| extra.get("display_name"))
                .cloned()
                .or(account.display_name.clone());
            let extra_json = data
                .extra
                .map(|extra| serde_json::to_string(&extra))
                .transpose()
                .map_err(|err| err.to_string())?;

            let db = state.db.lock().map_err(|err| err.to_string())?;
            account_config.clear_runtime_state();
            db.update_account_profile(
                &account.id,
                &resolved_username,
                resolved_id.as_deref(),
                display_name.as_deref(),
            )
            .map_err(|err| err.to_string())?;
            db.update_account_config(&account.id, account_config.to_json().as_deref())
                .map_err(|err| err.to_string())?;
            let prev_followers = db
                .get_latest_snapshot(&account.id)
                .map_err(|err| err.to_string())?
                .map(|snapshot| snapshot.followers)
                .unwrap_or(0);

            db.insert_snapshot(&account.id, data.followers, extra_json.as_deref())
                .map_err(|err| err.to_string())?;
            db.ensure_milestones_for_account(&account.id, data.followers)
                .map_err(|err| err.to_string())?;

            if state.milestone_enabled.load(Ordering::Relaxed) {
                let reached = crate::milestone::MilestoneChecker::check(
                    &db,
                    &account.id,
                    prev_followers,
                    data.followers,
                );

                for (_, target) in reached {
                    let _ = app
                        .notification()
                        .builder()
                        .title("FollowerBar")
                        .body(format!(
                            "🎉 你的 {} 账号 {} 粉丝突破 {}！",
                            provider.name(),
                            display_name.as_deref().unwrap_or(&resolved_username),
                            target
                        ))
                        .show();
                }
            }

            Ok(RefreshOutcome::Refreshed)
        }
        Err(err) => {
            if account.provider == "xiaohongshu"
                && err.to_string().contains("Xiaohongshu showed a security restriction page")
            {
                account_config.mark_xiaohongshu_challenge(
                    "Manual verification required before Xiaohongshu can refresh again.",
                );
                let db = state.db.lock().map_err(|db_err| db_err.to_string())?;
                db.update_account_config(&account.id, account_config.to_json().as_deref())
                    .map_err(|db_err| db_err.to_string())?;
            } else if is_browser_provider(&account.provider)
                && (err.to_string().contains("session is missing or expired")
                    || err.to_string().contains("LOGIN_REQUIRED")
                    || err.to_string().contains("CHALLENGE_REQUIRED"))
            {
                account_config.mark_runtime_cooldown(
                    "session_required",
                    "Browser session needs verification before refreshing again.",
                    BROWSER_PROVIDER_COOLDOWN_MINUTES,
                );
                let db = state.db.lock().map_err(|db_err| db_err.to_string())?;
                db.update_account_config(&account.id, account_config.to_json().as_deref())
                    .map_err(|db_err| db_err.to_string())?;
            }
            Err(format!(
                "{} ({}) failed: {}",
                provider.name(),
                account.display_name.as_deref().unwrap_or(&account.username),
                err
            ))
        }
    }
}

#[tauri::command]
pub async fn verify_xiaohongshu_account(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    account_id: String,
) -> Result<(), String> {
    let account = {
        let db = state.db.lock().map_err(|err| err.to_string())?;
        db.list_accounts()
            .map_err(|err| err.to_string())?
            .into_iter()
            .find(|account| account.id == account_id)
            .ok_or_else(|| "Account not found".to_string())?
    };

    if account.provider != "xiaohongshu" {
        return Err("verify_xiaohongshu_account only supports Xiaohongshu accounts".to_string());
    }

    let fetch_target = account
        .resolved_id
        .as_deref()
        .unwrap_or(account.username.as_str());
    let data = advanced_runtime::verify_xiaohongshu_profile(&app, fetch_target)
        .map_err(|err| err.to_string())?;
    let resolved_username = data
        .extra
        .as_ref()
        .and_then(|extra| extra.get("username"))
        .cloned()
        .unwrap_or_else(|| account.username.clone());
    let resolved_id = data
        .extra
        .as_ref()
        .and_then(|extra| extra.get("resolved_id"))
        .cloned()
        .or(account.resolved_id.clone());
    let display_name = data
        .extra
        .as_ref()
        .and_then(|extra| extra.get("display_name"))
        .cloned()
        .or(account.display_name.clone());
    let extra_json = data
        .extra
        .map(|extra| serde_json::to_string(&extra))
        .transpose()
        .map_err(|err| err.to_string())?;

    let db = state.db.lock().map_err(|err| err.to_string())?;
    db.update_account_profile(
        &account.id,
        &resolved_username,
        resolved_id.as_deref(),
        display_name.as_deref(),
    )
    .map_err(|err| err.to_string())?;
    db.update_account_config(&account.id, None)
        .map_err(|err| err.to_string())?;
    db.insert_snapshot(&account.id, data.followers, extra_json.as_deref())
        .map_err(|err| err.to_string())?;
    db.ensure_milestones_for_account(&account.id, data.followers)
        .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_advanced_provider_status(
    app: tauri::AppHandle,
    provider: String,
) -> Result<AdvancedProviderStatus, String> {
    advanced_runtime::get_provider_status(&app, &provider).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn install_advanced_provider_runtime(
    app: tauri::AppHandle,
    provider: String,
) -> Result<AdvancedProviderStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        advanced_runtime::install_provider_runtime(&app, &provider).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub fn connect_advanced_provider(
    app: tauri::AppHandle,
    provider: String,
) -> Result<(), String> {
    advanced_runtime::connect_provider(&app, &provider).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn open_refresh_logs(app: tauri::AppHandle) -> Result<(), String> {
    let logs_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join("advanced-runtime")
        .join("logs");
    std::fs::create_dir_all(&logs_dir).map_err(|err| err.to_string())?;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountWithStats>, String> {
    let db = state.db.lock().map_err(|err| err.to_string())?;
    let accounts = db.list_accounts().map_err(|err| err.to_string())?;
    let mut result = Vec::with_capacity(accounts.len());

    for account in accounts {
        let latest = db
            .get_latest_snapshot(&account.id)
            .map_err(|err| err.to_string())?;
        let today_first = db
            .get_today_first_snapshot(&account.id)
            .map_err(|err| err.to_string())?;

        let followers = latest.as_ref().map(|snapshot| snapshot.followers);
        let last_fetched = latest
            .as_ref()
            .map(|snapshot| serialize_utc_naive(snapshot.fetched_at));
        let today_change = match (latest.as_ref(), today_first.as_ref()) {
            (Some(latest), Some(today_first)) => {
                Some(latest.followers as i64 - today_first.followers as i64)
            }
            _ => None,
        };
        let config = AccountConfig::from_json(account.config.as_deref());
        let provider = account.provider.clone();

        result.push(AccountWithStats {
            id: account.id,
            provider,
            username: account.username,
            display_name: account.display_name,
            resolved_id: account.resolved_id,
            followers,
            today_change,
            last_fetched,
            provider_state: config.provider_state.clone(),
            provider_message: config.provider_message.clone(),
            can_verify_in_browser: account.provider == "xiaohongshu"
                && config.provider_state.as_deref() == Some("challenge_required"),
            provider_method: config.provider_method_for(&account.provider),
        });
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{serialize_utc_naive, snapshot_to_dto};
    use crate::db::Snapshot;
    use chrono::NaiveDateTime;

    #[test]
    fn serializes_snapshot_timestamp_with_utc_offset() {
        let value = chrono::NaiveDate::from_ymd_opt(2026, 3, 20)
            .expect("valid date")
            .and_hms_opt(1, 2, 3)
            .expect("valid time");

        assert_eq!(serialize_utc_naive(value), "2026-03-20T01:02:03+00:00");
    }

    #[test]
    fn snapshot_dto_uses_rfc3339_timestamp() {
        let snapshot = Snapshot {
            id: 1,
            account_id: "acc".to_string(),
            followers: 6983,
            extra: None,
            fetched_at: NaiveDateTime::parse_from_str(
                "2026-03-20 12:34:56",
                "%Y-%m-%d %H:%M:%S",
            )
            .expect("valid timestamp"),
        };

        let dto = snapshot_to_dto(snapshot);
        assert_eq!(dto.fetched_at, "2026-03-20T12:34:56+00:00");
    }
}

#[tauri::command]
pub async fn add_account(
    state: State<'_, AppState>,
    provider: String,
    username: String,
) -> Result<String, String> {
    let normalized_username = if provider == "wechat" {
        let trimmed = username.trim();
        if trimmed.is_empty() {
            "__wechat_pending__".to_string()
        } else {
            trimmed.to_string()
        }
    } else {
        username.trim().to_string()
    };

    let provider_entry = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("Unknown provider: {provider}"))?;

    if provider_entry.coming_soon() {
        return Err(format!("{provider} is not yet supported"));
    }

    let is_valid = provider_entry
        .validate_username(&normalized_username)
        .await
        .map_err(|err| err.to_string())?;
    if !is_valid {
        return Err(format!("Invalid username for provider {provider}"));
    }

    let id = Uuid::new_v4().to_string();
    let db = state.db.lock().map_err(|err| err.to_string())?;
    db.add_account(&id, &provider, &normalized_username, None, None, None)
        .map_err(|err| err.to_string())?;
    db.ensure_milestones_for_account(&id, 0)
        .map_err(|err| err.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn remove_account(state: State<'_, AppState>, account_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|err| err.to_string())?;
    db.remove_account(&account_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_account(
    state: State<'_, AppState>,
    account_id: String,
    username: String,
    display_name: Option<String>,
    provider_method: Option<String>,
) -> Result<(), String> {
    let trimmed_display_name = display_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let db = state.db.lock().map_err(|err| err.to_string())?;
    let account = db
        .list_accounts()
        .map_err(|err| err.to_string())?
        .into_iter()
        .find(|item| item.id == account_id)
        .ok_or_else(|| "Account not found".to_string())?;

    let normalized_username = if account.provider == "wechat" {
        let trimmed = username.trim();
        if trimmed.is_empty() {
            "__wechat_pending__"
        } else {
            trimmed
        }
    } else {
        let trimmed = username.trim();
        if trimmed.is_empty() {
            return Err("Account identifier cannot be empty".to_string());
        }
        trimmed
    };

    db.update_account_identity(&account_id, normalized_username, trimmed_display_name.as_deref())
        .map_err(|err| err.to_string())?;

    let mut config = AccountConfig::from_json(account.config.as_deref());
    config.provider_method = provider_method;
    db.update_account_config(&account_id, config.to_json().as_deref())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_snapshots_7d(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<SnapshotDto>, String> {
    let db = state.db.lock().map_err(|err| err.to_string())?;
    let since = (Utc::now() - chrono::Duration::days(7)).naive_utc();
    db.get_snapshots_since(&account_id, since)
        .map(|snapshots| snapshots.into_iter().map(snapshot_to_dto).collect())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_available_providers(state: State<'_, AppState>) -> Vec<ProviderInfo> {
    state
        .providers
        .list()
        .iter()
        .map(|provider| ProviderInfo {
            id: provider.id().to_string(),
            name: provider.name().to_string(),
            icon: provider.icon().to_string(),
            needs_api_key: provider.needs_api_key(),
            coming_soon: provider.coming_soon(),
        })
        .collect()
}

pub async fn do_refresh_all(
    state: &AppState,
    app: &tauri::AppHandle,
) -> Result<RefreshSummary, String> {
    let accounts = {
        let db = state.db.lock().map_err(|err| err.to_string())?;
        db.list_accounts().map_err(|err| err.to_string())?
    };
    let mut refreshed_accounts = 0usize;
    let mut skipped_accounts = 0usize;
    let mut failed_accounts = Vec::new();
    let (light_accounts, heavy_accounts): (Vec<_>, Vec<_>) = accounts
        .into_iter()
        .partition(|account| {
            let config = AccountConfig::from_json(account.config.as_deref());
            is_lightweight_refresh(&account.provider, &config.provider_method_for(&account.provider))
        });

    let light_results = stream::iter(light_accounts.into_iter().map(|account| async move {
        let result = refresh_single_account_internal(state, app, &account).await;
        (account, result)
    }))
    .buffer_unordered(LIGHT_REFRESH_CONCURRENCY)
    .collect::<Vec<_>>()
    .await;

    let mut all_results = light_results;
    for account in heavy_accounts {
        let result = refresh_single_account_internal(state, app, &account).await;
        all_results.push((account, result));
    }

    for (account, result) in all_results {
        match result {
            Ok(RefreshOutcome::Refreshed) => refreshed_accounts += 1,
            Ok(RefreshOutcome::Skipped) => skipped_accounts += 1,
            Err(err) => {
                eprintln!(
                    "failed to fetch provider={} username={}: {}",
                    account.provider, account.username, err
                );
                append_refresh_error_log(app, &err);
                failed_accounts.push(err);
            }
        }
    }

    if refreshed_accounts == 0 && !failed_accounts.is_empty() {
        return Err(failed_accounts.join("\n"));
    }

    Ok(RefreshSummary {
        refreshed_accounts,
        skipped_accounts,
        failed_accounts,
    })
}

#[tauri::command]
pub async fn refresh_all(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<RefreshSummary, String> {
    do_refresh_all(&state, &app).await
}

#[tauri::command]
pub async fn refresh_account(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    account_id: String,
) -> Result<(), String> {
    let account = {
        let db = state.db.lock().map_err(|err| err.to_string())?;
        db.list_accounts()
            .map_err(|err| err.to_string())?
            .into_iter()
            .find(|account| account.id == account_id)
            .ok_or_else(|| "Account not found".to_string())?
    };

    match refresh_single_account_internal(&state, &app, &account).await {
        Ok(RefreshOutcome::Refreshed | RefreshOutcome::Skipped) => Ok(()),
        Err(err) => {
            append_refresh_error_log(&app, &err);
            Err(err)
        }
    }
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    keychain::set_api_key(&provider, &key).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_api_key_exists(provider: String) -> Result<bool, String> {
    keychain::get_api_key(&provider)
        .map(|value| value.is_some())
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_refresh_interval(state: State<'_, AppState>) -> u64 {
    state
        .db
        .lock()
        .ok()
        .and_then(|db| db.get_refresh_interval().ok().flatten())
        .unwrap_or_else(|| state.scheduler.get_interval())
}

#[tauri::command]
pub fn set_refresh_interval(
    state: State<'_, AppState>,
    minutes: u64,
) -> Result<(), String> {
    if minutes < 1 {
        return Err("Interval must be at least 1 minute".to_string());
    }

    state.scheduler.set_interval(minutes);
    let db = state.db.lock().map_err(|err| err.to_string())?;
    db.set_refresh_interval(minutes)
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable().map_err(|err| err.to_string())
    } else {
        app.autolaunch().disable().map_err(|err| err.to_string())
    }
}

#[tauri::command]
pub fn get_milestone_enabled(state: State<'_, AppState>) -> bool {
    state
        .db
        .lock()
        .ok()
        .and_then(|db| db.get_milestone_enabled().ok().flatten())
        .unwrap_or_else(|| state.milestone_enabled.load(Ordering::Relaxed))
}

#[tauri::command]
pub fn set_milestone_enabled(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    state.milestone_enabled.store(enabled, Ordering::Relaxed);
    let db = state.db.lock().map_err(|err| err.to_string())?;
    db.set_milestone_enabled(enabled)
        .map_err(|err| err.to_string())?;
    Ok(())
}
