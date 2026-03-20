use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

pub const XIAOHONGSHU_CHALLENGE_COOLDOWN_MINUTES: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AccountConfig {
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
        if self.provider_state.is_none()
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
            provider_state: Some("challenge_required".to_string()),
            provider_message: Some("blocked".to_string()),
            cooldown_until: Some(Utc::now() - Duration::minutes(1)),
        };
        assert!(!expired.should_skip_xiaohongshu_refresh());
    }
}
