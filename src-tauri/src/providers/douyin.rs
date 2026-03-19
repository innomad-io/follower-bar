use super::{FollowerData, Provider};

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
        true
    }

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        anyhow::bail!("抖音 provider is not yet supported")
    }

    async fn validate_username(&self, _username: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}

