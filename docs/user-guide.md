# FollowerBar 使用文档

FollowerBar 是一个 macOS 菜单栏应用，用来跟踪多个平台账号的粉丝数变化。  
支持的平台和接入方式会根据平台能力不同而不同，例如：

- 公开页面抓取
- 官方 API
- 浏览器辅助模式（browser-assisted）

本文档面向最终用户，默认你不需要了解代码仓库或开发细节。

## 1. 安装

### 1.1 使用 Homebrew 安装

首次安装：

```bash
brew tap innomad-io/tap
brew install --cask followerbar
```

更新到最新版本：

```bash
brew update && brew upgrade --cask followerbar
```

如果你只想更新这个 tap 再安装或升级：

```bash
brew update-reset innomad-io/tap
brew install --cask followerbar
```

或：

```bash
brew update-reset innomad-io/tap
brew upgrade --cask followerbar
```

### 1.2 手动安装

你也可以从发布页下载 `.dmg` 手动安装：

1. 打开 `FollowerBar` 的发布页
2. 下载适合你机器架构的 `.dmg`
3. 打开 `.dmg`
4. 将 `FollowerBar.app` 拖到 `Applications`

### 1.3 关于 macOS “damaged” 或打不开

如果当前版本还没有经过 Apple Developer 签名和公证，macOS 可能会拦截打开。  
这不是应用内容损坏，而是 Gatekeeper 的安全策略。

你可以用以下方式临时放行：

```bash
xattr -dr com.apple.quarantine /Applications/FollowerBar.app
```

或者：

1. 在 Finder 中找到 `FollowerBar.app`
2. 右键点击
3. 选择“打开”
4. 在系统弹窗中确认

## 2. 启动与基础使用

### 2.1 启动应用

启动后，FollowerBar 会出现在 macOS 菜单栏中。  
点击菜单栏图标，会打开主弹层。

主弹层包含：

- 已添加账号列表
- 每个账号的当前粉丝数
- 当日变化量
- 最近更新时间
- 刷新按钮

### 2.2 主弹层交互

- 点击账号整行：
  - 展开该账号的 7 天趋势图
  - 同时触发该账号刷新
- 点击账号右侧的小按钮：
  - 打开账号编辑页

### 2.3 全局设置

全局设置只包含真正全局的项，例如：

- 刷新间隔
- 通知
- 开机启动
- 语言 / i18n

平台特定的凭据和连接方式不在全局设置中，而是在对应账号的编辑页中配置。

## 3. 添加账号

### 3.1 添加流程

添加账号时，应用会要求你：

1. 选择平台
2. 输入账号标识、主页链接或 handle
3. 如果平台支持多种 provider，会在后续编辑页中进一步配置

### 3.2 各平台推荐输入方式

#### X

推荐输入：

- `@username`
- `x.com/username`
- `twitter.com/username`

#### YouTube

推荐输入：

- `@handle`
- `youtube.com/@handle`
- `youtube.com/channel/UC...`

#### Bilibili

推荐输入：

- UID
- `https://space.bilibili.com/...`

#### Douyin

推荐输入：

- 完整用户主页链接
- 用户标识（如 `MS4w...`）

#### Xiaohongshu

推荐输入：

- 完整用户主页链接
- 用户 ID

#### WeChat Official Account

公众号模式不是“查询任意公众号”，而是读取当前已连接后台所属公众号的数据。  
账号名称更像是你在 FollowerBar 里给这个数据源起的显示名称。

## 4. 平台接入方式说明

FollowerBar 目前有三类 provider 方法：

### 4.1 Public Page

含义：

- 不依赖 API 凭据
- 直接读取公开页面中展示的数据

优点：

- 配置最少
- 适合普通用户

缺点：

- 页面结构变化时可能失效
- 平台可能风控

常见平台：

- X
- Douyin
- Bilibili
- YouTube（无 API key 时）

### 4.2 Official API

含义：

- 使用平台官方 API
- 通常需要 token / key

优点：

- 数据更稳定
- 结构化响应更容易处理

缺点：

- 需要凭据
- 可能有速率限制、权限限制、费用限制

当前典型场景：

- X：Bearer Token
- YouTube：API Key

### 4.3 Browser-assisted

含义：

- 使用独立浏览器 runtime 或持久化浏览器会话
- 适合登录后后台页面或公开页面反爬较强的平台

优点：

- 可覆盖 API 不易接入的平台
- 可复用登录态

缺点：

- 首次连接成本更高
- 登录态会过期
- 对性能影响大于纯 API

当前典型场景：

- Xiaohongshu
- WeChat Official Account

## 5. 账号编辑页

点击账号右侧的小按钮可进入编辑页。

编辑页通常包含以下几块：

### 5.1 Basic Info

- Display Name
- Account Identifier / URL

你可以在这里修改：

- 在应用内显示的账号名称
- 平台账号标识、URL、handle

### 5.2 Connection & Provider

这里用于选择该账号使用的 provider 方法。

例如：

- X：
  - Public Page
  - Official API
