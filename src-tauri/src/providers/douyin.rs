use super::{FollowerData, Provider};
use anyhow::anyhow;

pub struct DouyinProvider;

#[async_trait::async_trait]
impl Provider for DouyinProvider {
    fn id(&self) -> &str {
        "douyin"
    }

    fn name(&self) -> &str {
        "抖音"
    }

    fn icon(&self) -> &str {
        "douyin"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    fn coming_soon(&self) -> bool {
        false
    }

    async fn fetch(&self, input: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        Err(anyhow!(
            "Douyin sidecar fallback should be handled by the command layer for {input}"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        let trimmed = username.trim();
        if trimmed.is_empty() {
            return Ok(false);
        }

        Ok(trimmed.contains("/user/") || trimmed.starts_with("MS4w") || trimmed.len() >= 4)
    }
}

#[cfg(test)]
mod tests {
    use super::DouyinProvider;
    use crate::providers::Provider;

    #[test]
    fn is_no_longer_marked_as_coming_soon() {
        let provider = DouyinProvider;
        assert!(!provider.coming_soon());
    }

    #[tokio::test]
    async fn accepts_public_profile_urls() {
        let provider = DouyinProvider;
        let is_valid = provider
            .validate_username(
                "https://www.douyin.com/user/MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl?from_tab_name=main",
            )
            .await
            .expect("validation should not error");

        assert!(is_valid);
    }
}
