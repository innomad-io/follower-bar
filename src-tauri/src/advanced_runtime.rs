use crate::providers::FollowerData;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};

const ADVANCED_RUNTIME_VERSION: &str = "1";
const XIAOHONGSHU_PROVIDER: &str = "xiaohongshu";
const X_PROVIDER: &str = "x";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedProviderStatus {
    pub provider: String,
    pub runtime_installed: bool,
    pub browser_installed: bool,
    pub session_connected: bool,
    pub state: String,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RuntimeManifest {
    version: String,
    installed_at: String,
}

#[derive(Debug, Deserialize)]
struct SidecarResponse {
    ok: bool,
    #[serde(default)]
    code: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    username: Option<String>,
    #[serde(default)]
    resolved_id: Option<String>,
    #[serde(default)]
    followers: Option<u64>,
}

pub fn get_provider_status(app: &AppHandle, provider: &str) -> Result<AdvancedProviderStatus> {
    ensure_supported(provider)?;
    status_from_root(&runtime_root(app)?, provider)
}

pub fn install_provider_runtime(app: &AppHandle, provider: &str) -> Result<AdvancedProviderStatus> {
    ensure_supported(provider)?;

    let root = runtime_root(app)?;
    fs::create_dir_all(root.join("logs"))?;
    fs::create_dir_all(root.join("profiles").join(provider))?;
    fs::create_dir_all(root.join("browsers"))?;

    run_install_commands(&root)?;

    let manifest = RuntimeManifest {
        version: ADVANCED_RUNTIME_VERSION.to_string(),
        installed_at: Utc::now().to_rfc3339(),
    };
    fs::write(
        manifest_path(&root),
        serde_json::to_vec_pretty(&manifest).context("serialize manifest")?,
    )?;

    status_from_root(&root, provider)
}

pub fn connect_provider(app: &AppHandle, provider: &str) -> Result<()> {
    ensure_supported(provider)?;

    let root = runtime_root(app)?;
    let logs_dir = root.join("logs");
    let profile_dir = profile_dir(&root, provider);
    fs::create_dir_all(&logs_dir)?;
    fs::create_dir_all(&profile_dir)?;
    let _ = fs::remove_file(profile_dir.join(".connected"));

    let payload_path = logs_dir.join(format!("{provider}-connect-request.json"));
    let stdout_path = logs_dir.join(format!("{provider}-connect.stdout.log"));
    let stderr_path = logs_dir.join(format!("{provider}-connect.stderr.log"));
    let payload = json!({
        "action": "connect",
        "platform": provider,
        "runtimeRoot": root,
        "profileDir": profile_dir,
        "browserPath": browsers_dir(&root),
    });

    fs::write(
        &payload_path,
        serde_json::to_vec_pretty(&payload).context("serialize connect payload")?,
    )?;

    let stdout = File::create(stdout_path)?;
    let stderr = File::create(stderr_path)?;

    Command::new("node")
        .arg(sidecar_entry())
        .arg(&payload_path)
        .env("PLAYWRIGHT_BROWSERS_PATH", browsers_dir(&root))
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .context("spawn sidecar connect process")?;

    Ok(())
}

pub fn fetch_xiaohongshu_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    run_xiaohongshu_profile_action(app, input, "fetch_profile")
}

pub fn fetch_x_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_public_profile_action(app, X_PROVIDER, input, "fetch_profile")
}

pub fn verify_xiaohongshu_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    run_xiaohongshu_profile_action(app, input, "verify_profile")
}

