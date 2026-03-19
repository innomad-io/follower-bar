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
        true
    }

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        anyhow::bail!("小红书 provider is not yet supported")
    }

    async fn validate_username(&self, _username: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}

