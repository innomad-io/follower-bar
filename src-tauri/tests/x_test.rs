use followbar_lib::providers::x::XProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_x_accepts_handle_without_key() {
    let provider = XProvider;
    assert!(provider.needs_api_key());
    assert!(provider.validate_username("@openai").await.unwrap());
}
