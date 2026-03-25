use super::{FollowerData, Provider};
use anyhow::anyhow;

pub struct ThreadsProvider;

fn normalize_threads_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if let Some(username) = trimmed.strip_prefix('@') {
        return Some(username.to_string());
    }

    for prefix in [
        "https://www.threads.net/@",
        "http://www.threads.net/@",
        "https://threads.net/@",
        "http://threads.net/@",
        "https://www.threads.com/@",
        "http://www.threads.com/@",
        "https://threads.com/@",
        "http://threads.com/@",
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
impl Provider for ThreadsProvider {
    fn id(&self) -> &str {
        "threads"
    }

    fn name(&self) -> &str {
        "Threads"
    }

    fn icon(&self) -> &str {
        "threads"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    async fn fetch(&self, input: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        Err(anyhow!(
            "Threads sidecar fetch should be handled by the command layer for {input}"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_threads_input(username).is_some_and(|normalized| {
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
    use super::ThreadsProvider;
    use crate::providers::Provider;

    #[tokio::test]
    async fn accepts_handle_or_profile_url() {
        let provider = ThreadsProvider;
        assert!(provider.validate_username("@zuck").await.unwrap());
        assert!(provider
            .validate_username("https://www.threads.net/@zuck")
            .await
            .unwrap());
    }
}
