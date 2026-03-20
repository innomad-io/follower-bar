use super::{FollowerData, Provider};

pub struct XiaohongshuProvider;

#[async_trait::async_trait]
impl Provider for XiaohongshuProvider {
    fn id(&self) -> &str {
        "xiaohongshu"
    }

    fn name(&self) -> &str {
        "小红书"
    }

    fn icon(&self) -> &str {
        "xiaohongshu"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    fn coming_soon(&self) -> bool {
        false
    }

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        anyhow::bail!("Xiaohongshu uses the browser-assisted provider runtime")
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        let value = username.trim();
        if value.is_empty() {
            return Ok(false);
        }

        if let Some(stripped) = value.strip_prefix("https://www.xiaohongshu.com/user/profile/") {
            return Ok(!stripped.trim_matches('/').is_empty());
        }

        Ok(value.len() >= 8)
    }
}