fn run_xiaohongshu_profile_action(
    app: &AppHandle,
    input: &str,
    action: &str,
) -> Result<FollowerData> {
    let provider = XIAOHONGSHU_PROVIDER;
    let root = runtime_root(app)?;
    let profile_dir = profile_dir(&root, provider);

    let payload = json!({
        "action": action,
        "platform": provider,
        "runtimeRoot": root,
        "profileDir": profile_dir,
        "browserPath": browsers_dir(&root),
        "account": {
            "input": input,
        }
    });

    let response = run_sidecar_json(payload)?;
    if !response.ok {
        return Err(anyhow!(
            "{}",
            response
                .message
                .unwrap_or_else(|| response.code.unwrap_or_else(|| "Unknown sidecar failure".to_string()))
        ));
    }

    let followers = response
        .followers
        .ok_or_else(|| anyhow!("Xiaohongshu sidecar returned no follower count"))?;
    let username = response
        .username
        .unwrap_or_else(|| input.to_string());
    let resolved_id = response
        .resolved_id
        .clone()
        .unwrap_or_else(|| input.to_string());
    let display_name = response
        .display_name
        .clone()
        .unwrap_or_else(|| username.clone());

    Ok(FollowerData {
        followers,
        fetched_at: Utc::now(),
        extra: Some(
            [
                ("username".to_string(), username),
                ("resolved_id".to_string(), resolved_id),
                ("display_name".to_string(), display_name),
            ]
            .into_iter()
            .collect(),
        ),
    })
}

fn run_public_profile_action(
    app: &AppHandle,
    provider: &str,
    input: &str,
    action: &str,
) -> Result<FollowerData> {
    let root = runtime_root(app)?;
    let payload = json!({
        "action": action,
        "platform": provider,
        "runtimeRoot": root,
        "browserPath": browsers_dir(&root),
        "account": {
            "input": input,
        }
    });

    let response = run_sidecar_json(payload)?;
    if !response.ok {
        return Err(anyhow!(
            "{}",
            response
                .message
                .unwrap_or_else(|| response.code.unwrap_or_else(|| "Unknown sidecar failure".to_string()))
        ));
    }

    let followers = response
        .followers
        .ok_or_else(|| anyhow!("{provider} sidecar returned no follower count"))?;
    let username = response
        .username
        .unwrap_or_else(|| input.to_string());
    let resolved_id = response
        .resolved_id
        .clone()
        .unwrap_or_else(|| input.to_string());
    let display_name = response
        .display_name
        .clone()
        .unwrap_or_else(|| username.clone());

    Ok(FollowerData {
        followers,
        fetched_at: Utc::now(),
        extra: Some(
            [
                ("username".to_string(), username),
                ("resolved_id".to_string(), resolved_id),
                ("display_name".to_string(), display_name),
            ]
            .into_iter()
            .collect(),
        ),
    })
}

fn ensure_runtime_ready(app: &AppHandle) -> Result<()> {
    let root = runtime_root(app)?;
    fs::create_dir_all(root.join("logs"))?;
    fs::create_dir_all(root.join("browsers"))?;

    if manifest_path(&root).exists() && chromium_installed(&root) {
        return Ok(());
    }

    run_install_commands(&root)?;
    let manifest = RuntimeManifest {
        version: ADVANCED_RUNTIME_VERSION.to_string(),
        installed_at: Utc::now().to_rfc3339(),
    };
    fs::write(
        manifest_path(&root),
        serde_json::to_vec_pretty(&manifest).context("serialize manifest")?,
    )?;
    Ok(())
}

fn run_install_commands(root: &Path) -> Result<()> {
    let sidecar_dir = sidecar_dir();
    let browsers_dir = browsers_dir(root);

    let status = Command::new("pnpm")
        .arg("install")
        .arg("--dir")
        .arg(&sidecar_dir)
        .status()
        .context("run pnpm install for provider sidecar")?;
    if !status.success() {
        return Err(anyhow!("Failed to install provider sidecar dependencies"));
    }

    let status = Command::new("pnpm")
        .arg("exec")
        .arg("playwright")
        .arg("install")
        .arg("chromium")
        .env("PLAYWRIGHT_BROWSERS_PATH", &browsers_dir)
        .current_dir(&sidecar_dir)
        .status()
        .context("install Playwright chromium")?;
    if !status.success() {
        return Err(anyhow!("Failed to install Playwright chromium"));
    }

    Ok(())
}

