use super::{FollowerData, Provider};
use anyhow::{anyhow, Context};
use chrono::Utc;
use regex::Regex;
use reqwest::header::USER_AGENT;
use serde::Deserialize;

pub struct YoutubeProvider;
const PUBLIC_WEB_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

#[derive(Debug, Clone, PartialEq, Eq)]
struct PublicYoutubeProfile {
    username: String,
    resolved_id: String,
    display_name: String,
    followers: u64,
}

fn normalize_youtube_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if let Some(handle) = trimmed.strip_prefix('@') {
        return (!handle.is_empty()).then(|| format!("@{handle}"));
    }

    if trimmed.starts_with("UC") {
        return Some(trimmed.to_string());
    }

    if let Some(index) = trimmed.find("/@") {
        let handle = &trimmed[index + 2..];
        return (!handle.is_empty()).then(|| format!("@{}", handle.trim_matches('/')));
    }

    if let Some(index) = trimmed.find("/channel/") {
        let channel_id = &trimmed[index + 9..];
        return (!channel_id.is_empty()).then(|| channel_id.trim_matches('/').to_string());
    }

    Some(format!("@{}", trimmed.trim_start_matches('@')))
}

fn capture_group<'a>(regex: &Regex, haystack: &'a str) -> Option<String> {
    regex
        .captures(haystack)
        .and_then(|caps| caps.get(1))
        .map(|value| value.as_str().to_string())
}

fn parse_compact_number(value: &str) -> Option<u64> {
    let sanitized = value.trim().replace(',', "");
    let (number, multiplier) = match sanitized.chars().last()? {
        'K' | 'k' => (&sanitized[..sanitized.len() - 1], 1_000_f64),
        'M' | 'm' => (&sanitized[..sanitized.len() - 1], 1_000_000_f64),
        'B' | 'b' => (&sanitized[..sanitized.len() - 1], 1_000_000_000_f64),
        _ => (sanitized.as_str(), 1_f64),
    };

    Some((number.parse::<f64>().ok()? * multiplier).round() as u64)
}

fn parse_public_channel_page(html: &str) -> Option<PublicYoutubeProfile> {
    let identifier_regex = Regex::new(r#"itemprop="identifier" content="([^"]+)""#).ok()?;
    let name_regex = Regex::new(r#"itemprop="name" content="([^"]+)""#).ok()?;
    let yt_url_regex = Regex::new(r#"window\['ytUrl'\]\s*=\s*'([^']+)'"#).ok()?;
    let vanity_regex = Regex::new(r#"canonicalBaseUrl":"\\/(@[^"]+)""#).ok()?;
    let subscribers_regex = Regex::new(r#"([0-9][0-9.,]*\s*[KMBkmb]?)\s+subscribers"#).ok()?;

    let resolved_id = capture_group(&identifier_regex, html)?;
    let display_name = capture_group(&name_regex, html)?;
    let username = capture_group(&yt_url_regex, html)
        .map(|value| value.replace("\\/", "/"))
        .map(|value| value.trim_start_matches('/').to_string())
        .filter(|value| value.starts_with('@'))
        .or_else(|| capture_group(&vanity_regex, html))
        .unwrap_or_else(|| resolved_id.clone());
    let followers = capture_group(&subscribers_regex, html)
        .and_then(|value| parse_compact_number(&value))?;

    Some(PublicYoutubeProfile {
        username,
        resolved_id,
        display_name,
        followers,
    })
}

#[derive(Debug, Deserialize)]
struct YoutubeResponse {
    items: Vec<YoutubeItem>,
}

#[derive(Debug, Deserialize)]
struct YoutubeItem {
    id: String,
    snippet: YoutubeSnippet,
    statistics: YoutubeStatistics,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YoutubeSnippet {
    title: String,
    custom_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YoutubeStatistics {
    subscriber_count: String,
}

#[async_trait::async_trait]
impl Provider for YoutubeProvider {
    fn id(&self) -> &str {
        "youtube"
    }

    fn name(&self) -> &str {
        "YouTube"
    }

    fn icon(&self) -> &str {
        "youtube"
    }

    fn needs_api_key(&self) -> bool {
        true
    }

    async fn fetch(&self, input: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let normalized =
            normalize_youtube_input(input).ok_or_else(|| anyhow!("Invalid YouTube handle"))?;

        if let Some(api_key) = api_key {
            let query = if normalized.starts_with('@') {
                format!(
                    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle={}&key={}",
                    normalized.trim_start_matches('@'),
                    api_key
                )
            } else {
                format!(
                    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id={normalized}&key={api_key}"
                )
            };

            let response = reqwest::get(query).await?.json::<YoutubeResponse>().await?;
            let item = response
                .items
                .first()
                .ok_or_else(|| anyhow!("YouTube channel not found"))?;

            let username = item
                .snippet
                .custom_url
                .clone()
                .filter(|value| !value.is_empty())
                .map(|value| format!("@{value}"))
                .unwrap_or(normalized.clone());

            return Ok(FollowerData {
                followers: item.statistics.subscriber_count.parse()?,
                fetched_at: Utc::now(),
                extra: None,
            }
            .with_profile(username, item.id.clone(), item.snippet.title.clone()));
        }

        let public_url = if normalized.starts_with('@') {
            format!("https://www.youtube.com/{normalized}")
        } else {
            format!("https://www.youtube.com/channel/{normalized}")
        };
        let html = reqwest::Client::new()
            .get(&public_url)
            .header(USER_AGENT, PUBLIC_WEB_USER_AGENT)
            .send()
            .await
            .with_context(|| format!("failed to request {public_url}"))?
            .error_for_status()?
            .text()
            .await?;
        let parsed = parse_public_channel_page(&html)
            .ok_or_else(|| anyhow!("YouTube public page parse failed"))?;

        Ok(FollowerData {
            followers: parsed.followers,
            fetched_at: Utc::now(),
            extra: None,
        }
        .with_profile(parsed.username, parsed.resolved_id, parsed.display_name))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_youtube_input(username).is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_youtube_input, parse_public_channel_page};

    #[test]
    fn accepts_handle_or_channel_url() {
        assert_eq!(normalize_youtube_input("@design"), Some("@design".to_string()));
        assert_eq!(
            normalize_youtube_input("https://www.youtube.com/@design"),
            Some("@design".to_string())
        );
        assert_eq!(
            normalize_youtube_input("https://www.youtube.com/channel/UC123"),
            Some("UC123".to_string())
        );
    }

    #[test]
    fn parses_public_page_profile_and_followers() {
        let html = r#"
            <meta itemprop="identifier" content="UC_x5XG1OV2P6uZZ5FSM9Ttw">
            <link itemprop="name" content="Google for Developers">
            <script>
              window['ytUrl'] = '\/@GoogleDevelopers';
            </script>
            <div>2.61M subscribers</div>
        "#;

        let parsed = parse_public_channel_page(html).expect("expected public page parse");

        assert_eq!(parsed.display_name, "Google for Developers");
        assert_eq!(parsed.resolved_id, "UC_x5XG1OV2P6uZZ5FSM9Ttw");
        assert_eq!(parsed.username, "@GoogleDevelopers");
        assert_eq!(parsed.followers, 2_610_000);
    }
}
