use super::{FollowerData, Provider};
use anyhow::{anyhow, Context};
use chrono::Utc;
use regex::Regex;
use reqwest::header::USER_AGENT;
use serde::Deserialize;

pub struct XProvider;
const PUBLIC_WEB_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

#[derive(Debug, Clone, PartialEq, Eq)]
struct PublicXProfile {
    username: String,
    resolved_id: String,
    display_name: String,
    followers: u64,
}

#[derive(Debug, Deserialize)]
struct XSyndicationUser {
    screen_name: String,
    name: String,
    followers_count: u64,
}

fn normalize_x_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if let Some(username) = trimmed.strip_prefix('@') {
        return Some(username.to_string());
    }

    for prefix in ["https://x.com/", "http://x.com/", "https://twitter.com/", "http://twitter.com/"] {
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

fn decode_json_string(value: &str) -> Option<String> {
    serde_json::from_str::<String>(&format!("\"{value}\"")).ok()
}

fn parse_public_profile_page(html: &str) -> Option<PublicXProfile> {
    let followers_regex = Regex::new(r#""followers_count":([0-9]+)"#).ok()?;
    let screen_name_regex =
        Regex::new(r#""screen_name":"((?:\\.|[^"])+)""#).ok()?;
    let name_regex = Regex::new(r#""name":"((?:\\.|[^"])+)""#).ok()?;

    let followers = followers_regex
        .captures(html)?
        .get(1)?
        .as_str()
        .parse::<u64>()
        .ok()?;
    let screen_name = screen_name_regex
        .captures(html)?
        .get(1)
        .and_then(|value| decode_json_string(value.as_str()))?;
    let display_name = name_regex
        .captures(html)?
        .get(1)
        .and_then(|value| decode_json_string(value.as_str()))?;

    Some(PublicXProfile {
        username: format!("@{screen_name}"),
        resolved_id: screen_name,
        display_name,
        followers,
    })
}

fn parse_syndication_response(body: &str) -> Option<PublicXProfile> {
    let user = serde_json::from_str::<Vec<XSyndicationUser>>(body)
        .ok()?
        .into_iter()
        .next()?;

    Some(PublicXProfile {
        username: format!("@{}", user.screen_name),
        resolved_id: user.screen_name,
        display_name: user.name,
        followers: user.followers_count,
    })
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
        let username =
            normalize_x_input(input).ok_or_else(|| anyhow!("Invalid X handle"))?;

        if let Some(bearer_token) = api_key {
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

            return Ok(FollowerData {
                followers: data.public_metrics.followers_count,
                fetched_at: Utc::now(),
                extra: None,
            }
            .with_profile(format!("@{}", data.username), data.username, data.name));
        }

        let syndication_url = format!(
            "https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names={username}"
        );
        if let Ok(response) = reqwest::Client::new()
            .get(&syndication_url)
            .header(USER_AGENT, PUBLIC_WEB_USER_AGENT)
            .send()
            .await
        {
            if let Ok(body) = response.error_for_status()?.text().await {
                if let Some(parsed) = parse_syndication_response(&body) {
                    return Ok(FollowerData {
                        followers: parsed.followers,
                        fetched_at: Utc::now(),
                        extra: None,
                    }
                    .with_profile(parsed.username, parsed.resolved_id, parsed.display_name));
                }
            }
        }

        let public_url = format!("https://x.com/{username}");
        let html = reqwest::Client::new()
            .get(&public_url)
            .header(USER_AGENT, PUBLIC_WEB_USER_AGENT)
            .send()
            .await
            .with_context(|| format!("failed to request {public_url}"))?
            .error_for_status()?
            .text()
            .await?;
        let parsed = parse_public_profile_page(&html)
            .ok_or_else(|| anyhow!("X public page parse failed"))?;

        Ok(FollowerData {
            followers: parsed.followers,
            fetched_at: Utc::now(),
            extra: None,
        }
        .with_profile(parsed.username, parsed.resolved_id, parsed.display_name))
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
    use super::{normalize_x_input, parse_public_profile_page, parse_syndication_response};

    #[test]
    fn accepts_handle_or_profile_url() {
        assert_eq!(normalize_x_input("@openai"), Some("openai".to_string()));
        assert_eq!(
            normalize_x_input("https://x.com/openai"),
            Some("openai".to_string())
        );
    }

    #[test]
    fn parses_public_state_profile_and_followers() {
        let html = r#"
            <script>
              window.__INITIAL_STATE__={"entities":{"users":{"entities":{"42":{
                "name":"OpenAI",
                "screen_name":"openai",
                "followers_count":9876543
              }}}}};
            </script>
        "#;

        let parsed = parse_public_profile_page(html).expect("expected public profile parse");

        assert_eq!(parsed.display_name, "OpenAI");
        assert_eq!(parsed.username, "@openai");
        assert_eq!(parsed.resolved_id, "openai");
        assert_eq!(parsed.followers, 9_876_543);
    }

    #[test]
    fn parses_syndication_profile_and_followers() {
        let json = r#"[{
            "screen_name":"openai",
            "name":"OpenAI",
            "followers_count":12345678
        }]"#;

        let parsed = parse_syndication_response(json).expect("expected syndication parse");

        assert_eq!(parsed.display_name, "OpenAI");
        assert_eq!(parsed.username, "@openai");
        assert_eq!(parsed.resolved_id, "openai");
        assert_eq!(parsed.followers, 12_345_678);
    }
}
