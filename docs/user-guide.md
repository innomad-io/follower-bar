# FollowerBar 使用文档

完整文档已迁移到：

- [USER_GUIDE_CN.md](./USER_GUIDE_CN.md)
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
