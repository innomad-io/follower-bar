use crate::providers::FollowerData;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

const ADVANCED_RUNTIME_VERSION: &str = "1";
const MINIMUM_NODE_MAJOR: u64 = 22;
const EMBEDDED_NODE_VERSION: &str = "v22.0.0";
const XIAOHONGSHU_PROVIDER: &str = "xiaohongshu";
const X_PROVIDER: &str = "x";
const WECHAT_PROVIDER: &str = "wechat";
const DOUYIN_PROVIDER: &str = "douyin";
const THREADS_PROVIDER: &str = "threads";
const INSTAGRAM_PROVIDER: &str = "instagram";
const ZHIHU_PROVIDER: &str = "zhihu";

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
    #[serde(default)]
    node_source: Option<String>,
    #[serde(default)]
    node_version: Option<String>,
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

struct SidecarDaemon {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    stdout: BufReader<ChildStdout>,
}

#[derive(Debug, Clone, Copy)]
enum NodeRuntimeSource {
    Embedded,
    System,
}

impl NodeRuntimeSource {
    fn as_str(self) -> &'static str {
        match self {
            Self::Embedded => "embedded",
            Self::System => "system",
        }
    }
}

#[derive(Debug, Clone)]
struct ResolvedNodeRuntime {
    executable: PathBuf,
    source: NodeRuntimeSource,
    version: String,
}

static SIDECAR_DAEMON: OnceLock<Mutex<Option<SidecarDaemon>>> = OnceLock::new();

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

    let resolved_node = run_install_commands(app, &root)?;
    write_runtime_manifest(&root, &resolved_node)?;

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
    let resolved_node = ensure_runtime_ready(app)?;

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

    append_runtime_log(
        &root,
        &format!(
            "connect provider={} node_source={} node_version={} node={}",
            provider,
            resolved_node.source.as_str(),
            resolved_node.version,
            resolved_node.executable.display()
        ),
    );

    Command::new(&resolved_node.executable)
        .arg(sidecar_entry(app)?)
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

pub fn fetch_wechat_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_connected_profile_action(app, WECHAT_PROVIDER, input, "fetch_profile")
}

pub fn fetch_douyin_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_public_profile_action(app, DOUYIN_PROVIDER, input, "fetch_profile")
}

pub fn fetch_threads_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_public_profile_action(app, THREADS_PROVIDER, input, "fetch_profile")
}

pub fn fetch_instagram_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_public_profile_action(app, INSTAGRAM_PROVIDER, input, "fetch_profile")
}

