# FollowerBar User Guide

FollowerBar is a macOS menu bar app for tracking follower counts across multiple platforms.

Depending on platform capability, FollowerBar uses different connection methods:

- Public Page
- Official API
- Browser-assisted

This guide is written for end users.

## 1. Installation

### 1.1 Install with Homebrew

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

### 1.2 Manual install

1. Open the Releases page of this repository
2. Download the `.dmg` for your machine
3. Open the disk image
4. Drag `FollowerBar.app` into `Applications`

### 1.3 If macOS says the app is damaged

If the app has not yet been signed and notarized by Apple, macOS may block it.

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

After launch, FollowerBar appears in the macOS menu bar.

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
  - shows the 7-day trend chart
  - refreshes only that account
- Use the expanded action area:
  - edit account
  - verify browser-assisted connection when needed
  - manually refresh the current account

### 2.3 Settings

Global settings include only truly global options:

- refresh interval
- notifications
- launch at login
- language
- view logs

Platform-specific configuration belongs in the account edit screen.

## 3. Adding accounts

### 3.1 Flow

When adding an account:

1. choose a platform
2. enter a handle, URL, or platform identifier
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

- full public profile URL
- user identifier such as `MS4w...`

#### Xiaohongshu

- full profile URL
- user ID

#### WeChat Official Account

This does not query arbitrary public accounts.
It reads data from the currently connected WeChat Official Account backend session.

The name you enter in FollowerBar acts as the local display name for that source.

## 4. Provider modes

### 4.1 Public Page

Meaning:

- no API credentials required
- reads data from the public page

Pros:

- simple setup
- suitable for most users

Cons:

- may break if the platform changes its page structure
- may trigger anti-bot or challenge flows

Typical platforms:

- X
- Douyin
- Bilibili
- YouTube without API key

### 4.2 Official API

Meaning:

- uses official platform API credentials

Pros:

- structured data
- usually more stable

Cons:

- requires a token or API key
- may have quotas, permissions, or pricing limits

Typical cases:

- X Bearer Token
- YouTube API Key

### 4.3 Browser-assisted

Meaning:

- uses a managed browser session
- suitable for backend pages or strongly protected platforms

Pros:

- supports platforms that are not practical through direct API access
- can reuse logged-in sessions

Cons:

- heavier than API mode
- browser sessions may expire
- first-time setup takes longer

Typical platforms:

- Xiaohongshu
- WeChat Official Account

## 5. Editing accounts

Open the account edit screen from the action area in the expanded row.

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

Depending on platform and mode, you may see:

- save Bearer Token
- save API key
- install runtime
- connect browser
- verify in browser

### 5.4 Remove account

Removing an account deletes:

- the account entry
- local historical snapshots stored for that account

## 6. Platform notes

### 6.1 X

- If a Bearer Token is configured, Official API is preferred
- Without a token, it falls back to public page / browser-assisted access

### 6.2 YouTube

- If an API key is configured, Official API is preferred
- Otherwise it can use the public page method

### 6.3 Bilibili

- Primarily uses public pages or public data sources
- Recommended input is UID or profile URL

### 6.4 Douyin

- Primarily uses the public profile page
- Recommended input is a full profile URL

### 6.5 Xiaohongshu

- Browser-assisted mode is recommended
- You may need to connect or verify the browser session
- If the platform triggers verification, use the verify action in the expanded row

> Xiaohongshu has strong anti-bot controls. Use it cautiously. If needed, use a secondary account for login.

### 6.6 WeChat Official Account

- Uses browser-assisted mode
- Requires login through the WeChat Official Account backend
- FollowerBar reads the official account name and total users from the backend page

## 7. Refresh behavior

- Expanding an account row refreshes only that account
- Global refresh is scheduled by platform type
- Browser-assisted platforms may enter cooldown after challenges or session problems
- Charts show a 7-day trend

## 8. Logs and troubleshooting

Use `Settings -> View Logs` to open the refresh logs.

Common issues include:

- missing browser-assisted session
- verification required
- platform page parse failure
- invalid API credentials

If a platform keeps failing:

1. open settings or the account edit screen
2. check the provider method
3. reconnect the browser if needed
4. refresh again

## 9. Language

FollowerBar supports switching interface language in settings.

Currently supported:

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
