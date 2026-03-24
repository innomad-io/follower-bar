# GitHub Release and Homebrew Tap

This repository is configured for tag-based macOS releases and Homebrew cask updates.

Current distribution layout:

- source code repository: `innomad-io/follower-bar` (public)
- Homebrew tap repository: `innomad-io/homebrew-tap`

## Release flow

1. Bump versions if needed:
   - [package.json](/Users/innomad/lab/innomad-io/follower-bar/package.json)
   - [src-tauri/tauri.conf.json](/Users/innomad/lab/innomad-io/follower-bar/src-tauri/tauri.conf.json)
   - [src-tauri/Cargo.toml](/Users/innomad/lab/innomad-io/follower-bar/src-tauri/Cargo.toml)
2. Create and push a tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

3. GitHub Actions will:
   - build Intel and Apple Silicon macOS bundles
   - publish the binaries to this repository's GitHub Releases
   - upload DMG artifacts
   - update the Homebrew tap cask

Workflow file:
- [/.github/workflows/release.yml](/Users/innomad/lab/innomad-io/follower-bar/.github/workflows/release.yml)

Tap update script:
- [/scripts/update-homebrew-cask.mjs](/Users/innomad/lab/innomad-io/follower-bar/scripts/update-homebrew-cask.mjs)

## Required GitHub secrets

- `HOMEBREW_TAP_TOKEN`
  - A GitHub token that can push to the tap repository.

### How to create `HOMEBREW_TAP_TOKEN`

Recommended: create a fine-grained personal access token.

1. Open GitHub:
   - `Settings`
   - `Developer settings`
   - `Personal access tokens`
   - `Fine-grained tokens`
   - `Generate new token`
2. Token owner:
   - select the account or organization that owns the tap repository
3. Repository access:
   - `Only select repositories`
   - select your tap repository, for example `innomad-io/homebrew-tap`
4. Repository permissions:
   - `Contents: Read and write`
   - this is the only required permission for the current workflow
5. Create the token and copy it once.
6. In this app repository, open:
   - `Settings`
   - `Secrets and variables`
   - `Actions`
   - `New repository secret`
7. Create:
   - Name: `HOMEBREW_TAP_TOKEN`
   - Secret: paste the token value

Classic PAT also works, but fine-grained PAT is the cleaner choice.

Optional for signed and notarized macOS builds:

- `APPLE_CERTIFICATE`
  - base64-encoded `.p12` Developer ID Application certificate
- `APPLE_CERTIFICATE_PASSWORD`
  - password for the exported `.p12`
- `KEYCHAIN_PASSWORD`
  - temporary keychain password used during CI signing
- `APPLE_ID`
  - Apple account email used for notarization
- `APPLE_PASSWORD`
  - Apple app-specific password used for notarization
- `APPLE_TEAM_ID`
  - Apple Developer Team ID

The workflow can build without these Apple secrets, but macOS may flag downloaded apps as damaged or untrusted. With these secrets configured, the Tauri build step can sign and notarize the app during release builds.

If the Apple signing secrets are missing, the release workflow now automatically falls back to an unsigned build instead of failing.

## Expected tap repository

Default tap repository in the workflow:

```text
innomad-io/homebrew-tap
```

If you use another tap, update `HOMEBREW_TAP_REPOSITORY` in:
- [/.github/workflows/release.yml](/Users/innomad/lab/innomad-io/follower-bar/.github/workflows/release.yml)

## Tap repository structure

If the tap repository does not exist yet, create:

```text
innomad-io/homebrew-tap
```

The workflow will write:

```text
Casks/followerbar.rb
```

You do not need to create the cask file manually if the repository already exists and the token can push to it.

## Homebrew install

After the release job updates the tap, users can install with:

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

Or in one line:

```bash
brew install --cask innomad-io/tap/followerbar
```