pub fn fetch_zhihu_profile(app: &AppHandle, input: &str) -> Result<FollowerData> {
    ensure_runtime_ready(app)?;
    run_public_profile_action(app, ZHIHU_PROVIDER, input, "fetch_profile")
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

    let response = run_sidecar_json(app, payload)?;
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

    let response = run_sidecar_json(app, payload)?;
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

fn run_connected_profile_action(
    app: &AppHandle,
    provider: &str,
    input: &str,
    action: &str,
) -> Result<FollowerData> {
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

    let response = run_sidecar_json(app, payload)?;
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

fn ensure_runtime_ready(app: &AppHandle) -> Result<ResolvedNodeRuntime> {
    let root = runtime_root(app)?;
    fs::create_dir_all(root.join("logs"))?;
    fs::create_dir_all(root.join("browsers"))?;

    let resolved_node = resolve_node_runtime(&root, true)?;

    if manifest_path(&root).exists() && chromium_installed(&root) {
        return Ok(resolved_node);
    }

    let resolved_node = run_install_commands(app, &root)?;
    write_runtime_manifest(&root, &resolved_node)?;
    Ok(resolved_node)
}

fn run_install_commands(app: &AppHandle, root: &Path) -> Result<ResolvedNodeRuntime> {
    let sidecar_dir = sidecar_dir(app)?;
    let browsers_dir = browsers_dir(root);
    let playwright_cli = sidecar_dir
        .join("node_modules")
        .join("playwright")
        .join("cli.js");

    if !playwright_cli.exists() {
        if cfg!(debug_assertions) {
            let status = Command::new("pnpm")
                .arg("install")
                .arg("--dir")
                .arg(&sidecar_dir)
                .status()
                .context("run pnpm install for provider sidecar")?;
            if !status.success() {
                return Err(anyhow!("Failed to install provider sidecar dependencies"));
            }
        } else {
            return Err(anyhow!(
                "Provider sidecar dependencies are missing from the bundled app resources"
            ));
        }
    }

    let resolved_node = resolve_node_runtime(root, true)?;
    append_runtime_log(
        root,
        &format!(
            "install runtime node_source={} node_version={} node={} browsers={}",
            resolved_node.source.as_str(),
            resolved_node.version,
            resolved_node.executable.display(),
            browsers_dir.display()
        ),
    );

    let status = Command::new(&resolved_node.executable)
        .arg(&playwright_cli)
        .arg("install")
        .arg("chromium")
        .env("PLAYWRIGHT_BROWSERS_PATH", &browsers_dir)
        .current_dir(&sidecar_dir)
        .status()
        .context("install Playwright chromium")?;
    if !status.success() {
        return Err(anyhow!("Failed to install Playwright chromium"));
    }

    Ok(resolved_node)
}

fn run_sidecar_json(app: &AppHandle, payload: serde_json::Value) -> Result<SidecarResponse> {
    let browser_path = payload
        .get("browserPath")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let logs_dir = payload
        .get("runtimeRoot")
        .and_then(|value| value.as_str())
        .map(PathBuf::from)
        .map(|root| root.join("logs"))
        .unwrap_or_else(|| sidecar_dir(app).unwrap_or_else(|_| PathBuf::from(".")).join("logs"));

    let daemon_lock = SIDECAR_DAEMON.get_or_init(|| Mutex::new(None));
    let mut daemon_slot = daemon_lock
        .lock()
        .map_err(|_| anyhow!("Failed to lock sidecar daemon state"))?;

    if daemon_slot.is_none() {
        *daemon_slot = Some(spawn_sidecar_daemon(app, &browser_path, &logs_dir)?);
    }

    let first_attempt = daemon_request(
        daemon_slot
            .as_mut()
            .ok_or_else(|| anyhow!("Sidecar daemon failed to start"))?,
        &payload,
    );

    match first_attempt {
        Ok(response) => Ok(response),
        Err(first_error) => {
            *daemon_slot = Some(spawn_sidecar_daemon(app, &browser_path, &logs_dir)?);
            daemon_request(
                daemon_slot
                    .as_mut()
                    .ok_or_else(|| anyhow!("Sidecar daemon failed to restart"))?,
                &payload,
            )
            .with_context(|| format!("Provider sidecar failed after restart: {first_error}"))
        }
    }
}

fn spawn_sidecar_daemon(app: &AppHandle, browser_path: &str, logs_dir: &Path) -> Result<SidecarDaemon> {
    fs::create_dir_all(logs_dir)?;
    let stderr_log = File::create(logs_dir.join("provider-sidecar-daemon.stderr.log"))
        .context("create sidecar daemon stderr log")?;
    let root = logs_dir
        .parent()
        .ok_or_else(|| anyhow!("invalid logs dir"))?
        .to_path_buf();
    let resolved_node = resolve_node_runtime(&root, true)?;
    append_runtime_log(
        &root,
        &format!(
            "spawn daemon node_source={} node_version={} node={}",
            resolved_node.source.as_str(),
            resolved_node.version,
            resolved_node.executable.display()
        ),
    );

    let mut child = Command::new(&resolved_node.executable)
        .arg(sidecar_entry(app)?)
        .arg("--daemon")
        .env("PLAYWRIGHT_BROWSERS_PATH", browser_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(stderr_log))
        .spawn()
        .context("spawn provider sidecar daemon")?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| anyhow!("Failed to open sidecar daemon stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("Failed to open sidecar daemon stdout"))?;

    Ok(SidecarDaemon {
        child,
        stdin: BufWriter::new(stdin),
        stdout: BufReader::new(stdout),
    })
}

fn daemon_request(daemon: &mut SidecarDaemon, payload: &serde_json::Value) -> Result<SidecarResponse> {
    if let Some(status) = daemon.child.try_wait().context("poll sidecar daemon")? {
        return Err(anyhow!("Sidecar daemon exited unexpectedly with status {status}"));
    }

    daemon
        .stdin
        .write_all(payload.to_string().as_bytes())
        .context("write sidecar daemon payload")?;
    daemon
        .stdin
        .write_all(b"\n")
        .context("write sidecar daemon payload newline")?;
    daemon.stdin.flush().context("flush sidecar daemon payload")?;

    let mut line = String::new();
    let bytes = daemon
        .stdout
        .read_line(&mut line)
        .context("read sidecar daemon response")?;
    if bytes == 0 {
        return Err(anyhow!("Sidecar daemon closed stdout"));
    }

    serde_json::from_str::<SidecarResponse>(line.trim_end())
        .context("parse sidecar daemon JSON response")
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

fn node_root(root: &Path) -> PathBuf {
    root.join("node")
}

fn node_platform_dir(root: &Path) -> Result<PathBuf> {
    Ok(node_root(root).join(node_platform_key()?))
}

fn profile_dir(root: &Path, provider: &str) -> PathBuf {
    root.join("profiles").join(provider)
}

fn browsers_dir(root: &Path) -> PathBuf {
    root.join("browsers")
}

fn sidecar_dir(app: &AppHandle) -> Result<PathBuf> {
    if cfg!(debug_assertions) {
        return Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("bin/provider-sidecar"));
    }

    let resource_dir = app.path().resource_dir()?;
    for candidate in [
        resource_dir.join("provider-sidecar"),
        resource_dir.join("bin").join("provider-sidecar"),
    ] {
        if candidate.join("src").join("index.mjs").exists() {
            return Ok(candidate);
        }
    }

    Err(anyhow!("Bundled provider sidecar resources not found"))
}

fn sidecar_entry(app: &AppHandle) -> Result<PathBuf> {
    Ok(sidecar_dir(app)?.join("src/index.mjs"))
}

fn write_runtime_manifest(root: &Path, resolved_node: &ResolvedNodeRuntime) -> Result<()> {
    let manifest = RuntimeManifest {
        version: ADVANCED_RUNTIME_VERSION.to_string(),
        installed_at: Utc::now().to_rfc3339(),
        node_source: Some(resolved_node.source.as_str().to_string()),
        node_version: Some(resolved_node.version.clone()),
    };
    fs::write(
        manifest_path(root),
        serde_json::to_vec_pretty(&manifest).context("serialize manifest")?,
    )?;
    Ok(())
}

fn resolve_node_runtime(root: &Path, allow_download: bool) -> Result<ResolvedNodeRuntime> {
    if let Some(embedded) = resolve_embedded_node(root)? {
        return Ok(embedded);
    }

    if let Some(system) = resolve_system_node()? {
        append_runtime_log(
            root,
            &format!("using system node version={}", system.version),
        );
        return Ok(system);
    }

    if !allow_download {
        return Err(anyhow!(
            "Node runtime is not available. Install runtime first or provide Node >= {MINIMUM_NODE_MAJOR}."
        ));
    }

    install_embedded_node(root)?;
    let embedded = resolve_embedded_node(root)?
        .ok_or_else(|| anyhow!("Embedded Node runtime installation failed"))?;
    append_runtime_log(
        root,
        &format!("using embedded node version={}", embedded.version),
    );
    Ok(embedded)
}

fn resolve_embedded_node(root: &Path) -> Result<Option<ResolvedNodeRuntime>> {
    let executable = node_platform_dir(root)?.join("bin/node");
    if !executable.exists() {
        return Ok(None);
    }

    let version = read_node_version(&executable)
        .with_context(|| format!("read embedded node version from {}", executable.display()))?;
    if !is_supported_node_version(&version) {
        append_runtime_log(
            root,
            &format!(
                "embedded node ignored version={} path={}",
                version,
                executable.display()
            ),
        );
        return Ok(None);
    }

    Ok(Some(ResolvedNodeRuntime {
        executable,
        source: NodeRuntimeSource::Embedded,
        version,
    }))
}

fn resolve_system_node() -> Result<Option<ResolvedNodeRuntime>> {
    let version = match read_node_version(Path::new("node")) {
        Ok(version) => version,
        Err(_) => return Ok(None),
    };
    if !is_supported_node_version(&version) {
        return Ok(None);
    }

    Ok(Some(ResolvedNodeRuntime {
        executable: PathBuf::from("node"),
        source: NodeRuntimeSource::System,
        version,
    }))
}

fn read_node_version(executable: &Path) -> Result<String> {
    let output = Command::new(executable)
        .arg("--version")
        .output()
        .with_context(|| format!("run {} --version", executable.display()))?;
    if !output.status.success() {
        return Err(anyhow!(
            "{} --version exited with status {}",
            executable.display(),
            output.status
        ));
    }

    let version = String::from_utf8(output.stdout)
        .context("decode node version output")?
        .trim()
        .to_string();
    if version.is_empty() {
        return Err(anyhow!("node --version returned empty output"));
    }
    Ok(version)
}

fn parse_node_major_version(version: &str) -> Option<u64> {
    version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|major| major.parse::<u64>().ok())
}

fn is_supported_node_version(version: &str) -> bool {
    parse_node_major_version(version)
        .map(|major| major >= MINIMUM_NODE_MAJOR)
        .unwrap_or(false)
}

fn install_embedded_node(root: &Path) -> Result<()> {
    let node_dir = node_platform_dir(root)?;
    let node_parent = node_dir
        .parent()
        .ok_or_else(|| anyhow!("invalid embedded node directory"))?;
    fs::create_dir_all(node_parent)?;

    let archive_name = node_archive_name()?;
    let base_url = format!("https://nodejs.org/dist/{EMBEDDED_NODE_VERSION}");
    let archive_url = format!("{base_url}/{archive_name}");
    let shasums_url = format!("{base_url}/SHASUMS256.txt");
    let downloads_dir = node_root(root).join("downloads");
    fs::create_dir_all(&downloads_dir)?;
    let archive_path = downloads_dir.join(&archive_name);
    let shasums_path = downloads_dir.join("SHASUMS256.txt");
    let tmp_dir = node_root(root).join(format!(".tmp-{}", Utc::now().timestamp_millis()));

    append_runtime_log(root, &format!("download embedded node from {archive_url}"));
    download_file(&archive_url, &archive_path)?;
    download_file(&shasums_url, &shasums_path)?;

    let shasums_text = fs::read_to_string(&shasums_path).context("read node SHASUMS256.txt")?;
    let expected_sha =
        checksum_for_archive(&shasums_text, &archive_name).ok_or_else(|| {
            anyhow!("Failed to find checksum for embedded Node archive {archive_name}")
        })?;
    verify_file_checksum(&archive_path, &expected_sha)?;

    if tmp_dir.exists() {
        fs::remove_dir_all(&tmp_dir).with_context(|| format!("remove {}", tmp_dir.display()))?;
    }
    fs::create_dir_all(&tmp_dir)?;
    extract_tarball(&archive_path, &tmp_dir)?;
    if node_dir.exists() {
        fs::remove_dir_all(&node_dir).with_context(|| format!("remove {}", node_dir.display()))?;
    }
    fs::rename(&tmp_dir, &node_dir)
        .with_context(|| format!("move embedded node into {}", node_dir.display()))?;
    let executable = node_dir.join("bin/node");
    if !executable.exists() {
        return Err(anyhow!(
            "Embedded Node executable not found after extract: {}",
            executable.display()
        ));
    }

    append_runtime_log(
        root,
        &format!("embedded node installed path={}", executable.display()),
    );
    Ok(())
}

fn download_file(url: &str, destination: &Path) -> Result<()> {
    if destination.exists() {
        fs::remove_file(destination)
            .with_context(|| format!("remove {}", destination.display()))?;
    }

    let status = Command::new("curl")
        .arg("-L")
        .arg("-f")
        .arg("-o")
        .arg(destination)
        .arg(url)
        .status()
        .with_context(|| format!("download {}", url))?;
    if !status.success() {
        return Err(anyhow!("Failed to download {}", url));
    }
    Ok(())
}

fn checksum_for_archive(shasums: &str, archive_name: &str) -> Option<String> {
    shasums.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let sha = parts.next()?;
        let name = parts.next()?;
        if name == archive_name {
            Some(sha.to_string())
        } else {
            None
        }
    })
}

