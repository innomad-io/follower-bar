use chrono::{Duration, Local, NaiveDateTime, TimeZone, Utc};
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    pub id: String,
    pub provider: String,
    pub username: String,
    pub resolved_id: Option<String>,
    pub display_name: Option<String>,
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
        let conn = if path == Path::new(":memory:") {
            Connection::open_in_memory()?
        } else {
            Connection::open(path)?
        };

        conn.execute_batch("PRAGMA foreign_keys = ON;")?;

        let db = Self { conn };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                username TEXT NOT NULL,
                resolved_id TEXT,
                display_name TEXT,
                config TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                followers INTEGER NOT NULL,
                extra TEXT,
                fetched_at DATETIME NOT NULL
            );

            CREATE TABLE IF NOT EXISTS milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                target INTEGER NOT NULL,
                reached_at DATETIME,
                notified BOOLEAN NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_account
            ON snapshots(account_id, fetched_at);

            CREATE INDEX IF NOT EXISTS idx_milestones_account
            ON milestones(account_id, target);
            ",
        )?;

        let _ = self
            .conn
            .execute("ALTER TABLE accounts ADD COLUMN resolved_id TEXT", []);
        let _ = self
            .conn
            .execute("ALTER TABLE accounts ADD COLUMN display_name TEXT", []);

        Ok(())
    }

    pub fn add_account(
        &self,
        id: &str,
        provider: &str,
        username: &str,
        resolved_id: Option<&str>,
        display_name: Option<&str>,
        config: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "INSERT INTO accounts (id, provider, username, resolved_id, display_name, config)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, provider, username, resolved_id, display_name, config],
        )?;
        Ok(())
    }

    pub fn update_account_profile(
        &self,
        id: &str,
        username: &str,
        resolved_id: Option<&str>,
        display_name: Option<&str>,
    ) -> Result<()> {
        self.conn.execute(
            "UPDATE accounts
             SET username = ?2, resolved_id = ?3, display_name = ?4
             WHERE id = ?1",
            params![id, username, resolved_id, display_name],
        )?;
        Ok(())
    }

    pub fn update_account_config(&self, id: &str, config: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE accounts
             SET config = ?2
             WHERE id = ?1",
            params![id, config],
        )?;
        Ok(())
    }

    pub fn remove_account(&self, id: &str) -> Result<()> {
        self.conn
            .execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_accounts(&self) -> Result<Vec<Account>> {
        let mut statement = self.conn.prepare(
            "SELECT id, provider, username, resolved_id, display_name, config, created_at
             FROM accounts
             ORDER BY created_at ASC",
        )?;

        let rows = statement.query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                provider: row.get(1)?,
                username: row.get(2)?,
                resolved_id: row.get(3)?,
                display_name: row.get(4)?,
                config: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;

        rows.collect()
    }

    pub fn insert_snapshot(&self, account_id: &str, followers: u64, extra: Option<&str>) -> Result<()> {
        self.conn.execute(
            "INSERT INTO snapshots (account_id, followers, extra, fetched_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![account_id, followers, extra, Utc::now().naive_utc()],
        )?;
        Ok(())
    }

    pub fn get_latest_snapshot(&self, account_id: &str) -> Result<Option<Snapshot>> {
        self.conn
            .query_row(
                "SELECT id, account_id, followers, extra, fetched_at
                 FROM snapshots
                 WHERE account_id = ?1
                 ORDER BY fetched_at DESC, id DESC
                 LIMIT 1",
                params![account_id],
                |row| {
                    Ok(Snapshot {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        followers: row.get(2)?,
                        extra: row.get(3)?,
                        fetched_at: row.get(4)?,
                    })
                },
            )
            .optional()
    }

    pub fn get_snapshots_since(
        &self,
        account_id: &str,
        since: NaiveDateTime,
    ) -> Result<Vec<Snapshot>> {
        let mut statement = self.conn.prepare(
            "SELECT id, account_id, followers, extra, fetched_at
             FROM snapshots
             WHERE account_id = ?1 AND fetched_at >= ?2
             ORDER BY fetched_at ASC, id ASC",
        )?;

        let rows = statement.query_map(params![account_id, since], |row| {
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
        let today_local = Local::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .expect("valid midnight");
        let today_start = Local
            .from_local_datetime(&today_local)
            .single()
            .expect("local midnight should resolve")
            .with_timezone(&Utc)
            .naive_utc();

        self.conn
            .query_row(
                "SELECT id, account_id, followers, extra, fetched_at
                 FROM snapshots
                 WHERE account_id = ?1 AND fetched_at >= ?2
                 ORDER BY fetched_at ASC, id ASC
                 LIMIT 1",
                params![account_id, today_start],
                |row| {
                    Ok(Snapshot {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        followers: row.get(2)?,
                        extra: row.get(3)?,
                        fetched_at: row.get(4)?,
                    })
                },
            )
            .optional()
    }

    pub fn cleanup_old_snapshots(&self) -> Result<usize> {
        let cutoff = (Utc::now() - Duration::days(7)).naive_utc();

        self.conn.execute(
            "DELETE FROM snapshots
             WHERE fetched_at < ?1
             AND id NOT IN (
                SELECT preserved.id
                FROM snapshots AS preserved
                INNER JOIN (
                    SELECT account_id, DATE(fetched_at) AS day, MAX(fetched_at) AS latest_time
                    FROM snapshots
                    WHERE fetched_at < ?1
                    GROUP BY account_id, DATE(fetched_at)
                ) grouped
                ON grouped.account_id = preserved.account_id
                AND DATE(preserved.fetched_at) = grouped.day
                AND preserved.fetched_at = grouped.latest_time
             )",
            params![cutoff],
        )
    }

    pub fn get_unreached_milestones(&self, account_id: &str) -> Result<Vec<Milestone>> {
        let mut statement = self.conn.prepare(
            "SELECT id, account_id, target, reached_at, notified
             FROM milestones
             WHERE account_id = ?1 AND reached_at IS NULL
             ORDER BY target ASC",
        )?;

        let rows = statement.query_map(params![account_id], |row| {
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
            "UPDATE milestones
             SET reached_at = ?1, notified = 1
             WHERE id = ?2",
            params![Utc::now().naive_utc(), milestone_id],
        )?;
        Ok(())
    }

    pub fn ensure_milestones_for_account(&self, account_id: &str, current_followers: u64) -> Result<()> {
        for target in crate::milestone::MILESTONE_TARGETS {
            if *target <= current_followers {
                continue;
            }

            let exists: bool = self.conn.query_row(
                "SELECT COUNT(*) > 0
                 FROM milestones
                 WHERE account_id = ?1 AND target = ?2",
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

        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO app_settings (key, value)
             VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_refresh_interval(&self) -> Result<Option<u64>> {
        Ok(self
            .get_setting("refresh_interval_minutes")?
            .and_then(|value| value.parse::<u64>().ok()))
    }

    pub fn set_refresh_interval(&self, minutes: u64) -> Result<()> {
        self.set_setting("refresh_interval_minutes", &minutes.to_string())
    }

    pub fn get_milestone_enabled(&self) -> Result<Option<bool>> {
        Ok(self
            .get_setting("milestone_enabled")?
            .and_then(|value| match value.as_str() {
                "true" => Some(true),
                "false" => Some(false),
                _ => None,
            }))
    }

    pub fn set_milestone_enabled(&self, enabled: bool) -> Result<()> {
        self.set_setting("milestone_enabled", if enabled { "true" } else { "false" })
    }
}

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
        db.add_account("acc1", "bilibili", "test_user", None, Some("Test User"), None)
            .unwrap();

        let accounts = db.list_accounts().unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].provider, "bilibili");
        assert_eq!(accounts[0].username, "test_user");
        assert_eq!(accounts[0].display_name.as_deref(), Some("Test User"));
    }

    #[test]
    fn test_remove_account_cascades() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "test_user", None, None, None)
            .unwrap();
        db.insert_snapshot("acc1", 100, None).unwrap();
        db.ensure_milestones_for_account("acc1", 0).unwrap();

        db.remove_account("acc1").unwrap();

        assert!(db.list_accounts().unwrap().is_empty());
        assert!(db.get_latest_snapshot("acc1").unwrap().is_none());
        assert!(db.get_unreached_milestones("acc1").unwrap().is_empty());
    }

    #[test]
    fn test_snapshots() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "user", None, None, None)
            .unwrap();
        db.insert_snapshot("acc1", 100, None).unwrap();
        db.insert_snapshot("acc1", 105, None).unwrap();

        let latest = db.get_latest_snapshot("acc1").unwrap().unwrap();
        assert_eq!(latest.followers, 105);
    }

    #[test]
    fn test_milestones() {
        let db = test_db();
        db.add_account("acc1", "bilibili", "user", None, None, None)
            .unwrap();
        db.ensure_milestones_for_account("acc1", 50).unwrap();

        let unreached = db.get_unreached_milestones("acc1").unwrap();
        assert!(unreached.iter().any(|m| m.target == 100));
        assert!(unreached.iter().any(|m| m.target == 500));
        assert!(!unreached.iter().any(|m| m.target == 50));
    }

    #[test]
    fn test_app_settings_round_trip() {
        let db = test_db();
        db.set_refresh_interval(30).unwrap();
        db.set_milestone_enabled(false).unwrap();

        assert_eq!(db.get_refresh_interval().unwrap(), Some(30));
        assert_eq!(db.get_milestone_enabled().unwrap(), Some(false));
    }

    #[test]
    fn test_update_account_profile() {
        let db = test_db();
        db.add_account("acc1", "youtube", "@handle", None, None, None)
            .unwrap();

        db.update_account_profile("acc1", "@design", Some("UC123"), Some("Design Theory"))
            .unwrap();

        let account = db.list_accounts().unwrap().remove(0);
        assert_eq!(account.username, "@design");
        assert_eq!(account.resolved_id.as_deref(), Some("UC123"));
        assert_eq!(account.display_name.as_deref(), Some("Design Theory"));
    }

    #[test]
    fn test_update_account_config() {
        let db = test_db();
        db.add_account("acc1", "xiaohongshu", "60383492000000000100a467", None, None, None)
            .unwrap();

        db.update_account_config("acc1", Some("{\"state\":\"challenge_required\"}"))
            .unwrap();

        let account = db.list_accounts().unwrap().remove(0);
        assert_eq!(
            account.config.as_deref(),
            Some("{\"state\":\"challenge_required\"}")
        );

        db.update_account_config("acc1", None).unwrap();
        let account = db.list_accounts().unwrap().remove(0);
        assert_eq!(account.config, None);
    }
}