fn run_sidecar_json(payload: serde_json::Value) -> Result<SidecarResponse> {
    let mut child = Command::new("node")
        .arg(sidecar_entry())
        .env(
            "PLAYWRIGHT_BROWSERS_PATH",
            payload
                .get("browserPath")
                .and_then(|value| value.as_str())
                .unwrap_or_default(),
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("spawn provider sidecar")?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| anyhow!("Failed to open sidecar stdin"))?;
        stdin.write_all(payload.to_string().as_bytes())?;
    }

    let output = child.wait_with_output().context("wait for sidecar output")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow!("Provider sidecar failed: {}", stderr.trim()));
    }

    serde_json::from_slice::<SidecarResponse>(&output.stdout)
        .context("parse sidecar JSON response")
}

fn status_from_root(root: &Path, provider: &str) -> Result<AdvancedProviderStatus> {
    ensure_supported(provider)?;

    let runtime_installed = manifest_path(root).exists();
    let browser_installed = chromium_installed(root);
    let session_connected = profile_dir(root, provider).join(".connected").exists();
    let state = if session_connected {
        "connected"
    } else if browser_installed {
        "installed"
    } else if runtime_installed {
        "runtime_installed"
    } else {
        "not_installed"
    };

    Ok(AdvancedProviderStatus {
        provider: provider.to_string(),
        runtime_installed,
        browser_installed,
        session_connected,
        state: state.to_string(),
        detail: None,
    })
}

fn chromium_installed(root: &Path) -> bool {
    let browsers_dir = browsers_dir(root);
    if !browsers_dir.exists() {
        return false;
    }

    fs::read_dir(browsers_dir)
        .ok()
        .map(|entries| entries.filter_map(|entry| entry.ok()).next().is_some())
        .unwrap_or(false)
}

fn runtime_root(app: &AppHandle) -> Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join("advanced-runtime"))
}

fn manifest_path(root: &Path) -> PathBuf {
    root.join("manifest.json")
}

fn profile_dir(root: &Path, provider: &str) -> PathBuf {
    root.join("profiles").join(provider)
}

fn browsers_dir(root: &Path) -> PathBuf {
    root.join("browsers")
}

fn sidecar_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin/provider-sidecar")
}

fn sidecar_entry() -> PathBuf {
    sidecar_dir().join("src/index.mjs")
}

fn ensure_supported(provider: &str) -> Result<()> {
    if provider == XIAOHONGSHU_PROVIDER || provider == X_PROVIDER {
        Ok(())
    } else {
        Err(anyhow!("Unsupported advanced provider: {provider}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_root() -> PathBuf {
        let path = std::env::temp_dir().join(format!("followbar-advanced-runtime-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn status_defaults_to_not_installed() {
        let root = temp_root();
        let status = status_from_root(&root, XIAOHONGSHU_PROVIDER).unwrap();
        assert_eq!(status.state, "not_installed");
        assert!(!status.runtime_installed);
        assert!(!status.browser_installed);
        assert!(!status.session_connected);
    }

    #[test]
    fn status_detects_connected_session() {
        let root = temp_root();
        fs::create_dir_all(profile_dir(&root, XIAOHONGSHU_PROVIDER)).unwrap();
        fs::create_dir_all(browsers_dir(&root).join("chromium-1234")).unwrap();
        fs::write(
            manifest_path(&root),
            serde_json::to_vec(&RuntimeManifest {
                version: ADVANCED_RUNTIME_VERSION.to_string(),
                installed_at: Utc::now().to_rfc3339(),
            })
            .unwrap(),
        )
        .unwrap();
        fs::write(
            profile_dir(&root, XIAOHONGSHU_PROVIDER).join(".connected"),
            "ok",
        )
        .unwrap();

        let status = status_from_root(&root, XIAOHONGSHU_PROVIDER).unwrap();
        assert_eq!(status.state, "connected");
        assert!(status.runtime_installed);
        assert!(status.browser_installed);
        assert!(status.session_connected);
    }
}
