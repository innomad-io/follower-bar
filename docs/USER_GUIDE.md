# FollowerBar User Guide

FollowerBar is a macOS menu bar app for monitoring follower counts across multiple platforms.

It supports different connection methods depending on platform capability:

- Public Page
- Official API
- Browser-assisted

This guide is written for end users.

## 1. Installation

### 1.1 Homebrew

First install:

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

Upgrade later:

```bash
brew update
brew upgrade --cask followerbar
```

To refresh only this tap while testing:

```bash
brew update-reset innomad-io/tap
brew upgrade --cask followerbar
```

### 1.2 Manual install

1. Open the Releases page of this repository.
2. Download the `.dmg` for your machine.
3. Open the disk image.
4. Drag `FollowerBar.app` into `Applications`.

### 1.3 If macOS says the app is damaged

If the app is not yet signed and notarized by Apple, macOS may block it.

Temporary workaround:

```bash
xattr -dr com.apple.quarantine /Applications/FollowerBar.app
```

Or:

1. Find `FollowerBar.app` in Finder
2. Right click
3. Choose `Open`
4. Confirm in the system dialog

## 2. Basic usage

### 2.1 Launch

After launching, FollowerBar appears in the macOS menu bar.

Click the menu bar icon to open the popover.

The main popover shows:

- tracked accounts
- current follower counts
- today delta
- last updated status
- refresh button

### 2.2 Main list interaction

- Click an account row:
  - expands the row
  - shows a 7-day chart
  - refreshes that account only
- Use the expanded action area:
  - edit account
  - verify browser-assisted connection if required
  - manually refresh

### 2.3 Settings

Global settings are intentionally minimal:

- refresh interval
- notifications
- launch at login
- language
- view logs

Platform-specific configuration belongs to the account edit screen.

## 3. Adding accounts

### 3.1 Flow

When adding an account:

1. choose platform
2. enter a handle, URL, or identifier
3. continue
4. configure provider method later in the account edit screen if needed

### 3.2 Recommended input by platform

#### X

- `@username`
- `x.com/username`
- `twitter.com/username`

#### YouTube

- `@handle`
- `youtube.com/@handle`
- `youtube.com/channel/UC...`

#### Bilibili

- UID
- `https://space.bilibili.com/...`

#### Douyin

- full public user URL
- user identifier such as `MS4w...`

#### Xiaohongshu

- full profile URL
- user ID

#### WeChat Official Account

This does not query arbitrary public accounts.
It reads the account currently connected through the official account backend session.

The name in FollowerBar acts as the local display name for that source.

## 4. Provider modes

### 4.1 Public Page

Meaning:

- no API credentials required
- reads public page data

Pros:

- easier setup
- suitable for most users

Cons:

- may break if the platform changes the page
- may trigger anti-bot limits

Typical platforms:

- X
- Douyin
- Bilibili
- YouTube without API key

### 4.2 Official API

Meaning:

- uses official API credentials

Pros:

- more structured
- usually more stable

Cons:

- requires token or API key
- may have limits or pricing

Typical use:

- X Bearer Token
- YouTube API Key

### 4.3 Browser-assisted

Meaning:

- uses a managed browser session
- suitable for backend pages or strongly protected pages

Pros:

- can support platforms that do not offer practical public APIs
- can reuse authenticated sessions

Cons:

- heavier than API mode
- browser session may expire
- first setup takes longer

Typical platforms:

- Xiaohongshu
- WeChat Official Account

## 5. Editing accounts

Open the account edit screen from the expanded row actions.

The edit screen includes:

### 5.1 Basic Info

- display name
- account identifier or URL

### 5.2 Connection & Provider

Choose the provider method available for that account.

Examples:

- X:
  - Public Page
  - Official API
- YouTube:
  - Public Page
  - Official API
- Xiaohongshu:
  - Browser-assisted
- WeChat Official Account:
  - Browser-assisted

### 5.3 Provider Actions

Depending on platform and method, actions may include:

- save bearer token
- save API key
- install runtime
- connect browser
- verify in browser

### 5.4 Remove account

Removing an account deletes:

- the tracked account entry
- local historical snapshots for that account

## 6. Platform-specific notes

### 6.1 X

- If Bearer Token is configured, Official API is preferred.
- If no token is configured, FollowerBar can use browser-assisted public-page access.

### 6.2 YouTube

- If API key is configured, Official API is preferred.
- Otherwise public page mode may be used.

### 6.3 Bilibili

- Uses public page or public data sources.
- Input can be UID or profile URL.

### 6.4 Douyin

- Uses public profile page access.
- Full profile URL is preferred.

### 6.5 Xiaohongshu

- Browser-assisted mode is recommended.
- You may need to connect or verify your browser session.
- If the platform triggers verification, use the row action to verify.

### 6.6 WeChat Official Account

- Browser-assisted mode is used.
- Log in through the official account backend when prompted.
- FollowerBar reads the connected account name and total users from the backend page.

## 7. Refresh behavior

- Expanding a row refreshes only that account.
- Global refresh refreshes all accounts with platform-aware scheduling.
- Browser-assisted platforms may be cooled down after challenge or session issues.
- Charts show a 7-day trend.

## 8. Logs and troubleshooting

Use `Settings -> View Logs` to inspect refresh logs.

Typical issues:

- browser-assisted session missing
- verification required
- platform page parse failed
- API credential invalid

If a platform repeatedly fails:

1. open settings or account edit
2. check provider method
3. reconnect browser if needed
4. retry refresh

## 9. Language

FollowerBar supports interface language selection in settings.

You can choose:

- English
- 简体中文

## 10. Uninstall

If installed with Homebrew:

```bash
brew uninstall --cask followerbar
```

You can also remove:

- `~/Library/Application Support/io.innomad.followbar`
- `~/Library/Preferences/io.innomad.followbar.plist`

