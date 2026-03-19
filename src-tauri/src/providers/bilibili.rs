use super::{FollowerData, Provider};
use chrono::Utc;
use serde::Deserialize;

pub struct BilibiliProvider;

fn normalize_bilibili_input(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.chars().all(|ch| ch.is_ascii_digit()) {
        return Some(trimmed.to_string());
    }

    if let Some(index) = trimmed.find("space.bilibili.com/") {
        let value = &trimmed[index + "space.bilibili.com/".len()..];
        return value
            .split('/')
            .next()
            .filter(|segment| !segment.is_empty())
            .map(|segment| segment.to_string());
    }

    Some(trimmed.trim_start_matches('@').to_string())
}

#[derive(Debug, Deserialize)]
struct BiliResponse {
    code: i32,
    data: Option<BiliData>,
}

#[derive(Debug, Deserialize)]
struct BiliData {
    mid: Option<u64>,
    follower: u64,
}

#[derive(Debug, Deserialize)]
struct BiliAccountInfoResponse {
    code: i32,
    data: Option<BiliCardData>,
}

#[derive(Debug, Deserialize)]
struct BiliCardData {
    card: BiliAccountInfo,
}

#[derive(Debug, Deserialize)]
struct BiliAccountInfo {
    name: String,
}

#[derive(Debug, Deserialize)]
struct BiliSearchResponse {
    data: Option<BiliSearchData>,
}

#[derive(Debug, Deserialize)]
struct BiliSearchData {
    result: Option<Vec<BiliSearchUser>>,
}

#[derive(Debug, Deserialize)]
struct BiliSearchUser {
    mid: String,
    uname: String,
}

#[async_trait::async_trait]
impl Provider for BilibiliProvider {
    fn id(&self) -> &str {
        "bilibili"
    }

    fn name(&self) -> &str {
        "Bilibili"
    }

    fn icon(&self) -> &str {
        "bilibili"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    async fn fetch(&self, input: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let normalized = normalize_bilibili_input(input)
            .ok_or_else(|| anyhow::anyhow!("Invalid Bilibili input"))?;
        let search_result = if normalized.chars().all(|ch| ch.is_ascii_digit()) {
            None
        } else {
            let search_url = reqwest::Url::parse_with_params(
                "https://api.bilibili.com/x/web-interface/search/type",
                &[("search_type", "bili_user"), ("keyword", normalized.as_str())],
            )?;
            let response = reqwest::get(search_url).await?.json::<BiliSearchResponse>().await?;
            Some(
                response
                .data
                .and_then(|data| data.result)
                .and_then(|mut items| items.drain(..).next())
                .ok_or_else(|| anyhow::anyhow!("Bilibili user not found"))?,
            )
        };

        let mid = search_result
            .as_ref()
            .map(|user| user.mid.as_str())
            .unwrap_or(normalized.as_str());
        let url = format!("https://api.bilibili.com/x/relation/stat?vmid={mid}");
        let response = reqwest::get(url).await?.json::<BiliResponse>().await?;

        if response.code != 0 {
            anyhow::bail!("Bilibili API returned non-zero code {}", response.code);
        }

        let data = response
            .data
            .ok_or_else(|| anyhow::anyhow!("Bilibili response missing data"))?;
        let resolved_mid = data
            .mid
            .map(|value| value.to_string())
            .or_else(|| search_result.as_ref().map(|user| user.mid.clone()))
            .unwrap_or_else(|| mid.to_string());
        let display_name = if let Some(user) = search_result {
            user.uname
        } else {
            let account_info = match reqwest::get(format!(
                "https://api.bilibili.com/x/web-interface/card?mid={resolved_mid}"
            ))
            .await
            {
                Ok(response) => response.json::<BiliAccountInfoResponse>().await.ok(),
                Err(_) => None,
            };

            account_info
                .and_then(|response| if response.code == 0 { response.data } else { None })
                .map(|info| info.card.name)
                .unwrap_or_else(|| normalized.clone())
        };

        Ok(FollowerData {
            followers: data.follower,
            fetched_at: Utc::now(),
            extra: None,
        }
        .with_profile(resolved_mid.clone(), resolved_mid, display_name))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(normalize_bilibili_input(username).is_some())
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_bilibili_input;

    #[test]
    fn accepts_uid_or_profile_url() {
        assert_eq!(normalize_bilibili_input("12345"), Some("12345".to_string()));
        assert_eq!(
            normalize_bilibili_input("https://space.bilibili.com/12345"),
            Some("12345".to_string())
        );
        assert_eq!(normalize_bilibili_input("creativeworks"), Some("creativeworks".to_string()));
    }
}
