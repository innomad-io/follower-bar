use super::{FollowerData, Provider};
use anyhow::anyhow;

pub struct ZhihuProvider;

fn normalize_zhihu_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    for prefix in [
        "https://www.zhihu.com/people/",
        "http://www.zhihu.com/people/",
        "https://zhihu.com/people/",
        "http://zhihu.com/people/",
    ] {
        if let Some(identifier) = trimmed.strip_prefix(prefix) {
            return identifier
                .split(['/', '?', '#'])
                .next()
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string());
        }
    }

    Some(trimmed.to_string())
}

#[async_trait::async_trait]
impl Provider for ZhihuProvider {
    fn id(&self) -> &str {
        "zhihu"
    }

    fn name(&self) -> &str {
        "知乎"
    }

    fn icon(&self) -> &str {
        "zhihu"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    async fn fetch(&self, input: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        Err(anyhow!(
            "Zhihu sidecar fetch should be handled by the command layer for {input}"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_zhihu_input(username).is_some_and(|normalized| {
            !normalized.is_empty() && normalized.len() <= 128
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::ZhihuProvider;
    use crate::providers::Provider;

    #[tokio::test]
    async fn accepts_profile_url_or_slug() {
        let provider = ZhihuProvider;
        assert!(provider
            .validate_username("https://www.zhihu.com/people/zhou-yuan")
            .await
            .unwrap());
        assert!(provider.validate_username("zhou-yuan").await.unwrap());
    }
}
