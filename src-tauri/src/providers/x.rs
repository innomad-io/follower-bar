use super::{FollowerData, Provider};
use anyhow::anyhow;
use chrono::Utc;
use serde::Deserialize;

pub struct XProvider;

fn normalize_x_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if let Some(username) = trimmed.strip_prefix('@') {
        return Some(username.to_string());
    }

    for prefix in [
        "https://x.com/",
        "http://x.com/",
        "https://twitter.com/",
        "http://twitter.com/",
    ] {
        if let Some(username) = trimmed.strip_prefix(prefix) {
            return username
                .split('/')
                .next()
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string());
        }
    }

    Some(trimmed.to_string())
}

#[derive(Debug, Deserialize)]
struct XResponse {
    data: Option<XData>,
}

#[derive(Debug, Deserialize)]
struct XData {
    name: String,
    username: String,
    public_metrics: XMetrics,
}

#[derive(Debug, Deserialize)]
struct XMetrics {
    followers_count: u64,
}

async fn fetch_with_token(username: &str, bearer_token: &str) -> anyhow::Result<FollowerData> {
    let url = format!(
        "https://api.x.com/2/users/by/username/{username}?user.fields=public_metrics,name,username"
    );

    let response = reqwest::Client::new()
        .get(url)
        .header("Authorization", format!("Bearer {bearer_token}"))
        .send()
        .await?
        .json::<XResponse>()
        .await?;

    let data = response
        .data
        .ok_or_else(|| anyhow!("X user not found"))?;

    Ok(FollowerData {
        followers: data.public_metrics.followers_count,
        fetched_at: Utc::now(),
        extra: None,
    }
    .with_profile(format!("@{}", data.username), data.username, data.name))
}

#[async_trait::async_trait]
impl Provider for XProvider {
    fn id(&self) -> &str {
        "x"
    }

    fn name(&self) -> &str {
        "X (Twitter)"
    }

    fn icon(&self) -> &str {
        "x"
    }

    fn needs_api_key(&self) -> bool {
        true
    }

    async fn fetch(&self, input: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let username = normalize_x_input(input).ok_or_else(|| anyhow!("Invalid X handle"))?;

        if let Some(bearer_token) = api_key {
            return fetch_with_token(&username, bearer_token).await;
        }

        Err(anyhow!(
            "X sidecar fallback should be handled by the command layer"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_x_input(username).is_some_and(|normalized| {
            !normalized.is_empty()
                && normalized.len() <= 15
                && normalized
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '_')
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_x_input;

    #[test]
    fn accepts_handle_or_profile_url() {
        assert_eq!(normalize_x_input("@openai"), Some("openai".to_string()));
        assert_eq!(
            normalize_x_input("https://x.com/openai"),
            Some("openai".to_string())
        );
        assert_eq!(
            normalize_x_input("https://twitter.com/openai/"),
            Some("openai".to_string())
        );
    }
}
