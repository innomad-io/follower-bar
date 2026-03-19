# FollowBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mac menubar app (FollowBar) that tracks social media follower counts across multiple platforms with milestone notifications.

**Architecture:** Tauri v2 app with Rust backend handling data fetching, SQLite storage, and scheduling. React + TypeScript frontend renders a popup panel from the tray icon. Provider trait pattern enables extensible platform support.

**Tech Stack:** Tauri v2, React, TypeScript, Tailwind CSS, Rust, reqwest, rusqlite, recharts, tauri-plugin-notification

**Spec:** `docs/superpowers/specs/2026-03-19-followbar-design.md`

---

## File Structure

```
followbar/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                  # Tauri app builder, plugin init, tray setup
│   │   ├── db.rs                   # SQLite schema, migrations, CRUD operations
│   │   ├── keychain.rs            # macOS Keychain wrapper for API key storage
│   │   ├── providers/
│   │   │   ├── mod.rs              # Provider trait, ProviderManager, FollowerData
│   │   │   ├── bilibili.rs        # Bilibili provider (first batch)
│   │   │   ├── youtube.rs         # YouTube provider (first batch)
│   │   │   └── x.rs              # X/Twitter provider (first batch)
│   │   ├── scheduler.rs           # Timed fetch scheduling
│   │   ├── milestone.rs           # Milestone detection and notification logic
│   │   └── commands.rs            # Tauri IPC command handlers
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json           # Tauri permissions
│   └── icons/                     # App icons
├── src/
│   ├── main.tsx                   # React entry point
│   ├── App.tsx                    # Root component, view routing
│   ├── components/
│   │   ├── AccountList.tsx        # List of all tracked accounts
│   │   ├── AccountRow.tsx         # Single account row with expand/collapse
│   │   ├── MiniChart.tsx          # 7-day sparkline chart
│   │   ├── Settings.tsx           # Settings view
│   │   └── AddAccount.tsx         # Add account form
│   ├── hooks/
│   │   └── useAccounts.ts         # IPC data fetching hook
│   ├── lib/
│   │   └── commands.ts            # Typed Tauri invoke wrappers
│   └── types.ts                   # Shared TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── index.html
```

---

## Task 1: Scaffold Tauri v2 + React + TypeScript Project

**Files:**
- Create: `followbar/` (entire scaffold)
- Modify: `followbar/src-tauri/Cargo.toml` (add dependencies)
- Modify: `followbar/package.json` (add dependencies)
- Modify: `followbar/src-tauri/tauri.conf.json` (configure as menubar app)

- [ ] **Step 1: Create Tauri project**

```bash
cd /Users/innomad/lab/sandbox
pnpm create tauri-app followbar -- --template react-ts --manager pnpm
```

Select: TypeScript, pnpm, React, TypeScript.

- [ ] **Step 2: Install frontend dependencies**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm install
pnpm add recharts tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure Tailwind CSS**

Create `followbar/src/index.css`:
```css
@import "tailwindcss";
```

Update `followbar/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
```

- [ ] **Step 4: Add Rust dependencies to `src-tauri/Cargo.toml`**

Add under `[dependencies]`:
```toml
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-notification = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 5: Configure `tauri.conf.json` as menubar app**

Key settings — no dock icon, no visible window on launch, tray-only:
```json
{
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "main",
        "title": "FollowBar",
        "width": 360,
        "height": 480,
        "visible": false,
        "decorations": false,
        "resizable": false,
        "skipTaskbar": true,
        "alwaysOnTop": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/icon.png"],
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "13.0"
    }
  }
}
```

Also create `followbar/src-tauri/Info.plist` override (or set in tauri.conf.json `bundle.macOS.infoPlist`) to hide Dock icon:
```xml
<key>LSUIElement</key>
<true/>
```

- [ ] **Step 6: Configure capabilities**

Create `followbar/src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify"
  ]
}
```

- [ ] **Step 7: Verify project builds**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm tauri dev
```

Expected: App builds and runs (window hidden, no tray icon yet). Ctrl+C to stop.

