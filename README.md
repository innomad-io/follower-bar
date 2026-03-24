# FollowerBar

[中文](./README-CN.md)

FollowerBar is a macOS menu bar app for tracking follower counts across multiple platforms.

Supported platforms currently include:

- X
- YouTube
- Bilibili
- Douyin
- Xiaohongshu
- WeChat Official Account

FollowerBar supports three provider modes depending on platform capability:

- Public Page
- Official API
- Browser-assisted

## Install

### Homebrew

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

### Manual

1. Open the GitHub Releases page for this repository.
2. Download the `.dmg` for your Mac.
3. Open the disk image.
4. Drag `FollowerBar.app` into `Applications`.

## Update

```bash
brew update
brew upgrade --cask followerbar
```

To refresh only this tap during testing:

```bash
brew update-reset innomad-io/tap
brew upgrade --cask followerbar
```

## Quick Start

1. Launch `FollowerBar`.
2. Click the menu bar icon.
3. Add an account.
4. Choose the platform and enter a handle, URL, or platform identifier.
5. Configure the provider method if needed.
6. Refresh the account or expand it to view its 7-day trend.

## Platform Notes

- X
  - Prefer Official API if you have a token.
  - Falls back to browser-assisted public page access when no token is set.
- YouTube
  - Supports Official API and public-page mode.
- Bilibili / Douyin
  - Primarily public-page based.
- Xiaohongshu / WeChat Official Account
  - Use browser-assisted mode.
  - You may need to connect a browser session first.

## Full Guide

For the complete user guide, see:

- [docs/USER_GUIDE.md](./docs/USER_GUIDE.md)

## License

This project is licensed under the MIT License.
