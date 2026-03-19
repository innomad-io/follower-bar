use followbar_lib::providers::bilibili::BilibiliProvider;
use followbar_lib::providers::Provider;

#[tokio::test]
async fn test_bilibili_fetch_real() {
    let provider = BilibiliProvider;
    let result = provider.fetch("1", None).await;
    assert!(result.is_ok());

    let data = result.unwrap();
    assert!(data.followers > 0);
}

