# Repository Notes

This project currently works with three GitHub repositories:

1. `innomad-io/follower-bar`
   - private source repository
   - contains application code, CI workflow, docs, and release automation

2. `innomad-io/followerbar-releases`
   - public binary distribution repository
   - stores public GitHub Releases used for user downloads and Homebrew cask URLs

3. `innomad-io/homebrew-tap`
   - public Homebrew tap repository
   - stores `Casks/followerbar.rb`

Release flow:

- source code is built in `innomad-io/follower-bar`
- release assets are published to `innomad-io/followerbar-releases`
- Homebrew cask is updated in `innomad-io/homebrew-tap`

When changing release automation, keep all three repositories in sync.
