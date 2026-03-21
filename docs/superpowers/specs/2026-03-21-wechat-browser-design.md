# WeChat Browser-Assisted Provider

## Goal

Switch the WeChat Official Account provider from the developer API path to a browser-assisted runtime that reads the current follower total from the logged-in admin console.

## Scope

- Reuse the existing Playwright sidecar and Chromium runtime.
- Add WeChat as an advanced provider with install/connect actions in Settings.
- Require one manual login to `mp.weixin.qq.com`, then reuse the persistent browser profile.
- On refresh, load the admin console in the sidecar and extract the current follower total from the page.
- Keep the account input as a display label only.

## Non-goals

- Publishing posts, drafts, assets, or comments.
- Querying arbitrary public WeChat accounts.
- Multi-account switching inside one browser profile.
- Official API credentials or IP whitelisting.

## Data Flow

1. User installs the advanced runtime.
2. User clicks Connect for WeChat and logs into the official account admin console.
3. Sidecar persists the WeChat browser profile and writes `.connected`.
4. Refresh calls the WeChat sidecar provider.
5. Sidecar opens the admin home page with the saved profile, extracts the follower total, and returns it to Rust.
6. Rust writes the snapshot and updates account display metadata.

## Error Handling

- If the session is missing or expired, return `LOGIN_REQUIRED`.
- If the page loads but no follower total can be extracted, return `DATA_EXTRACTION_FAILED`.
- If WeChat shows a verification or security page, return a browser-side error for manual reconnect.

