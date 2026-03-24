# Repository Notes

This project currently works with three GitHub repositories:

1. `innomad-io/follower-bar`
   - public source repository
   - contains application code, CI workflow, docs, GitHub Releases, and release automation

2. `innomad-io/homebrew-tap`
   - public Homebrew tap repository
   - stores `Casks/followerbar.rb`

Release flow:

- source code is built in `innomad-io/follower-bar`
- Homebrew cask is updated in `innomad-io/homebrew-tap`

When changing release automation, keep both repositories in sync.
