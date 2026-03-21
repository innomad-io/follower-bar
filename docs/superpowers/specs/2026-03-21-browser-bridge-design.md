# Browser Bridge Design

## Goal

Add an optional browser integration mode for advanced providers so ordinary users can reuse their existing Chrome login state instead of always installing and managing a separate Chromium runtime.

This is a product and architecture design only. It does not change the current implementation yet.

## Background

The current advanced-provider model is:

- FollowBar installs its own Playwright runtime and Chromium browser.
- Each heavy platform uses a dedicated persistent profile under FollowBar's app data directory.
- Users log in again inside that managed browser.

This model is stable and controlled, but it has user-facing downsides:

- Large first-run download cost.
- Users must log in again even if they are already logged into Chrome.
- Login state is split across multiple browser contexts.

For ordinary users, a better experience is to optionally connect to the browser they already use every day.

## Product Decision

FollowBar should support two advanced-provider runtime modes:

1. Managed Browser
- Current behavior.
- FollowBar downloads and controls its own Chromium runtime and profile.
- This remains the default and recommended mode.

2. Existing Chrome
- New optional mode.
- FollowBar connects to the user's already-running Chrome through a browser bridge.
- Login state stays in the user's normal browser context.

The user should choose the mode per platform, not globally for the whole app.

## Why Browser Bridge Instead Of Direct Profile Reuse

We should not treat "use existing Chrome" as "point Playwright at the user's Chrome profile directory."

Direct profile reuse has major problems:

- The user's main Chrome profile is usually locked while Chrome is running.
- Concurrent access to the same profile is fragile.
- It risks corrupting or interfering with the user's daily browser state.
- It gives FollowBar too much implicit access to unrelated browsing data.

The safer model is a browser bridge:

- A Chrome extension runs inside the user's real Chrome profile.
- A small local bridge process communicates with that extension.
- FollowBar asks the bridge for page data or for specific provider actions.
- Credentials stay in the browser; FollowBar only receives the minimum structured result.

This is the same general product direction used by tools like `opencli`: an extension plus local bridge, rather than raw profile takeover.

## High-Level Architecture

### Managed Browser Mode

Existing path, kept as-is:

1. FollowBar command layer asks `advanced_runtime`.
2. `advanced_runtime` runs the Playwright sidecar.
3. Sidecar opens managed Chromium.
4. Provider script extracts data and returns JSON.

### Existing Chrome Mode

New path:

1. FollowBar command layer asks `browser_bridge_runtime`.
2. Local bridge daemon communicates with a Chrome extension.
3. The extension runs inside the user's logged-in Chrome.
4. The extension either:
   - reads the current tab, or
   - opens a new provider tab in the user's Chrome
5. The extension extracts the minimal provider result.
6. The bridge daemon returns structured JSON to FollowBar.

## Components

### 1. Runtime Mode Selector

Each advanced provider stores a runtime mode:

- `managed`
- `existing_chrome`

Settings UI should expose this as a compact segmented control or radio group under each supported advanced provider.

### 2. Browser Bridge Extension

Responsibilities:

- Request only the minimum Chrome permissions needed.
- Receive structured commands from the local bridge.
- Open or focus provider pages in normal Chrome tabs when needed.
- Extract provider-specific structured data from the current DOM or page state.
- Return only the requested fields.

Initial provider fields:

- `display_name`
- `resolved_id`
- `username`
- `followers`

### 3. Local Bridge Daemon

Responsibilities:

- Accept local-only requests from FollowBar.
- Authenticate that requests come from the local app.
- Communicate with the extension through native messaging or a local websocket/http bridge.
- Return structured JSON responses.
- Provide health checks and installation diagnostics.

### 4. FollowBar Bridge Runtime

New Rust module, parallel to `advanced_runtime`.

Responsibilities:

- Detect whether the bridge daemon and extension are installed.
- Expose provider status to the UI.
- Call the local bridge for fetch or connect operations.
- Normalize bridge errors into FollowBar provider errors.

## User Experience

### Settings

For supported advanced providers, Settings should show:

- Runtime Mode:
  - Managed Browser
  - Existing Chrome

If `Existing Chrome` is selected, show:

- Install Extension
- Verify Connection
- Open Provider Tab

