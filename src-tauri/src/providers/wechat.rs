use super::{FollowerData, Provider};

pub struct WechatProvider;

#[async_trait::async_trait]
impl Provider for WechatProvider {
    fn id(&self) -> &str {
        "wechat"
    }

    fn name(&self) -> &str {
        "微信公众号"
    }

    fn icon(&self) -> &str {
        "wechat"
    }

    fn needs_api_key(&self) -> bool {
        false
    }

    fn coming_soon(&self) -> bool {
        true
    }

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        anyhow::bail!("微信公众号 provider is not yet supported")
    }

    async fn validate_username(&self, _username: &str) -> anyhow::Result<bool> {
        Ok(true)
    }
}

