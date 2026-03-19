use followbar_lib::providers::youtube::YoutubeProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_youtube_accepts_handle_without_key() {
    let provider = YoutubeProvider;
    assert!(provider.needs_api_key());
    assert!(provider.validate_username("@GoogleDevelopers").await.unwrap());
}
