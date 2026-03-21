use super::{FollowerData, Provider};
use anyhow::anyhow;

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

    async fn fetch(&self, _username: &str, _api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        Err(anyhow!(
            "WeChat browser-assisted fetch should be handled by the command layer"
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(!username.trim().is_empty())
    }
}