fn verify_file_checksum(file: &Path, expected_sha: &str) -> Result<()> {
    let output = Command::new("shasum")
        .arg("-a")
        .arg("256")
        .arg(file)
        .output()
        .with_context(|| format!("calculate checksum for {}", file.display()))?;
    if !output.status.success() {
        return Err(anyhow!("Failed to calculate checksum for {}", file.display()));
    }
    let actual = String::from_utf8(output.stdout)
        .context("decode shasum output")?
        .split_whitespace()
        .next()
        .ok_or_else(|| anyhow!("Invalid shasum output"))?
        .to_string();
    if actual != expected_sha {
        return Err(anyhow!(
            "Checksum mismatch for {}: expected {}, got {}",
            file.display(),
            expected_sha,
            actual
        ));
    }
    Ok(())
}

fn extract_tarball(archive_path: &Path, destination: &Path) -> Result<()> {
    let status = Command::new("tar")
        .arg("-xzf")
        .arg(archive_path)
        .arg("--strip-components=1")
        .arg("-C")
        .arg(destination)
        .status()
        .with_context(|| format!("extract {}", archive_path.display()))?;
    if !status.success() {
        return Err(anyhow!("Failed to extract {}", archive_path.display()));
    }
    Ok(())
}

fn node_archive_name() -> Result<String> {
    Ok(format!(
        "node-{EMBEDDED_NODE_VERSION}-{}.tar.gz",
        node_platform_key()?
    ))
}

