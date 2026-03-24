# FollowerBar 使用指南

FollowerBar 是一个 macOS 菜单栏应用，用来跟踪多个平台账号的粉丝数变化。

根据不同平台能力，FollowerBar 会使用不同的接入方式：

- 公开页面（App 会访问未登录状态下的公开页面获取数据）
- 官方 API（如果有官方 API，App 会使用官方接口获取数据）
- 浏览器辅助模式（针对需要登录或保护较强的平台，App 会启动一个微型浏览器，你需要进行手工登录）

## 1. 安装

### 1.1 使用 Homebrew 安装

首次安装：

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

后续升级：

```bash
brew update
brew upgrade --cask followerbar
```

### 1.2 手动安装

1. 打开本仓库的 Releases 页面
2. 下载适合你机器的 `.dmg`
3. 打开磁盘镜像
4. 将 `FollowerBar.app` 拖到 `Applications`

### 1.3 如果 macOS 提示应用已损坏

如果应用还没有经过 Apple 的签名和公证，macOS 可能会阻止打开。

临时处理方式：

```bash
xattr -dr com.apple.quarantine /Applications/FollowerBar.app
```

或者：

1. 在 Finder 中找到 `FollowerBar.app`
2. 右键点击
3. 选择“打开”
4. 在系统弹窗中确认

## 2. 基本使用

### 2.1 启动

启动后，FollowerBar 会出现在 macOS 菜单栏中。

点击菜单栏图标即可打开弹层。

主弹层会显示：

- 已跟踪账号
- 当前粉丝数
- 今日变化
- 最近更新时间
- 刷新按钮

### 2.2 首页列表交互

- 点击账号行：
  - 展开该账号
  - 显示 7 天趋势图
  - 只刷新当前账号
- 使用展开后的操作区：
  - 编辑账号
  - 在需要时验证浏览器辅助连接
  - 手动刷新当前账号

### 2.3 设置

全局设置只保留真正全局的内容：

- 刷新频率
- 通知
- 登录时启动
- 语言
- 查看日志

平台相关配置应在账号编辑页中完成。

## 3. 添加账号

### 3.1 流程

添加账号时：

1. 选择平台
2. 输入 handle、URL 或平台标识
3. 继续
4. 如有需要，在账号编辑页中配置 provider 方式

### 3.2 各平台推荐输入方式

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

- 完整公开用户主页链接
- 用户标识，例如 `MS4w...`

#### Xiaohongshu

- 完整主页链接
- 用户 ID

#### 微信公众号

这里不是查询任意公开公众号。
它会读取当前已连接的公众号后台会话对应的数据。

你在 FollowerBar 里填写的名称，更像是这个数据源的本地显示名称。

## 4. Provider 模式

### 4.1 Public Page

含义：

- 不需要 API 凭据
- 直接读取公开页面数据

优点：

- 配置简单
- 适合大多数普通用户

缺点：

- 平台页面结构变化时可能失效
- 可能触发反爬或风控

常见平台：

- X
- Douyin
- Bilibili
- YouTube（未配置 API Key 时）

### 4.2 Official API

含义：

- 使用平台官方 API 凭据

优点：

- 数据结构化
- 一般更稳定

缺点：

- 需要 token 或 API Key
- 可能有配额、权限或价格限制

典型场景：

- X Bearer Token
- YouTube API Key

### 4.3 Browser-assisted

含义：

- 使用受控浏览器会话
- 适合后台页面或保护较强的平台

优点：

- 可覆盖不适合直接用 API 的平台
- 可复用已登录会话

缺点：

- 比 API 模式更重
- 浏览器会话可能过期
- 首次接入成本更高

典型平台：

- Xiaohongshu
- 微信公众号

## 5. 编辑账号

通过账号展开区的操作按钮进入编辑页。

编辑页包含：

### 5.1 基本信息

- 显示名称
- 账号标识或 URL

### 5.2 连接与 Provider

选择该账号可用的 provider 方法。

例如：

- X：
  - Public Page
  - Official API
- YouTube：
  - Public Page
  - Official API
- Xiaohongshu：
  - Browser-assisted
- 微信公众号：
  - Browser-assisted

### 5.3 Provider 操作

根据平台和模式不同，可能会看到：

- 保存 Bearer Token
- 保存 API Key
- 安装 runtime
- 连接浏览器
- 在浏览器中验证

### 5.4 删除账号

删除账号会移除：

- 当前账号条目
- 这个账号在本地保存的历史快照

## 6. 平台说明

### 6.1 X

- 如果配置了 Bearer Token，优先走 Official API
- 没有 token 时，会回退到公开页面 / 浏览器辅助方式

### 6.2 YouTube

- 如果配置了 API Key，优先走 Official API
- 否则可使用公开页面方式

### 6.3 Bilibili

- 主要通过公开页面或公开数据源获取
- 推荐输入 UID 或主页链接

### 6.4 Douyin

- 主要通过公开用户页面获取
- 推荐输入完整主页链接

### 6.5 Xiaohongshu

- 推荐使用浏览器辅助模式
- 可能需要连接或验证浏览器会话
- 如果平台触发验证，可在账号展开区使用验证按钮

> 小红书具有较强的风控，请谨慎使用，如需使用，推荐登录小号

### 6.6 微信公众号

- 使用浏览器辅助模式
- 需要在公众号后台登录
- FollowerBar 会从后台页面读取公众号名称和总用户数

## 7. 刷新行为

- 展开账号行只刷新当前账号
- 全局刷新会按平台类型做调度
- 浏览器辅助平台在挑战或会话异常后可能进入冷却
- 图表显示 7 天趋势

## 8. 日志与排错

通过 `设置 -> 查看日志` 可以打开刷新日志。

常见问题包括：

- 浏览器辅助会话缺失
- 需要验证
- 平台页面解析失败
- API 凭据无效

如果某个平台持续失败：

1. 打开设置或账号编辑页
2. 检查 provider 方式
3. 如有需要重新连接浏览器
4. 再次刷新

## 9. 语言

FollowerBar 支持在设置里切换界面语言。

当前支持：

- English
- 简体中文

## 10. 卸载

如果通过 Homebrew 安装：

```bash
brew uninstall --cask followerbar
```

你还可以手动删除：

- `~/Library/Application Support/io.innomad.followbar`
- `~/Library/Preferences/io.innomad.followbar.plist`
