# FollowBar Provider Sidecar

This sidecar hosts browser-assisted providers that need a persistent browser
session. The first implementation is Xiaohongshu.

Supported actions:

- `health_check`
- `connect`
- `fetch_profile`

Input is JSON via stdin or a JSON file path passed as the first argument.