fn node_platform_key() -> Result<&'static str> {
    match std::env::consts::ARCH {
        "aarch64" => Ok("darwin-arm64"),
        "x86_64" => Ok("darwin-x64"),
        arch => Err(anyhow!("Unsupported Node runtime architecture: {arch}")),
    }
}

fn append_runtime_log(root: &Path, message: &str) {
    let logs_dir = root.join("logs");
    let _ = fs::create_dir_all(&logs_dir);
    let log_path = logs_dir.join("runtime-install.log");
    let timestamp = Utc::now().to_rfc3339();
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

fn ensure_supported(provider: &str) -> Result<()> {
    if provider == XIAOHONGSHU_PROVIDER
        || provider == X_PROVIDER
        || provider == WECHAT_PROVIDER
        || provider == DOUYIN_PROVIDER
        || provider == THREADS_PROVIDER
        || provider == INSTAGRAM_PROVIDER
        || provider == ZHIHU_PROVIDER
    {
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
                node_source: None,
                node_version: None,
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

    #[test]
    fn parses_node_major_version() {
        assert_eq!(parse_node_major_version("v22.3.0"), Some(22));
        assert_eq!(parse_node_major_version("22.3.0"), Some(22));
        assert_eq!(parse_node_major_version("nope"), None);
    }

    #[test]
    fn validates_supported_node_version() {
        assert!(is_supported_node_version("v22.0.0"));
        assert!(is_supported_node_version("v24.1.0"));
        assert!(!is_supported_node_version("v20.18.0"));
    }

    #[test]
    fn finds_checksum_for_archive() {
        let shasums = "abc123  node-v22.0.0-darwin-arm64.tar.gz\nxyz789  other-file.tar.gz\n";
        assert_eq!(
            checksum_for_archive(shasums, "node-v22.0.0-darwin-arm64.tar.gz").as_deref(),
            Some("abc123")
        );
        assert!(checksum_for_archive(shasums, "missing.tar.gz").is_none());
    }
}
