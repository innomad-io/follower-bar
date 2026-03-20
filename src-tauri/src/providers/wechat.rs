use super::{FollowerData, Provider};
use anyhow::{anyhow, Context};
use chrono::Utc;
use reqwest::Url;
use serde::Deserialize;

pub struct WechatProvider;

#[derive(Debug, Deserialize, PartialEq, Eq)]
struct WechatCredentials {
    app_id: String,
    app_secret: String,
}

#[derive(Debug, Deserialize)]
struct WechatTokenResponse {
    access_token: Option<String>,
    expires_in: Option<u64>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatUserGetResponse {
    total: Option<u64>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

fn parse_wechat_credentials(value: &str) -> anyhow::Result<WechatCredentials> {
    let credentials = serde_json::from_str::<WechatCredentials>(value)
        .context("invalid WeChat credentials format")?;
    if credentials.app_id.trim().is_empty() || credentials.app_secret.trim().is_empty() {
        anyhow::bail!("WeChat AppID and AppSecret are both required");
    }
    Ok(credentials)
}

fn parse_total_followers(value: &str) -> anyhow::Result<u64> {
    let payload = serde_json::from_str::<WechatUserGetResponse>(value)
        .context("invalid WeChat followers response")?;
    if let Some(errcode) = payload.errcode {
        anyhow::bail!(
            "WeChat API error {}: {}",
            errcode,
            payload.errmsg.unwrap_or_else(|| "unknown error".to_string())
        );
    }
    payload
        .total
        .ok_or_else(|| anyhow!("WeChat followers response did not include total"))
}

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
        true
    }

    async fn fetch(&self, username: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData> {
        let credentials = parse_wechat_credentials(
            api_key.ok_or_else(|| anyhow!("微信公众号 requires AppID and AppSecret"))?,
        )?;
        let client = reqwest::Client::new();

        let token_url = Url::parse_with_params(
            "https://api.weixin.qq.com/cgi-bin/token",
            &[
                ("grant_type", "client_credential"),
                ("appid", credentials.app_id.as_str()),
                ("secret", credentials.app_secret.as_str()),
            ],
        )?;
        let token_response = client
            .get(token_url)
            .send()
            .await
            .context("failed to request WeChat access token")?
            .error_for_status()
            .context("WeChat access token request failed")?
            .json::<WechatTokenResponse>()
            .await
            .context("failed to decode WeChat access token response")?;

        if let Some(errcode) = token_response.errcode {
            anyhow::bail!(
                "WeChat API error {}: {}",
                errcode,
                token_response
                    .errmsg
                    .unwrap_or_else(|| "unknown error".to_string())
            );
        }

        let access_token = token_response
            .access_token
            .filter(|value| !value.is_empty())
            .ok_or_else(|| anyhow!("WeChat access token missing from response"))?;
        let _ = token_response.expires_in;

        let followers_url = Url::parse_with_params(
            "https://api.weixin.qq.com/cgi-bin/user/get",
            &[("access_token", access_token.as_str())],
        )?;
        let followers_body = client
            .get(followers_url)
            .send()
            .await
            .context("failed to request WeChat follower list")?
            .error_for_status()
            .context("WeChat follower list request failed")?
            .text()
            .await
            .context("failed to read WeChat follower list response")?;
        let followers = parse_total_followers(&followers_body)?;

        let display_name = username.trim();
        Ok(FollowerData {
            followers,
            fetched_at: Utc::now(),
            extra: None,
        }
        .with_profile(
            display_name.to_string(),
            credentials.app_id,
            display_name.to_string(),
        ))
    }

    async fn validate_username(&self, username: &str) -> anyhow::Result<bool> {
        Ok(!username.trim().is_empty())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_wechat_credentials_json() {
        let credentials = super::parse_wechat_credentials(
            r#"{"app_id":"wx123","app_secret":"secret456"}"#,
        )
        .expect("credentials should parse");

        assert_eq!(credentials.app_id, "wx123");
        assert_eq!(credentials.app_secret, "secret456");
    }

    #[test]
    fn extracts_total_followers_from_user_get_response() {
        let followers = super::parse_total_followers(
            r#"{"total":6983,"count":10000,"data":{"openid":["a"]},"next_openid":"x"}"#,
        )
        .expect("total should parse");

        assert_eq!(followers, 6983);
    }
}
