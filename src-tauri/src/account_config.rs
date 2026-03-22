use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

pub const XIAOHONGSHU_CHALLENGE_COOLDOWN_MINUTES: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountConfig {
    #[serde(default)]
    pub provider_method: Option<String>,
    #[serde(default)]
    pub provider_state: Option<String>,
    #[serde(default)]
    pub provider_message: Option<String>,
    #[serde(default)]
    pub cooldown_until: Option<DateTime<Utc>>,
}

impl AccountConfig {
    pub fn from_json(raw: Option<&str>) -> Self {
        raw.and_then(|value| serde_json::from_str(value).ok())
            .unwrap_or_default()
    }

    pub fn to_json(&self) -> Option<String> {
        if self.provider_method.is_none()
            && self.provider_state.is_none()
            && self.provider_message.is_none()
            && self.cooldown_until.is_none()
        {
            None
        } else {
            serde_json::to_string(self).ok()
        }
    }

    pub fn clear_runtime_state(&mut self) {
        self.provider_state = None;
        self.provider_message = None;
        self.cooldown_until = None;
    }

    pub fn mark_xiaohongshu_challenge(&mut self, message: &str) {
        self.provider_state = Some("challenge_required".to_string());
        self.provider_message = Some(message.to_string());
        self.cooldown_until =
            Some(Utc::now() + Duration::minutes(XIAOHONGSHU_CHALLENGE_COOLDOWN_MINUTES));
    }

    pub fn should_skip_xiaohongshu_refresh(&self) -> bool {
        self.provider_state.as_deref() == Some("challenge_required")
            && self.cooldown_until.map(|deadline| deadline > Utc::now()).unwrap_or(false)
    }

    pub fn provider_method_for(&self, provider: &str) -> String {
        self.provider_method
            .clone()
            .unwrap_or_else(|| default_provider_method(provider).to_string())
    }
}

pub fn default_provider_method(provider: &str) -> &'static str {
    match provider {
        "x" | "youtube" | "bilibili" | "douyin" => "public_page",
        "xiaohongshu" | "wechat" => "browser_link",
        _ => "public_page",
    }
}

#[cfg(test)]
mod tests {
    use super::AccountConfig;
    use chrono::{Duration, Utc};

    #[test]
    fn challenge_config_serializes_and_skips_until_expired() {
        let mut config = AccountConfig::default();
        config.mark_xiaohongshu_challenge("blocked");
        let raw = config.to_json().expect("json");
        let parsed = AccountConfig::from_json(Some(&raw));

        assert_eq!(parsed.provider_state.as_deref(), Some("challenge_required"));
        assert!(parsed.should_skip_xiaohongshu_refresh());

        let expired = AccountConfig {
            provider_method: None,
            provider_state: Some("challenge_required".to_string()),
            provider_message: Some("blocked".to_string()),
            cooldown_until: Some(Utc::now() - Duration::minutes(1)),
        };
        assert!(!expired.should_skip_xiaohongshu_refresh());
    }

    #[test]
    fn provider_method_round_trips_through_json() {
        let config = AccountConfig {
            provider_state: None,
            provider_message: None,
            cooldown_until: None,
            provider_method: Some("official_api".to_string()),
        };

        let raw = config.to_json().expect("json");
        let parsed = AccountConfig::from_json(Some(&raw));

        assert_eq!(parsed.provider_method.as_deref(), Some("official_api"));
    }
}