- [ ] **Step 8: Initialize git and commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git init
echo "node_modules/\ntarget/\ndist/" > .gitignore
git add .
git commit -m "chore: scaffold Tauri v2 + React + TypeScript project"
```

---

## Task 2: SQLite Database Layer

**Files:**
- Create: `followbar/src-tauri/src/db.rs`
- Modify: `followbar/src-tauri/src/lib.rs` (import db module)

- [ ] **Step 1: Write db.rs with schema and CRUD**

Create `followbar/src-tauri/src/db.rs`:
```rust
use chrono::{NaiveDateTime, Utc};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub provider: String,
    pub username: String,
    pub config: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Snapshot {
    pub id: i64,
    pub account_id: String,
    pub followers: u64,
    pub extra: Option<String>,
    pub fetched_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: i64,
    pub account_id: String,
    pub target: u64,
    pub reached_at: Option<NaiveDateTime>,
    pub notified: bool,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                username TEXT NOT NULL,
                config TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                followers INTEGER NOT NULL,
                extra TEXT,
                fetched_at DATETIME NOT NULL
            );
            CREATE TABLE IF NOT EXISTS milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL REFERENCES accounts(id),
                target INTEGER NOT NULL,
                reached_at DATETIME,
                notified BOOLEAN NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_snapshots_account ON snapshots(account_id, fetched_at);
            CREATE INDEX IF NOT EXISTS idx_milestones_account ON milestones(account_id);"
        )
    }

    pub fn add_account(&self, id: &str, provider: &str, username: &str, config: Option<&str>) -> Result<()> {
        self.conn.execute(
            "INSERT INTO accounts (id, provider, username, config) VALUES (?1, ?2, ?3, ?4)",
            params![id, provider, username, config],
        )?;
        Ok(())
    }

    pub fn remove_account(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM snapshots WHERE account_id = ?1", params![id])?;
        self.conn.execute("DELETE FROM milestones WHERE account_id = ?1", params![id])?;
        self.conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_accounts(&self) -> Result<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, provider, username, config, created_at FROM accounts ORDER BY created_at"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                provider: row.get(1)?,
                username: row.get(2)?,
                config: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn insert_snapshot(&self, account_id: &str, followers: u64, extra: Option<&str>) -> Result<()> {
        self.conn.execute(
            "INSERT INTO snapshots (account_id, followers, extra, fetched_at) VALUES (?1, ?2, ?3, ?4)",
            params![account_id, followers, extra, Utc::now().naive_utc()],
        )?;
        Ok(())
    }

    pub fn get_latest_snapshot(&self, account_id: &str) -> Result<Option<Snapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, followers, extra, fetched_at FROM snapshots
             WHERE account_id = ?1 ORDER BY fetched_at DESC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(params![account_id], |row| {
            Ok(Snapshot {
                id: row.get(0)?,
                account_id: row.get(1)?,
                followers: row.get(2)?,
                extra: row.get(3)?,
                fetched_at: row.get(4)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn get_snapshots_since(&self, account_id: &str, since: NaiveDateTime) -> Result<Vec<Snapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, followers, extra, fetched_at FROM snapshots
             WHERE account_id = ?1 AND fetched_at >= ?2 ORDER BY fetched_at"
        )?;
        let rows = stmt.query_map(params![account_id, since], |row| {
            Ok(Snapshot {
                id: row.get(0)?,
                account_id: row.get(1)?,
                followers: row.get(2)?,
                extra: row.get(3)?,
                fetched_at: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_today_first_snapshot(&self, account_id: &str) -> Result<Option<Snapshot>> {
        let today = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, followers, extra, fetched_at FROM snapshots
             WHERE account_id = ?1 AND fetched_at >= ?2 ORDER BY fetched_at ASC LIMIT 1"
        )?;
        let mut rows = stmt.query_map(params![account_id, today], |row| {
            Ok(Snapshot {
                id: row.get(0)?,
                account_id: row.get(1)?,
                followers: row.get(2)?,
                extra: row.get(3)?,
                fetched_at: row.get(4)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn cleanup_old_snapshots(&self) -> Result<usize> {
        let cutoff = (Utc::now() - chrono::Duration::days(7)).naive_utc();
        // Keep only the last snapshot per day for records older than 7 days
        let deleted = self.conn.execute(
            "DELETE FROM snapshots WHERE fetched_at < ?1
             AND id NOT IN (
                SELECT s.id FROM snapshots s
                INNER JOIN (
                    SELECT account_id, DATE(fetched_at) as day, MAX(fetched_at) as max_fetched
                    FROM snapshots WHERE fetched_at < ?1
                    GROUP BY account_id, DATE(fetched_at)
                ) latest ON s.account_id = latest.account_id
                    AND DATE(s.fetched_at) = latest.day
                    AND s.fetched_at = latest.max_fetched
             )",
            params![cutoff],
        )?;
        Ok(deleted)
    }

    // Milestone operations
    pub fn get_unreached_milestones(&self, account_id: &str) -> Result<Vec<Milestone>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, account_id, target, reached_at, notified FROM milestones
             WHERE account_id = ?1 AND reached_at IS NULL ORDER BY target"
        )?;
        let rows = stmt.query_map(params![account_id], |row| {
            Ok(Milestone {
                id: row.get(0)?,
                account_id: row.get(1)?,
                target: row.get(2)?,
                reached_at: row.get(3)?,
                notified: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    pub fn mark_milestone_reached(&self, milestone_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE milestones SET reached_at = ?1, notified = 1 WHERE id = ?2",
            params![Utc::now().naive_utc(), milestone_id],
        )?;
        Ok(())
    }

    pub fn ensure_milestones_for_account(&self, account_id: &str, current_followers: u64) -> Result<()> {
        let targets: Vec<u64> = vec![
            100, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 500_000, 1_000_000,
        ];
        for target in targets {
            if target > current_followers {
                let exists: bool = self.conn.query_row(
                    "SELECT COUNT(*) > 0 FROM milestones WHERE account_id = ?1 AND target = ?2",
                    params![account_id, target],
                    |row| row.get(0),
                )?;
                if !exists {
                    self.conn.execute(
                        "INSERT INTO milestones (account_id, target) VALUES (?1, ?2)",
                        params![account_id, target],
                    )?;
                }
            }
        }
        Ok(())
    }
}
```

- [ ] **Step 2: Add db module to lib.rs**

Add `mod db;` to `followbar/src-tauri/src/lib.rs`.

- [ ] **Step 3: Write unit tests for db**

Add at the bottom of `followbar/src-tauri/src/db.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_db() -> Database {
        Database::open(&PathBuf::from(":memory:")).unwrap()
    }

    #[test]
    fn test_add_and_list_accounts() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "test_user", None).unwrap();
        let accounts = db.list_accounts().unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].provider, "bilibili");
        assert_eq!(accounts[0].username, "test_user");
    }

    #[test]
    fn test_remove_account_cascades() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "test_user", None).unwrap();
        db.insert_snapshot("acc1", 100, None).unwrap();
        db.remove_account("acc1").unwrap();
        let accounts = db.list_accounts().unwrap();
        assert_eq!(accounts.len(), 0);
    }

    #[test]
    fn test_snapshots() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "user", None).unwrap();
        db.insert_snapshot("acc1", 100, None).unwrap();
        db.insert_snapshot("acc1", 105, None).unwrap();
        let latest = db.get_latest_snapshot("acc1").unwrap().unwrap();
        assert_eq!(latest.followers, 105);
    }

    #[test]
    fn test_milestones() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "user", None).unwrap();
        db.ensure_milestones_for_account("acc1", 50).unwrap();
        let unreached = db.get_unreached_milestones("acc1").unwrap();
        assert!(unreached.iter().any(|m| m.target == 100));
        assert!(unreached.iter().any(|m| m.target == 500));
        // Should not create milestones for targets below current followers
        assert!(!unreached.iter().any(|m| m.target == 50));
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test db::tests -- --nocapture
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/db.rs src-tauri/src/lib.rs
git commit -m "feat: add SQLite database layer with schema, CRUD, and tests"
```

---

## Task 3: Provider Trait + Bilibili Provider

**Files:**
- Create: `followbar/src-tauri/src/providers/mod.rs`
- Create: `followbar/src-tauri/src/providers/bilibili.rs`
- Modify: `followbar/src-tauri/src/lib.rs`

- [ ] **Step 1: Write Provider trait and ProviderManager**

Create `followbar/src-tauri/src/providers/mod.rs`:
```rust
pub mod bilibili;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FollowerData {
    pub followers: u64,
    pub fetched_at: DateTime<Utc>,
    pub extra: Option<HashMap<String, String>>,
}

/// Note: fetch is async (differs from spec's sync signature) because all providers
/// perform network I/O. This is an intentional implementation decision.
#[async_trait::async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn icon(&self) -> &str;
    fn needs_api_key(&self) -> bool;
    async fn fetch(&self, username: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData>;
    async fn validate_username(&self, username: &str) -> anyhow::Result<bool>;
}

pub struct ProviderManager {
    providers: HashMap<String, Box<dyn Provider>>,
}

impl ProviderManager {
    pub fn new() -> Self {
        let mut manager = Self {
            providers: HashMap::new(),
        };
        manager.register(Box::new(bilibili::BilibiliProvider));
        // YouTube and X providers registered in Task 14 and 15
        manager
    }

    pub fn register(&mut self, provider: Box<dyn Provider>) {
        self.providers.insert(provider.id().to_string(), provider);
    }

    pub fn get(&self, id: &str) -> Option<&dyn Provider> {
        self.providers.get(id).map(|p| p.as_ref())
    }

    pub fn list(&self) -> Vec<&dyn Provider> {
        self.providers.values().map(|p| p.as_ref()).collect()
    }
}
```

- [ ] **Step 2: Add async-trait and anyhow to Cargo.toml**

Add to `[dependencies]` in `followbar/src-tauri/Cargo.toml`:
```toml
async-trait = "0.1"
anyhow = "1"
```

- [ ] **Step 3: Write Bilibili provider**

Create `followbar/src-tauri/src/providers/bilibili.rs`:
```rust
use super::{FollowerData, Provider};
use chrono::Utc;
use serde::Deserialize;

pub struct BilibiliProvider;

#[derive(Deserialize)]
struct BiliResponse {
    code: i32,
    data: Option<BiliData>,
}

#[derive(Deserialize)]
struct BiliData {
    follower: u64,
}

#[async_trait::async_trait]
impl Provider for BilibiliProvider {
    fn id(&self) -> &str {
        "bilibili"
    }

    fn name(&self) -> &str {
        "Bilibili"
    }

    fn icon(&self) -> &str {
        "bilibili"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    async fn fetch(&self, username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        // username here is the Bilibili UID (numeric)
        let url = format!(
            "https://api.bilibili.com/x/relation/stat?vmid={}",
            username
        );
        let resp: BiliResponse = reqwest::get(&url).await?.json().await?;

        if resp.code != 0 {
            anyhow::bail!("Bilibili API error: code {}", resp.code);
        }

        let data = resp.data.ok_or_else(|| anyhow::anyhow!("No data in response"))?;

        Ok(FollowerData {
            followers: data.follower,
            fetched_at: Utc::now(),
            extra: None,
        })
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        // Check if UID is numeric
        Ok(username.chars().all(|c| c.is_ascii_digit()) && !username.is_empty())
    }
}
```

- [ ] **Step 4: Add providers module to lib.rs**

Add `mod providers;` to `followbar/src-tauri/src/lib.rs`.

- [ ] **Step 5: Write integration test for Bilibili provider**

Create `followbar/src-tauri/tests/bilibili_test.rs`:
```rust
use followbar_lib::providers::bilibili::BilibiliProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_bilibili_fetch_real() {
    // UID 1 is bilibili's official account, always exists
    let provider = BilibiliProvider;
    let result = provider.fetch("1").await;
    assert!(result.is_ok());
    let data = result.unwrap();
    assert!(data.followers > 0);
}
```

Note: This test requires network access. Rename `src-tauri/src/main.rs` logic into `lib.rs` if needed to expose modules as `followbar_lib`. In `src-tauri/Cargo.toml`, set:
```toml
[lib]
name = "followbar_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 6: Run test**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test bilibili_test -- --nocapture
```

Expected: PASS, fetches real Bilibili follower count.

- [ ] **Step 7: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/providers/ src-tauri/tests/ src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "feat: add Provider trait and Bilibili provider with integration test"
```

---

## Task 4: Milestone Detection Logic

**Files:**
- Create: `followbar/src-tauri/src/milestone.rs`
- Modify: `followbar/src-tauri/src/lib.rs`

- [ ] **Step 1: Write milestone.rs**

Create `followbar/src-tauri/src/milestone.rs`:
```rust
use crate::db::Database;

pub const MILESTONE_TARGETS: &[u64] = &[
    100, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 500_000, 1_000_000,
];

pub struct MilestoneChecker;

impl MilestoneChecker {
    /// Check if any milestones were crossed between prev and current follower counts.
    /// Returns list of (milestone_id, target) that were just reached.
    pub fn check(db: &Database, account_id: &str, prev_followers: u64, current_followers: u64) -> Vec<(i64, u64)> {
        if current_followers <= prev_followers {
            return vec![];
        }

        let mut reached = vec![];
        if let Ok(unreached) = db.get_unreached_milestones(account_id) {
            for milestone in unreached {
                if prev_followers < milestone.target && current_followers >= milestone.target {
                    if db.mark_milestone_reached(milestone.id).is_ok() {
                        reached.push((milestone.id, milestone.target));
                    }
                }
            }
        }
        reached
    }
}
```

- [ ] **Step 2: Add module to lib.rs**

Add `pub mod milestone;` to `followbar/src-tauri/src/lib.rs`.

- [ ] **Step 3: Write unit test**

Add at the bottom of `followbar/src-tauri/src/milestone.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::path::PathBuf;

    #[test]
    fn test_milestone_detection() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None).unwrap();
        db.ensure_milestones_for_account("acc1", 80).unwrap();

        // Cross 100 milestone
        let reached = MilestoneChecker::check(&db, "acc1", 80, 120);
        assert_eq!(reached.len(), 1);
        assert_eq!(reached[0].1, 100);

        // Same check again should not re-trigger
        let reached = MilestoneChecker::check(&db, "acc1", 120, 130);
        assert_eq!(reached.len(), 0);
    }

    #[test]
    fn test_no_milestone_on_decrease() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None).unwrap();
        db.ensure_milestones_for_account("acc1", 150).unwrap();

        let reached = MilestoneChecker::check(&db, "acc1", 150, 100);
        assert_eq!(reached.len(), 0);
    }

    #[test]
    fn test_multiple_milestones_crossed() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None).unwrap();
        db.ensure_milestones_for_account("acc1", 80).unwrap();

        // Jump from 80 to 1200, crossing 100, 500, 1000
        let reached = MilestoneChecker::check(&db, "acc1", 80, 1200);
        assert_eq!(reached.len(), 3);
        let targets: Vec<u64> = reached.iter().map(|r| r.1).collect();
        assert!(targets.contains(&100));
        assert!(targets.contains(&500));
        assert!(targets.contains(&1000));
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test milestone::tests -- --nocapture
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/milestone.rs src-tauri/src/lib.rs
git commit -m "feat: add milestone detection logic with tests"
```

---

## Task 5: Scheduler

**Files:**
- Create: `followbar/src-tauri/src/scheduler.rs`
- Modify: `followbar/src-tauri/src/lib.rs`

- [ ] **Step 1: Write scheduler.rs**

Create `followbar/src-tauri/src/scheduler.rs`:
```rust
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{interval, Duration};

pub struct Scheduler {
    interval_minutes: AtomicU64,
    running: AtomicBool,
}

impl Scheduler {
    pub fn new(interval_minutes: u64) -> Self {
        Self {
            interval_minutes: AtomicU64::new(interval_minutes),
            running: AtomicBool::new(false),
        }
    }

    pub fn set_interval(&self, minutes: u64) {
        self.interval_minutes.store(minutes, Ordering::Relaxed);
    }

    pub fn get_interval(&self) -> u64 {
        self.interval_minutes.load(Ordering::Relaxed)
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Start the scheduler loop. Calls `on_tick` at each interval.
    /// Returns a handle that stops the scheduler when dropped.
    pub fn start<F>(self: &Arc<Self>, on_tick: F) -> tokio::task::JoinHandle<()>
    where
        F: Fn() + Send + Sync + 'static,
    {
        self.running.store(true, Ordering::Relaxed);
        let scheduler = Arc::clone(self);
        tokio::spawn(async move {
            // Run immediately on start
            on_tick();
            loop {
                let minutes = scheduler.interval_minutes.load(Ordering::Relaxed);
                tokio::time::sleep(Duration::from_secs(minutes * 60)).await;
                if !scheduler.running.load(Ordering::Relaxed) {
                    break;
                }
                on_tick();
            }
        })
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}
```

- [ ] **Step 2: Add module to lib.rs**

Add `pub mod scheduler;` to `followbar/src-tauri/src/lib.rs`.

- [ ] **Step 3: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/scheduler.rs src-tauri/src/lib.rs
git commit -m "feat: add configurable scheduler for timed fetching"
```

---

## Task 6: Tauri IPC Commands

**Files:**
- Create: `followbar/src-tauri/src/commands.rs`
- Modify: `followbar/src-tauri/src/lib.rs` (wire up commands + tray + app state)

- [ ] **Step 1: Write commands.rs**

Create `followbar/src-tauri/src/commands.rs`:
```rust
use crate::db::{Account, Database, Snapshot};
use crate::providers::ProviderManager;
use chrono::Utc;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;
use uuid::Uuid;

pub struct AppState {
    pub db: Mutex<Database>,
    pub providers: ProviderManager,
    pub scheduler: Arc<crate::scheduler::Scheduler>,
}

#[derive(Serialize)]
pub struct AccountWithStats {
    pub id: String,
    pub provider: String,
    pub username: String,
    pub followers: Option<u64>,
    pub today_change: Option<i64>,
    pub last_fetched: Option<String>,
}

#[tauri::command]
pub fn list_accounts(state: State<AppState>) -> Result<Vec<AccountWithStats>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let accounts = db.list_accounts().map_err(|e| e.to_string())?;

    let mut result = vec![];
    for acc in accounts {
        let latest = db.get_latest_snapshot(&acc.id).map_err(|e| e.to_string())?;
        let today_first = db.get_today_first_snapshot(&acc.id).map_err(|e| e.to_string())?;

        let (followers, today_change, last_fetched) = match &latest {
            Some(snap) => {
                let change = today_first.map(|tf| snap.followers as i64 - tf.followers as i64);
                (
                    Some(snap.followers),
                    change,
                    Some(snap.fetched_at.to_string()),
                )
            }
            None => (None, None, None),
        };

        result.push(AccountWithStats {
            id: acc.id,
            provider: acc.provider,
            username: acc.username,
            followers,
            today_change,
            last_fetched,
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn add_account(
    state: State<AppState>,
    provider: String,
    username: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    // Verify provider exists
    if state.providers.get(&provider).is_none() {
        return Err(format!("Unknown provider: {}", provider));
    }
    let id = Uuid::new_v4().to_string();
    db.add_account(&id, &provider, &username, None)
        .map_err(|e| e.to_string())?;
    // Initialize milestones with 0 followers (all milestones pending)
    db.ensure_milestones_for_account(&id, 0)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn remove_account(state: State<AppState>, account_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.remove_account(&account_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_snapshots_7d(state: State<AppState>, account_id: String) -> Result<Vec<Snapshot>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let since = (Utc::now() - chrono::Duration::days(7)).naive_utc();
    db.get_snapshots_since(&account_id, since)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_available_providers(state: State<AppState>) -> Vec<ProviderInfo> {
    state
        .providers
        .list()
        .iter()
        .map(|p| ProviderInfo {
            id: p.id().to_string(),
            name: p.name().to_string(),
            icon: p.icon().to_string(),
            needs_api_key: p.needs_api_key(),
        })
        .collect()
}

#[derive(Serialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub needs_api_key: bool,
}
```

- [ ] **Step 2: Wire up lib.rs with tray, state, and commands**

Rewrite `followbar/src-tauri/src/lib.rs`:
```rust
pub mod commands;
pub mod db;
pub mod milestone;
pub mod providers;
pub mod scheduler;

use commands::AppState;
use db::Database;
use providers::ProviderManager;
use scheduler::Scheduler;
use std::sync::{Arc, Mutex};
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Database
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("followbar.db");
            let db = Database::open(&db_path).expect("Failed to open database");

            // Cleanup old snapshots on launch
            let _ = db.cleanup_old_snapshots();

            // Scheduler (default 15 minutes, started in Task 12)
            let scheduler = Arc::new(Scheduler::new(15));

            // App state
            let state = AppState {
                db: Mutex::new(db),
                providers: ProviderManager::new(),
                scheduler: scheduler.clone(),
            };
            app.manage(state);

            // Tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("FollowBar")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_accounts,
            commands::add_account,
            commands::remove_account,
            commands::get_snapshots_7d,
            commands::get_available_providers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo check
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: add Tauri IPC commands and tray icon setup"
```

---

## Task 7: Frontend TypeScript Types and IPC Wrappers

**Files:**
- Create: `followbar/src/types.ts`
- Create: `followbar/src/lib/commands.ts`

- [ ] **Step 1: Write shared types**

Create `followbar/src/types.ts`:
```typescript
export interface AccountWithStats {
  id: string;
  provider: string;
  username: string;
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
}
```

- [ ] **Step 2: Write IPC command wrappers**

Create `followbar/src/lib/commands.ts`:
```typescript
import { invoke } from "@tauri-apps/api/core";
import type { AccountWithStats, Snapshot, ProviderInfo } from "../types";

export async function listAccounts(): Promise<AccountWithStats[]> {
  return invoke("list_accounts");
}

export async function addAccount(
  provider: string,
  username: string
): Promise<string> {
  return invoke("add_account", { provider, username });
}

export async function removeAccount(accountId: string): Promise<void> {
  return invoke("remove_account", { accountId });
}

export async function getSnapshots7d(accountId: string): Promise<Snapshot[]> {
  return invoke("get_snapshots_7d", { accountId });
}

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  return invoke("get_available_providers");
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src/types.ts src/lib/commands.ts
git commit -m "feat: add TypeScript types and Tauri IPC wrappers"
```

---

## Task 8: Frontend — AccountRow and AccountList Components

**Files:**
- Create: `followbar/src/components/AccountRow.tsx`
- Create: `followbar/src/components/AccountList.tsx`
- Create: `followbar/src/hooks/useAccounts.ts`

- [ ] **Step 1: Write useAccounts hook**

Create `followbar/src/hooks/useAccounts.ts`:
```typescript
import { useState, useEffect, useCallback } from "react";
import { listAccounts } from "../lib/commands";
import type { AccountWithStats } from "../types";

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAccounts();
      setAccounts(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, loading, error, refresh };
}
```

- [ ] **Step 2: Write AccountRow component**

Create `followbar/src/components/AccountRow.tsx`:
```tsx
import { useState } from "react";
import type { AccountWithStats } from "../types";
import { MiniChart } from "./MiniChart";

const PROVIDER_ICONS: Record<string, string> = {
  bilibili: "📺",
  x: "𝕏",
  youtube: "▶️",
};

interface Props {
  account: AccountWithStats;
}

export function AccountRow({ account }: Props) {
  const [expanded, setExpanded] = useState(false);
  const icon = PROVIDER_ICONS[account.provider] ?? "🌐";

  const changeText =
    account.today_change !== null
      ? account.today_change >= 0
        ? `↑${account.today_change}`
        : `↓${Math.abs(account.today_change)}`
      : "";

  const changeColor =
    account.today_change !== null
      ? account.today_change >= 0
        ? "text-green-400"
        : "text-red-400"
      : "";

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="text-sm text-gray-300">{account.username}</span>
        </div>
        <div className="text-right">
          <span className="text-white font-medium">
            {account.followers !== null
              ? account.followers.toLocaleString()
              : "—"}
          </span>
          {changeText && (
            <span className={`text-xs ml-2 ${changeColor}`}>{changeText}</span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <MiniChart accountId={account.id} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write AccountList component**

Create `followbar/src/components/AccountList.tsx`:
```tsx
import { useAccounts } from "../hooks/useAccounts";
import { AccountRow } from "./AccountRow";

interface Props {
  onOpenSettings: () => void;
}

export function AccountList({ onOpenSettings }: Props) {
  const { accounts, loading, refresh } = useAccounts();

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <span className="font-semibold text-sm">FollowBar</span>
        <button
          onClick={onOpenSettings}
          className="text-gray-400 hover:text-white text-sm cursor-pointer"
        >
          ⚙️
        </button>
      </div>

      {/* Account list */}
      <div className="flex-1 overflow-y-auto">
        {loading && accounts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Loading...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No accounts yet. Click ⚙️ to add one.
          </div>
        ) : (
          accounts.map((acc) => <AccountRow key={acc.id} account={acc} />)
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
        <span>
          {accounts.length > 0 && accounts[0].last_fetched
            ? `Updated: ${new Date(accounts[0].last_fetched).toLocaleTimeString()}`
            : ""}
        </span>
        <button
          onClick={refresh}
          className="hover:text-white cursor-pointer"
        >
          🔄
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src/components/AccountRow.tsx src/components/AccountList.tsx src/hooks/useAccounts.ts
git commit -m "feat: add AccountList and AccountRow frontend components"
```

---

## Task 9: Frontend — MiniChart Component

**Files:**
- Create: `followbar/src/components/MiniChart.tsx`

- [ ] **Step 1: Write MiniChart with recharts**

Create `followbar/src/components/MiniChart.tsx`:
```tsx
import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { getSnapshots7d } from "../lib/commands";
import type { Snapshot } from "../types";

interface Props {
  accountId: string;
}

export function MiniChart({ accountId }: Props) {
  const [data, setData] = useState<{ time: string; followers: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSnapshots7d(accountId)
      .then((snapshots: Snapshot[]) => {
        setData(
          snapshots.map((s) => ({
            time: new Date(s.fetched_at).toLocaleDateString(),
            followers: s.followers,
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [accountId]);

  if (loading) return <div className="text-xs text-gray-500">Loading chart...</div>;
  if (data.length < 2) return <div className="text-xs text-gray-500">Not enough data</div>;

  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis domain={["dataMin", "dataMax"]} hide />
        <Tooltip
          contentStyle={{
            background: "#1f2937",
            border: "none",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="followers"
          stroke="#6366f1"
          fill="url(#grad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src/components/MiniChart.tsx
git commit -m "feat: add MiniChart sparkline component with recharts"
```

---

## Task 10: Frontend — Settings and AddAccount Components

**Files:**
- Create: `followbar/src/components/Settings.tsx`
- Create: `followbar/src/components/AddAccount.tsx`

- [ ] **Step 1: Write AddAccount component**

Create `followbar/src/components/AddAccount.tsx`:
```tsx
import { useState, useEffect } from "react";
import { addAccount, getAvailableProviders } from "../lib/commands";
import type { ProviderInfo } from "../types";

interface Props {
  onAdded: () => void;
  onCancel: () => void;
}

export function AddAccount({ onAdded, onCancel }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAvailableProviders().then((p) => {
      setProviders(p);
      if (p.length > 0) setSelectedProvider(p[0].id);
    });
  }, []);

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addAccount(selectedProvider, username.trim());
      onAdded();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-semibold">Add Account</h3>

      <select
        value={selectedProvider}
        onChange={(e) => setSelectedProvider(e.target.value)}
        className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Username or ID"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 placeholder-gray-500"
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !username.trim()}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded px-3 py-2 cursor-pointer"
        >
          {saving ? "Adding..." : "Add"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded px-3 py-2 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write Settings component**

Create `followbar/src/components/Settings.tsx`:
```tsx
import { useState } from "react";
import { useAccounts } from "../hooks/useAccounts";
import { removeAccount } from "../lib/commands";
import { AddAccount } from "./AddAccount";

interface Props {
  onBack: () => void;
}

export function Settings({ onBack }: Props) {
  const { accounts, refresh } = useAccounts();
  const [showAdd, setShowAdd] = useState(false);

  const handleRemove = async (id: string) => {
    await removeAccount(id);
    refresh();
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">
          ← Back
        </button>
        <span className="font-semibold text-sm">Settings</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Accounts section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase text-gray-500 font-semibold">Accounts</h3>
            <button
              onClick={() => setShowAdd(true)}
              className="text-indigo-400 hover:text-indigo-300 text-sm cursor-pointer"
            >
              + Add
            </button>
          </div>

          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between py-2 border-b border-gray-800"
            >
              <div className="text-sm">
                <span className="text-gray-400 mr-2">{acc.provider}</span>
                <span>{acc.username}</span>
              </div>
              <button
                onClick={() => handleRemove(acc.id)}
                className="text-red-400 hover:text-red-300 text-xs cursor-pointer"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Add account form */}
        {showAdd && (
          <AddAccount
            onAdded={() => {
              setShowAdd(false);
              refresh();
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src/components/Settings.tsx src/components/AddAccount.tsx
git commit -m "feat: add Settings and AddAccount components"
```

---

## Task 11: Frontend — App Shell and View Routing

**Files:**
- Modify: `followbar/src/App.tsx`
- Modify: `followbar/src/main.tsx`
- Modify: `followbar/index.html`

- [ ] **Step 1: Write App.tsx with view routing**

Replace `followbar/src/App.tsx`:
```tsx
import { useState } from "react";
import { AccountList } from "./components/AccountList";
import { Settings } from "./components/Settings";

type View = "list" | "settings";

export default function App() {
  const [view, setView] = useState<View>("list");

  return (
    <div className="h-screen w-screen overflow-hidden">
      {view === "list" ? (
        <AccountList onOpenSettings={() => setView("settings")} />
      ) : (
        <Settings onBack={() => setView("list")} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update main.tsx**

Replace `followbar/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Update index.html**

Ensure `followbar/index.html` has no scrollbar and dark background:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FollowBar</title>
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; background: #111827; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run dev mode and verify UI**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm tauri dev
```

Expected: Tray icon appears in menubar. Clicking shows/hides the popup panel with dark UI. Settings view is accessible.

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src/App.tsx src/main.tsx index.html src/index.css
git commit -m "feat: add App shell with view routing and dark theme"
```

---

## Task 12: Backend — Fetch Trigger via IPC + Scheduler Integration

**Files:**
- Modify: `followbar/src-tauri/src/commands.rs` (add refresh_all command)
- Modify: `followbar/src-tauri/src/lib.rs` (start scheduler)

- [ ] **Step 1: Add refresh_all command to commands.rs**

Add to `followbar/src-tauri/src/commands.rs` (also add `use tauri_plugin_notification::NotificationExt;` at the top of the file):
```rust
use tauri_plugin_notification::NotificationExt;

/// Core refresh logic, called by both the IPC command and the scheduler.
pub async fn do_refresh_all(state: &AppState, app: &tauri::AppHandle) -> Result<(), String> {
    let accounts = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.list_accounts().map_err(|e| e.to_string())?
    };

    for account in accounts {
        if let Some(provider) = state.providers.get(&account.provider) {
            // TODO: retrieve api_key from Keychain if provider needs one
            let api_key: Option<String> = None;
            match provider.fetch(&account.username, api_key.as_deref()).await {
                Ok(data) => {
                    let db = state.db.lock().map_err(|e| e.to_string())?;

                    let prev_followers = db
                        .get_latest_snapshot(&account.id)
                        .map_err(|e| e.to_string())?
                        .map(|s| s.followers)
                        .unwrap_or(0);

                    db.insert_snapshot(&account.id, data.followers, None)
                        .map_err(|e| e.to_string())?;

                    // Check milestones
                    db.ensure_milestones_for_account(&account.id, data.followers)
                        .map_err(|e| e.to_string())?;

                    let reached = crate::milestone::MilestoneChecker::check(
                        &db,
                        &account.id,
                        prev_followers,
                        data.followers,
                    );

                    // Send notifications for reached milestones
                    for (_mid, target) in reached {
                        let _ = app.notification()
                            .builder()
                            .title("FollowBar")
                            .body(format!(
                                "🎉 Your {} ({}) followers reached {}!",
                                provider.name(),
                                account.username,
                                target
                            ))
                            .show();
                    }
                }
                Err(e) => {
                    eprintln!("Failed to fetch {}/{}: {}", account.provider, account.username, e);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn refresh_all(state: State<'_, AppState>, app: tauri::AppHandle) -> Result<(), String> {
    do_refresh_all(&state, &app).await
}
```

- [ ] **Step 2: Register the command and start scheduler in lib.rs**

Add `commands::refresh_all` to the `invoke_handler` in `lib.rs`.

Also add scheduler startup in the `setup` closure, after `app.manage(state)`:
```rust
// Start scheduler — triggers refresh_all periodically
let app_handle = app.handle().clone();
scheduler.start(move || {
    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let state = handle.state::<AppState>();
        let _ = commands::do_refresh_all(&state, &handle).await;
    });
});
```

- [ ] **Step 3: Add frontend refresh_all wrapper**

Add to `followbar/src/lib/commands.ts`:
```typescript
export async function refreshAll(): Promise<void> {
  return invoke("refresh_all");
}
```

Update `AccountList.tsx` footer refresh button to call `refreshAll` then `refresh`:
```tsx
import { refreshAll } from "../lib/commands";

// In the footer button onClick:
onClick={async () => { await refreshAll(); refresh(); }}
```

- [ ] **Step 4: Test end-to-end**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm tauri dev
```

Expected: Add a Bilibili account (e.g., UID "1"), click refresh, see follower count appear.

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src/lib/commands.ts src/components/AccountList.tsx
git commit -m "feat: add refresh_all command with milestone notifications"
```

---

## Task 13: Build and Smoke Test

**Files:** None new — this is a verification task.

- [ ] **Step 1: Run all Rust tests**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 2: Build release binary**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm tauri build
```

Expected: Produces `.dmg` in `src-tauri/target/release/bundle/dmg/`.

- [ ] **Step 3: Run the app and verify**

1. Open the built `.app` from `src-tauri/target/release/bundle/macos/`
2. Verify tray icon appears
3. Click tray icon → panel opens
4. Go to Settings → Add Bilibili account (UID: any valid UID)
5. Click refresh → follower count shows
6. Click the account row → chart area expands (may show "Not enough data" initially)

- [ ] **Step 4: Final commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add -A
git commit -m "chore: finalize first working version of FollowBar"
```

---

## Task 14: YouTube Provider

**Files:**
- Create: `followbar/src-tauri/src/providers/youtube.rs`
- Modify: `followbar/src-tauri/src/providers/mod.rs` (add `pub mod youtube;` and register provider)

- [ ] **Step 1: Write YouTube provider**

Create `followbar/src-tauri/src/providers/youtube.rs`:
```rust
use super::{FollowerData, Provider};
use chrono::Utc;
use serde::Deserialize;

pub struct YoutubeProvider;

#[derive(Deserialize)]
struct YtResponse {
    items: Vec<YtItem>,
}

#[derive(Deserialize)]
struct YtItem {
    statistics: YtStatistics,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct YtStatistics {
    subscriber_count: String,
}

#[async_trait::async_trait]
impl Provider for YoutubeProvider {
    fn id(&self) -> &str { "youtube" }
    fn name(&self) -> &str { "YouTube" }
    fn icon(&self) -> &str { "youtube" }
    fn needs_api_key(&self) -> bool { true }

    async fn fetch(&self, channel_id: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let key = api_key.ok_or_else(|| anyhow::anyhow!("YouTube API key required"))?;
        let url = format!(
            "https://www.googleapis.com/youtube/v3/channels?part=statistics&id={}&key={}",
            channel_id, key
        );
        let resp: YtResponse = reqwest::get(&url).await?.json().await?;
        let item = resp.items.first().ok_or_else(|| anyhow::anyhow!("Channel not found"))?;
        let followers: u64 = item.statistics.subscriber_count.parse()?;

        Ok(FollowerData {
            followers,
            fetched_at: Utc::now(),
            extra: None,
        })
    }

    async fn validate_username(&self, channel_id: &str) -> anyhow::Result<bool> {
        Ok(!channel_id.is_empty())
    }
}
```

- [ ] **Step 2: Register in mod.rs**

Add to `followbar/src-tauri/src/providers/mod.rs`:
```rust
pub mod youtube;
```

And in `ProviderManager::new()`, add:
```rust
manager.register(Box::new(youtube::YoutubeProvider));
```

- [ ] **Step 3: Write integration test**

Create `followbar/src-tauri/tests/youtube_test.rs`:
```rust
use followbar_lib::providers::youtube::YoutubeProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_youtube_needs_api_key() {
    let provider = YoutubeProvider;
    assert!(provider.needs_api_key());
    // Without key should fail
    let result = provider.fetch("UC_x5XG1OV2P6uZZ5FSM9Ttw", None).await;
    assert!(result.is_err());
}
```

- [ ] **Step 4: Run test and commit**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test youtube_test -- --nocapture
```

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/providers/youtube.rs src-tauri/src/providers/mod.rs src-tauri/tests/youtube_test.rs
git commit -m "feat: add YouTube provider"
```

---

## Task 15: X (Twitter) Provider

**Files:**
- Create: `followbar/src-tauri/src/providers/x.rs`
- Modify: `followbar/src-tauri/src/providers/mod.rs` (add `pub mod x;` and register)

- [ ] **Step 1: Write X provider**

Create `followbar/src-tauri/src/providers/x.rs`:
```rust
use super::{FollowerData, Provider};
use chrono::Utc;
use serde::Deserialize;

pub struct XProvider;

#[derive(Deserialize)]
struct XResponse {
    data: Option<XData>,
}

#[derive(Deserialize)]
struct XData {
    public_metrics: XMetrics,
}

#[derive(Deserialize)]
struct XMetrics {
    followers_count: u64,
}

#[async_trait::async_trait]
impl Provider for XProvider {
    fn id(&self) -> &str { "x" }
    fn name(&self) -> &str { "X (Twitter)" }
    fn icon(&self) -> &str { "x" }
    fn needs_api_key(&self) -> bool { true }

    async fn fetch(&self, username: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let bearer = api_key.ok_or_else(|| anyhow::anyhow!("X API Bearer Token required"))?;
        let url = format!(
            "https://api.x.com/2/users/by/username/{}?user.fields=public_metrics",
            username
        );
        let client = reqwest::Client::new();
        let resp: XResponse = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", bearer))
            .send()
            .await?
            .json()
            .await?;

        let data = resp.data.ok_or_else(|| anyhow::anyhow!("User not found"))?;

        Ok(FollowerData {
            followers: data.public_metrics.followers_count,
            fetched_at: Utc::now(),
            extra: None,
        })
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        // Basic check: alphanumeric + underscores, 1-15 chars
        Ok(!username.is_empty()
            && username.len() <= 15
            && username.chars().all(|c| c.is_alphanumeric() || c == '_'))
    }
}
```

- [ ] **Step 2: Register in mod.rs**

Add to `followbar/src-tauri/src/providers/mod.rs`:
```rust
pub mod x;
```

And in `ProviderManager::new()`, add:
```rust
manager.register(Box::new(x::XProvider));
```

- [ ] **Step 3: Write test and commit**

```rust
// followbar/src-tauri/tests/x_test.rs
use followbar_lib::providers::x::XProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_x_needs_api_key() {
    let provider = XProvider;
    assert!(provider.needs_api_key());
    let result = provider.fetch("elonmusk", None).await;
    assert!(result.is_err());
}
```

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test x_test -- --nocapture
```

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/providers/x.rs src-tauri/src/providers/mod.rs src-tauri/tests/x_test.rs
git commit -m "feat: add X (Twitter) provider"
```

---

## Task 16: macOS Keychain Integration

**Files:**
- Create: `followbar/src-tauri/src/keychain.rs`
- Modify: `followbar/src-tauri/src/commands.rs` (add set/get API key commands)
- Modify: `followbar/src-tauri/src/lib.rs`

- [ ] **Step 1: Write keychain.rs**

Create `followbar/src-tauri/src/keychain.rs`:
```rust
use std::process::Command;

const SERVICE_NAME: &str = "com.followbar.api-keys";

/// Store an API key in macOS Keychain
pub fn set_api_key(provider: &str, key: &str) -> anyhow::Result<()> {
    // Delete existing entry first (ignore errors if it doesn't exist)
    let _ = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", provider])
        .output();

    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-s", SERVICE_NAME,
            "-a", provider,
            "-w", key,
        ])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("Failed to store key in Keychain: {}", String::from_utf8_lossy(&output.stderr));
    }
    Ok(())
}

/// Retrieve an API key from macOS Keychain
pub fn get_api_key(provider: &str) -> anyhow::Result<Option<String>> {
    let output = Command::new("security")
        .args(["find-generic-password", "-s", SERVICE_NAME, "-a", provider, "-w"])
        .output()?;

    if output.status.success() {
        Ok(Some(String::from_utf8(output.stdout)?.trim().to_string()))
    } else {
        Ok(None)
    }
}

/// Delete an API key from macOS Keychain
pub fn delete_api_key(provider: &str) -> anyhow::Result<()> {
    let _ = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", provider])
        .output();
    Ok(())
}
```

- [ ] **Step 2: Add IPC commands for API key management**

Add to `followbar/src-tauri/src/commands.rs`:
```rust
use crate::keychain;

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    keychain::set_api_key(&provider, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key_exists(provider: String) -> Result<bool, String> {
    keychain::get_api_key(&provider)
        .map(|k| k.is_some())
        .map_err(|e| e.to_string())
}
```

Register both in `invoke_handler`.

- [ ] **Step 3: Update `do_refresh_all` to use Keychain**

Replace the `let api_key: Option<String> = None;` line:
```rust
let api_key = if provider.needs_api_key() {
    crate::keychain::get_api_key(&account.provider).unwrap_or(None)
} else {
    None
};
```

- [ ] **Step 4: Add TypeScript wrappers**

Add to `followbar/src/lib/commands.ts`:
```typescript
export async function setApiKey(provider: string, key: string): Promise<void> {
  return invoke("set_api_key", { provider, key });
}

export async function getApiKeyExists(provider: string): Promise<boolean> {
  return invoke("get_api_key_exists", { provider });
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/keychain.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/lib/commands.ts
git commit -m "feat: add macOS Keychain integration for API key storage"
```

---

## Task 17: Settings — Refresh Interval, Milestone Toggle, API Keys UI

**Files:**
- Modify: `followbar/src/components/Settings.tsx`
- Modify: `followbar/src-tauri/src/commands.rs` (add get/set interval commands)

- [ ] **Step 1: Add interval IPC commands**

Add to `followbar/src-tauri/src/commands.rs`:
```rust
#[tauri::command]
pub fn get_refresh_interval(state: State<AppState>) -> u64 {
    state.scheduler.get_interval()
}

#[tauri::command]
pub fn set_refresh_interval(state: State<AppState>, minutes: u64) -> Result<(), String> {
    if minutes < 1 {
        return Err("Interval must be at least 1 minute".to_string());
    }
    state.scheduler.set_interval(minutes);
    Ok(())
}
```

Register both in `invoke_handler`.

- [ ] **Step 2: Add TypeScript wrappers**

Add to `followbar/src/lib/commands.ts`:
```typescript
export async function getRefreshInterval(): Promise<number> {
  return invoke("get_refresh_interval");
}

export async function setRefreshInterval(minutes: number): Promise<void> {
  return invoke("set_refresh_interval", { minutes });
}
```

- [ ] **Step 3: Update Settings.tsx with interval, API key, and milestone sections**

Replace `followbar/src/components/Settings.tsx`:
```tsx
import { useState, useEffect } from "react";
import { useAccounts } from "../hooks/useAccounts";
import {
  removeAccount,
  getRefreshInterval,
  setRefreshInterval,
  setApiKey,
  getApiKeyExists,
  getAvailableProviders,
} from "../lib/commands";
import { AddAccount } from "./AddAccount";
import type { ProviderInfo } from "../types";

interface Props {
  onBack: () => void;
}

export function Settings({ onBack }: Props) {
  const { accounts, refresh } = useAccounts();
  const [showAdd, setShowAdd] = useState(false);
  const [interval, setInterval] = useState(15);
  const [milestoneEnabled, setMilestoneEnabled] = useState(() =>
    localStorage.getItem("milestone_enabled") !== "false"
  );
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    getRefreshInterval().then(setInterval);
    getAvailableProviders().then(async (provs) => {
      setProviders(provs);
      const status: Record<string, boolean> = {};
      for (const p of provs) {
        if (p.needs_api_key) {
          status[p.id] = await getApiKeyExists(p.id);
        }
      }
      setApiKeyStatus(status);
    });
  }, []);

  const handleRemove = async (id: string) => {
    await removeAccount(id);
    refresh();
  };

  const handleIntervalChange = async (mins: number) => {
    setInterval(mins);
    await setRefreshInterval(mins);
  };

  const handleMilestoneToggle = () => {
    const next = !milestoneEnabled;
    setMilestoneEnabled(next);
    localStorage.setItem("milestone_enabled", String(next));
  };

  const handleSaveApiKey = async (providerId: string) => {
    const key = apiKeyInputs[providerId];
    if (!key?.trim()) return;
    await setApiKey(providerId, key.trim());
    setApiKeyStatus((s) => ({ ...s, [providerId]: true }));
    setApiKeyInputs((s) => ({ ...s, [providerId]: "" }));
  };

  const apiKeyProviders = providers.filter((p) => p.needs_api_key);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm cursor-pointer">← Back</button>
        <span className="font-semibold text-sm">Settings</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Accounts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs uppercase text-gray-500 font-semibold">Accounts</h3>
            <button onClick={() => setShowAdd(true)} className="text-indigo-400 hover:text-indigo-300 text-sm cursor-pointer">+ Add</button>
          </div>
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between py-2 border-b border-gray-800">
              <div className="text-sm"><span className="text-gray-400 mr-2">{acc.provider}</span><span>{acc.username}</span></div>
              <button onClick={() => handleRemove(acc.id)} className="text-red-400 hover:text-red-300 text-xs cursor-pointer">Remove</button>
            </div>
          ))}
          {showAdd && <AddAccount onAdded={() => { setShowAdd(false); refresh(); }} onCancel={() => setShowAdd(false)} />}
        </div>

        {/* Refresh Interval */}
        <div>
          <h3 className="text-xs uppercase text-gray-500 font-semibold mb-2">Refresh Interval</h3>
          <select
            value={interval}
            onChange={(e) => handleIntervalChange(Number(e.target.value))}
            className="w-full bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600"
          >
            {[5, 15, 30, 60].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </div>

        {/* API Keys */}
        {apiKeyProviders.length > 0 && (
          <div>
            <h3 className="text-xs uppercase text-gray-500 font-semibold mb-2">API Keys</h3>
            {apiKeyProviders.map((p) => (
              <div key={p.id} className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm">{p.name}</span>
                  {apiKeyStatus[p.id] && <span className="text-green-400 text-xs">Configured</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={apiKeyStatus[p.id] ? "••••••••" : "Enter API key"}
                    value={apiKeyInputs[p.id] || ""}
                    onChange={(e) => setApiKeyInputs((s) => ({ ...s, [p.id]: e.target.value }))}
                    className="flex-1 bg-gray-800 text-white text-sm rounded px-3 py-2 border border-gray-600 placeholder-gray-500"
                  />
                  <button
                    onClick={() => handleSaveApiKey(p.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded px-3 py-2 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Milestone Notifications */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase text-gray-500 font-semibold">Milestone Notifications</h3>
            <button
              onClick={handleMilestoneToggle}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${milestoneEnabled ? "bg-indigo-600" : "bg-gray-600"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${milestoneEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Get notified when reaching follower milestones (100, 500, 1K, etc.)</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/commands.rs src/components/Settings.tsx src/lib/commands.ts
git commit -m "feat: add refresh interval, API key config, and milestone toggle to Settings"
```

---

## Task 18: Final Integration and Smoke Test

**Files:** None new — verification task.

- [ ] **Step 1: Run all Rust tests**

```bash
cd /Users/innomad/lab/sandbox/followbar/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 2: Build release**

```bash
cd /Users/innomad/lab/sandbox/followbar
pnpm tauri build
```

- [ ] **Step 3: Full smoke test**

1. Open `.app`, verify no Dock icon (LSUIElement), tray icon visible
2. Add Bilibili account → click refresh → follower count shows
3. Go to Settings → set YouTube API key → add YouTube channel → refresh → count shows
4. Adjust refresh interval → verify next auto-refresh happens at new interval
5. Click account row → 7-day chart expands
6. Verify milestone notification by adding an account that already exceeds a target

- [ ] **Step 4: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add -A
git commit -m "chore: final integration and verification"
```

---

## Task 19: Second-Batch Provider Stubs + UI Indication

**Files:**
- Create: `followbar/src-tauri/src/providers/xiaohongshu.rs` (stub)
- Create: `followbar/src-tauri/src/providers/wechat.rs` (stub)
- Create: `followbar/src-tauri/src/providers/douyin.rs` (stub)
- Modify: `followbar/src-tauri/src/providers/mod.rs`
- Modify: `followbar/src/components/AddAccount.tsx`

Per spec: second-batch providers (小红书, 微信公众号, 抖音) require web scraping research. This task creates placeholder providers that return "not yet supported" errors, and marks them in the UI.

- [ ] **Step 1: Add `coming_soon` flag to Provider trait**

Add to `followbar/src-tauri/src/providers/mod.rs` Provider trait:
```rust
fn coming_soon(&self) -> bool { false }  // default implementation
```

Add `coming_soon` to `ProviderInfo` struct in commands.rs:
```rust
pub coming_soon: bool,
```

And in `get_available_providers`, map it:
```rust
coming_soon: p.coming_soon(),
```

- [ ] **Step 2: Create stub providers**

Each stub follows this pattern (example for xiaohongshu):
```rust
// followbar/src-tauri/src/providers/xiaohongshu.rs
use super::{FollowerData, Provider};

pub struct XiaohongshuProvider;

#[async_trait::async_trait]
impl Provider for XiaohongshuProvider {
    fn id(&self) -> &str { "xiaohongshu" }
    fn name(&self) -> &str { "小红书" }
    fn icon(&self) -> &str { "xiaohongshu" }
    fn needs_api_key(&self) -> bool { false }
    fn coming_soon(&self) -> bool { true }

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        anyhow::bail!("小红书 provider is not yet supported")
    }

    async fn validate_username(&self, _username: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}
```

Create similar stubs for `wechat.rs` (name: "微信公众号") and `douyin.rs` (name: "抖音").

- [ ] **Step 3: Register in mod.rs**

```rust
pub mod xiaohongshu;
pub mod wechat;
pub mod douyin;
```

Register all three in `ProviderManager::new()`.

- [ ] **Step 4: Update AddAccount UI**

In `AddAccount.tsx`, add `coming_soon` to `ProviderInfo` type, and disable those providers:
```tsx
<option key={p.id} value={p.id} disabled={p.coming_soon}>
  {p.name}{p.coming_soon ? " (Coming Soon)" : ""}
</option>
```

- [ ] **Step 5: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/src/providers/ src/components/AddAccount.tsx src-tauri/src/commands.rs src/types.ts
git commit -m "feat: add second-batch provider stubs with coming-soon UI indication"
```

---

## Task 20: Launch at Login + Milestone Toggle Backend

**Files:**
- Modify: `followbar/src-tauri/Cargo.toml` (add tauri-plugin-autostart)
- Modify: `followbar/src-tauri/src/lib.rs`
- Modify: `followbar/src-tauri/src/commands.rs`
- Modify: `followbar/src/components/Settings.tsx`
- Modify: `followbar/src/lib/commands.ts`
- Modify: `followbar/src-tauri/capabilities/default.json`

- [ ] **Step 1: Add autostart plugin**

Add to `followbar/src-tauri/Cargo.toml`:
```toml
tauri-plugin-autostart = "2"
```

Add to capabilities `default.json`:
```json
"autostart:default"
```

Register in `lib.rs` setup:
```rust
.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    None,
))
```

- [ ] **Step 2: Add autostart IPC commands**

Add to `followbar/src-tauri/src/commands.rs`:
```rust
use tauri_plugin_autostart::AutoLaunchManager;

#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}
```

Register in `invoke_handler`.

- [ ] **Step 3: Move milestone toggle to backend**

Add to `AppState`:
```rust
pub milestone_enabled: std::sync::atomic::AtomicBool,
```

Initialize as `AtomicBool::new(true)` in `lib.rs`.

Add IPC commands:
```rust
#[tauri::command]
pub fn get_milestone_enabled(state: State<AppState>) -> bool {
    state.milestone_enabled.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
pub fn set_milestone_enabled(state: State<AppState>, enabled: bool) {
    state.milestone_enabled.store(enabled, std::sync::atomic::Ordering::Relaxed);
}
```

Update `do_refresh_all` — wrap the milestone notification block:
```rust
if state.milestone_enabled.load(std::sync::atomic::Ordering::Relaxed) {
    let reached = crate::milestone::MilestoneChecker::check(
        &db, &account.id, prev_followers, data.followers,
    );
    for (_mid, target) in reached {
        let _ = app.notification()
            .builder()
            .title("FollowBar")
            .body(format!("🎉 Your {} ({}) followers reached {}!",
                provider.name(), account.username, target))
            .show();
    }
}
```

Register all new commands in `invoke_handler`.

- [ ] **Step 4: Add TypeScript wrappers**

Add to `followbar/src/lib/commands.ts`:
```typescript
export async function getAutostart(): Promise<boolean> {
  return invoke("get_autostart");
}
export async function setAutostart(enabled: boolean): Promise<void> {
  return invoke("set_autostart", { enabled });
}
export async function getMilestoneEnabled(): Promise<boolean> {
  return invoke("get_milestone_enabled");
}
export async function setMilestoneEnabled(enabled: boolean): Promise<void> {
  return invoke("set_milestone_enabled", { enabled });
}
```

- [ ] **Step 5: Update Settings.tsx**

Replace the localStorage-based milestone toggle with IPC calls to `getMilestoneEnabled` / `setMilestoneEnabled`. Add an "Auto-start on Login" toggle section using `getAutostart` / `setAutostart`, following the same toggle UI pattern.

- [ ] **Step 6: Commit**

```bash
cd /Users/innomad/lab/sandbox/followbar
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/commands.rs src-tauri/capabilities/default.json src/lib/commands.ts src/components/Settings.tsx
git commit -m "feat: add launch-at-login and backend milestone toggle"
```
