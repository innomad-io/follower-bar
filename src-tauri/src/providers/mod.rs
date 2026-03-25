pub mod bilibili;
pub mod douyin;
pub mod instagram;
pub mod threads;
pub mod wechat;
pub mod x;
pub mod xiaohongshu;
pub mod youtube;
pub mod zhihu;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FollowerData {
    pub followers: u64,
    pub fetched_at: DateTime<Utc>,
    pub extra: Option<HashMap<String, String>>,
}

impl FollowerData {
    pub fn with_profile(mut self, username: String, resolved_id: String, display_name: String) -> Self {
        let extra = self.extra.get_or_insert_with(HashMap::new);
        extra.insert("username".to_string(), username);
        extra.insert("resolved_id".to_string(), resolved_id);
        extra.insert("display_name".to_string(), display_name);
        self
    }
}

#[async_trait::async_trait]
pub trait Provider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn icon(&self) -> &str;
    fn needs_api_key(&self) -> bool;
    fn coming_soon(&self) -> bool {
        false
    }
    async fn fetch(&self, username: &str, api_key: Option<&str>) -> anyhow::Result<FollowerData>;
    async fn validate_username(&self, username: &str) -> anyhow::Result<bool>;
}

pub struct ProviderManager {
    providers: HashMap<String, Box<dyn Provider>>,
}

impl ProviderManager {
    pub fn new() -> Self {
        let mut manager = Self {
            providers: HashMap::new(),
        };

        manager.register(Box::new(bilibili::BilibiliProvider));
        manager.register(Box::new(youtube::YoutubeProvider));
        manager.register(Box::new(x::XProvider));
        manager.register(Box::new(xiaohongshu::XiaohongshuProvider));
        manager.register(Box::new(wechat::WechatProvider));
        manager.register(Box::new(douyin::DouyinProvider));
        manager.register(Box::new(instagram::InstagramProvider));
        manager.register(Box::new(threads::ThreadsProvider));
        manager.register(Box::new(zhihu::ZhihuProvider));

        manager
    }

    pub fn register(&mut self, provider: Box<dyn Provider>) {
        self.providers.insert(provider.id().to_string(), provider);
    }

    pub fn get(&self, id: &str) -> Option<&dyn Provider> {
        self.providers.get(id).map(|provider| provider.as_ref())
    }

    pub fn list(&self) -> Vec<&dyn Provider> {
        let mut providers: Vec<&dyn Provider> =
            self.providers.values().map(|provider| provider.as_ref()).collect();
        providers.sort_by(|left, right| left.name().cmp(right.name()));
        providers
    }
}
