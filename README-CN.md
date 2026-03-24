# FollowerBar

FollowerBar 是一个 macOS 菜单栏应用，用来跟踪多个平台账号的粉丝数变化。

当前已支持的平台包括：

- X
- YouTube
- Bilibili
- Douyin
- Xiaohongshu
- WeChat Official Account

FollowerBar 会根据平台能力使用不同的接入方式：

- 公开页面
- 官方 API
- 浏览器辅助模式

## 安装

### Homebrew

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

### 手动安装

1. 打开本仓库的 Releases 页面
2. 下载适合你机器的 `.dmg`
3. 打开磁盘镜像
4. 将 `FollowerBar.app` 拖入 `Applications`

## 更新

```bash
brew update
brew upgrade --cask followerbar
```

如果你只想刷新这个 tap 方便测试：

```bash
brew update-reset innomad-io/tap
brew upgrade --cask followerbar
```

## 快速开始

1. 启动 `FollowerBar`
2. 点击菜单栏图标
3. 添加账号
4. 选择平台，输入 handle、URL 或平台标识
5. 如有需要，在账号编辑页配置 provider 方式
6. 刷新账号或展开查看 7 天趋势

## 平台说明

- X
  - 如果配置了 token，优先走 Official API
  - 否则回退到公开页面/浏览器辅助方式
- YouTube
  - 支持 Official API 和 Public Page
- Bilibili / Douyin
  - 主要使用公开页面
- Xiaohongshu / WeChat Official Account
  - 使用浏览器辅助模式
  - 可能需要先连接浏览器会话

## 完整使用文档

完整用户指南见：

- [docs/USER_GUIDE_CN.md](./docs/USER_GUIDE_CN.md)

## 许可证

本项目采用 GNU General Public License v3.0 或更高版本（GPL-3.0-or-later）。

如果你分发基于 FollowerBar 修改后的版本，你也必须按照 GPL 提供对应源码。
