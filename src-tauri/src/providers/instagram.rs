use super::{FollowerData, Provider};
use anyhow::anyhow;

pub struct InstagramProvider;

fn normalize_instagram_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if let Some(username) = trimmed.strip_prefix('@') {
        return Some(username.to_string());
    }

    for prefix in [
        "https://www.instagram.com/",
        "http://www.instagram.com/",
        "https://instagram.com/",
        "http://instagram.com/",
    ] {
        if let Some(username) = trimmed.strip_prefix(prefix) {
            return username
                .split(['/', '?', '#'])
                .next()
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string());
        }
    }

    Some(trimmed.to_string())
}

#[async_trait::async_trait]
impl Provider for InstagramProvider {
    fn id(&self) -> &str {
        "instagram"
    }

    fn name(&self) -> &str {
        "Instagram"
    }

    fn icon(&self) -> &str {
        "instagram"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    async fn fetch(&self, input: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        Err(anyhow!(
            "Instagram sidecar fetch should be handled by the command layer for {input}"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_instagram_input(username).is_some_and(|normalized| {
            !normalized.is_empty()
                && normalized.len() <= 64
                && normalized
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '.' || ch == '_')
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::InstagramProvider;
    use crate::providers::Provider;

    #[tokio::test]
    async fn accepts_handle_or_profile_url() {
        let provider = InstagramProvider;
        assert!(provider.validate_username("@instagram").await.unwrap());
        assert!(provider
            .validate_username("https://www.instagram.com/instagram/")
            .await
            .unwrap());
    }
}