### First-Time Flow

1. User chooses `Existing Chrome`.
2. FollowBar prompts them to install the Chrome extension.
3. FollowBar starts or connects to the local bridge daemon.
4. User clicks `Verify Connection`.
5. FollowBar confirms:
   - Chrome reachable
   - extension installed
   - bridge daemon reachable

### Daily Use

When refreshing:

- If Chrome is running and the extension is connected, data is fetched directly from the user's logged-in browser context.
- If not connected, the account row shows a clear reconnect or install prompt.

## Security And Privacy

The browser bridge mode must keep the privacy boundary much tighter than direct profile reuse.

Principles:

- FollowBar should not read browser cookie databases directly.
- FollowBar should not copy the user's Chrome profile.
- Credentials should stay in the browser context.
- The extension should return only provider-specific structured data, not raw page dumps.
- The bridge daemon should bind only to localhost or use native messaging.

Extension permission scope should be minimized:

- Only provider domains we actually support
- No blanket permission for every site
- No background collection of unrelated browsing data

## Platform Support

Phase 1 should target:

- Google Chrome
- Arc, Edge, Brave: not in the first milestone

Reason:

- Chrome has the clearest installation story.
- Extension review, permissions, and debugging are simpler if we start with one browser.

## Provider Support Strategy

Browser bridge should be added only where it meaningfully improves the user experience.

Best fit providers:

- Xiaohongshu
- WeChat Official Account
- Possibly future login-sensitive providers

Lower priority:

- X
- Douyin

Reason:

- X and Douyin currently work anonymously through the managed Playwright sidecar.
- Browser bridge is more valuable for platforms where login state is the main obstacle.

## Error Model

FollowBar should distinguish these states clearly:

- `BRIDGE_NOT_INSTALLED`
- `EXTENSION_NOT_INSTALLED`
- `CHROME_NOT_RUNNING`
- `BRIDGE_DISCONNECTED`
- `LOGIN_REQUIRED`
- `TAB_OPEN_REQUIRED`
- `DATA_EXTRACTION_FAILED`
- `UNSUPPORTED_BROWSER`

These should map to user-readable prompts in Settings and, where useful, at the account-row level.

## Comparison With Managed Browser Mode

### Managed Browser

Pros:

- Fully controlled by FollowBar.
- Stable implementation path.
- No browser extension required.
- Easier to debug consistently.

Cons:

- Heavy download.
- Separate login flow.
- Credentials duplicated across browser contexts.

### Existing Chrome

Pros:

- Reuses the login state users already have.
- No extra browser download.
- Lower disk and runtime overhead.
- More natural for non-technical users.

Cons:

- Requires extension installation.
- More moving parts: app, daemon, extension, browser.
- More browser-specific compatibility work.
- Less deterministic than a fully managed browser.

## Recommended Rollout

### Phase 1: Design And Runtime Plumbing

- Add runtime-mode configuration to advanced providers.
- Add a placeholder bridge runtime module in Rust.
- Add provider status model for `existing_chrome`.
- No real bridge behavior yet.

### Phase 2: Single-Browser MVP

- Support Google Chrome only.
- Implement local bridge daemon plus extension handshake.
- Add WeChat browser bridge fetch.
- Keep managed browser as fallback.

### Phase 3: Xiaohongshu

- Reuse the same bridge contract for Xiaohongshu.
- Add row-level reconnect and verification handling.

### Phase 4: UX Hardening

- Add diagnostics UI:
  - extension installed
  - bridge daemon connected
  - Chrome running
  - provider tab reachable
- Add inline repair actions.

## Non-Goals

- Safari support in the first version.
- Firefox support in the first version.
- Direct reuse of the user's Chrome profile files.
- Reading browser cookies from disk in this mode.
- Replacing the managed browser mode entirely.

## Recommendation

FollowBar should keep the current managed runtime as the default and add browser bridge as an optional advanced mode for ordinary users who want to reuse their existing Chrome login state.

This gives us:

- a stable fallback we already control
- a more user-friendly path for login-heavy providers
- a cleaner security boundary than direct profile reuse

The first real implementation target should be WeChat or Xiaohongshu, because those providers benefit the most from existing-login reuse.