- YouTube：
  - Public Page
  - Official API
- Xiaohongshu：
  - Browser-assisted
- WeChat Official Account：
  - Browser-assisted

### 5.3 Provider Actions

这里会显示和当前 provider 方法有关的操作。

常见动作包括：

- 保存 API token
- 安装 runtime
- 连接浏览器
- 在浏览器中验证
- 重新连接

### 5.4 Remove Account

删除账号会：

- 从 FollowerBar 中移除该账号
- 删除该账号在本地存储的历史粉丝数据

## 6. 平台具体使用说明

### 6.1 X

#### 方式 A：Public Page

适合：

- 普通用户
- 没有 X API token

行为：

- FollowerBar 通过浏览器辅助方式匿名访问公开页面
- 如果页面公开可见，会提取昵称和粉丝数

#### 方式 B：Official API

适合：

- 你已有 X Bearer Token
- 想用更稳定的官方接口

配置步骤：

1. 打开账号编辑页
2. 选择 `Official API`
3. 填写 Bearer Token
4. 保存

如果没有配置 token，建议改回 `Public Page`。

### 6.2 YouTube

#### 方式 A：Public Page

适合：

- 只需要公开可见粉丝数据

#### 方式 B：Official API

适合：

- 你已有 YouTube / Google API key

### 6.3 Bilibili

通常走公开页面或公开接口路径，不需要额外登录。

### 6.4 Douyin

当前通过匿名浏览器访问公开用户页抓取：

- 昵称
- 抖音号
- 粉丝数

如果抖音页面触发风控，可能会导致刷新失败。

### 6.5 Xiaohongshu

小红书一般需要 browser-assisted 模式。

使用步骤：

1. 在设置或账号编辑页中安装 runtime
2. 点击 `Connect`
3. 弹出浏览器窗口
4. 登录小红书
5. 等待连接成功

如果刷新时遇到风控：

- 账号行会提示需要验证
- 点击 `Verify`
- 打开浏览器手动验证

### 6.6 WeChat Official Account

公众号当前使用 browser-assisted 模式。

使用步骤：

1. 安装 runtime
2. 点击 `Connect`
3. 打开公众号后台登录页
4. 用微信扫码
5. 选择并进入你的公众号后台

注意：

- 这里读取的是当前登录后台所属公众号的数据
- 不是查询任意公众号的公开资料

## 7. 数据刷新与趋势图

### 7.1 刷新方式

刷新可以来自：

- 你手动点击 `Refresh`
- 点击某个账号行触发该账号刷新
- 后台定时刷新

### 7.2 趋势图

展开账号后会看到 7 天趋势图：

- 固定显示 7 个时间槽
- 每天一个 bar
- 缺失日会用最近一次已知数据补齐

### 7.3 Today 变化量

`today` 是相对“系统时区下当天起点”的变化。  
FollowerBar 会跟随你当前系统时区来计算每日变化。

## 8. 语言设置

你可以在全局设置中调整语言 / i18n。

这是全局设置，会影响：

- 菜单栏弹层文案
- 设置页文案
- 编辑页文案

## 9. 更新应用

### 9.1 Homebrew 用户

更新方式：

```bash
brew update && brew upgrade --cask followerbar
```

如果只想更新这个 tap：

```bash
brew update-reset innomad-io/tap
brew upgrade --cask followerbar
```

### 9.2 手动安装用户

重新从发布页下载新版本 `.dmg`，覆盖安装即可。

## 10. 卸载

### 10.1 Homebrew 安装用户

```bash
brew uninstall --cask followerbar
```

### 10.2 手动安装用户

删除：

- `/Applications/FollowerBar.app`

如果你还想清理本地缓存和浏览器辅助 runtime，可以再删除应用数据目录。  
通常位于：

```text
~/Library/Application Support/io.innomad.followbar
```

## 11. 常见问题

### 11.1 应用提示 damaged

原因：

- 当前版本未经过 Apple Developer 签名和公证

处理：

```bash
xattr -dr com.apple.quarantine /Applications/FollowerBar.app
```

### 11.2 某个平台刷新失败

优先检查：

1. 输入的账号标识是否正确
2. provider 方法是否适合该平台
3. 是否需要 API token
4. 是否需要 browser-assisted 登录
5. 平台是否触发了风控

### 11.3 Xiaohongshu / WeChat 提示需要重新连接

原因通常是：

- 浏览器会话失效
- 登录过期
- 平台风控

处理：

- 打开账号编辑页
- 执行 `Connect` 或 `Verify`

### 11.4 X 或 YouTube 没填 token 能不能用

可以，但前提是该账号的公开页面仍可匿名读取到粉丝数据。  
如果公开页面路径失效，建议切回官方 API 模式。

### 11.5 为什么有些平台更慢

因为 browser-assisted 模式本质上会启动浏览器页面抓取，资源开销明显大于纯 API。

## 12. 发布与下载地址

如果你是通过 Homebrew 安装，推荐优先使用 Homebrew 更新。  
如果你是手动安装，请使用公开发布仓库中的版本文件。
