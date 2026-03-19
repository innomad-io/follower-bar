# FollowBar Design Spec

Mac menubar 应用，用于实时追踪社交媒体账号粉丝数。面向个人创作者，支持多平台、里程碑提醒、本地运行无需服务器。

## 目标用户

个人创作者，需要随时查看自己各平台粉丝变化，并在达到关键数字时收到通知。

## 核心功能

1. **Menubar 图标** — 点击弹出面板，展示各平台粉丝数
2. **多平台支持** — 初期支持 X、YouTube、Bilibili、小红书、微信公众号、抖音，架构可扩展
3. **粉丝趋势** — 记录历史数据，展示今日增减和 7 日迷你趋势图
4. **里程碑提醒** — 达到预设整数关卡时发送 macOS 原生通知
5. **自定义刷新** — 用户可配置抓取间隔

## 架构

```
┌─────────────────────────────────────┐
│           Tauri App                 │
│                                     │
│  ┌───────────┐    ┌──────────────┐  │
│  │  Tray Icon│───▶│  React UI    │  │
│  └───────────┘    └──────┬───────┘  │
│                          │ IPC      │
│  ┌───────────────────────▼───────┐  │
│  │       Rust Core               │  │
│  │                               │  │
│  │  Scheduler ─▶ ProviderManager │  │
│  │                 │             │  │
│  │        ┌────────┼────────┐    │  │
│  │        X   YT  Bili ... │    │  │
│  │        └────────┴────────┘    │  │
│  │                               │  │
│  │  SQLite    Notification       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 模块职责

- **Tray Icon** — menubar 图标入口，点击弹出/关闭面板
- **React UI** — 弹出面板，展示总览、趋势、设置三个视图
- **ProviderManager** — 管理所有 Provider 实例，统一调度抓取
- **Scheduler** — 按用户配置的间隔定时触发抓取任务
- **SQLite** — 本地持久化账号配置、粉丝快照、里程碑记录
- **Notification** — 里程碑检测与 macOS 原生通知推送

## Provider 接口

每个平台实现统一的 Provider trait：

```rust
trait Provider {
    fn id(&self) -> &str;           // "x", "youtube", "bilibili"
    fn name(&self) -> &str;         // 显示名称
    fn icon(&self) -> &str;         // 平台图标标识
    fn fetch(&self, username: &str) -> Result<FollowerData>;
    fn validate_username(&self, username: &str) -> Result<bool>;
}

struct FollowerData {
    followers: u64,
    fetched_at: DateTime<Utc>,
    extra: Option<HashMap<String, String>>,
}
```

### 初期 Provider（第一批：稳定 API）

| Provider | 数据源 | 认证方式 |
|----------|--------|----------|
| X (Twitter) | 官方 API v2 | API Key |
| YouTube | Data API v3 | API Key |
| Bilibili | 公开 API (`api.bilibili.com/x/relation/stat`) | 无需 |

### 第二批 Provider（网页抓取，需额外研究）

| Provider | 数据源 | 难度与风险 |
|----------|--------|-----------|
| 小红书 | 网页抓取 | 高 — 页面 JS 动态渲染，有反爬签名机制，需逆向移动端 API 或使用无头浏览器，接口可能频繁变动 |
| 抖音 | 网页抓取 | 高 — 同上，有设备指纹检测，需研究具体可行的抓取端点 |
| 微信公众号 | 官方开发者 API | 中 — 需要用户是公众号管理员，且公众号需通过企业认证才能获取 AppID/Secret。用户需在公众号后台配置 IP 白名单。设置引导需详细说明 |

第二批 Provider 在架构中预留接口，实现时根据逆向研究结果确定具体方案。如果某平台抓取不可行，跳过并在 UI 中标记为"暂不支持"。

### 扩展方式

新增平台只需实现 `Provider` trait 并注册到 `ProviderManager`。未来可支持用户通过配置文件定义简单的 HTTP + JSON Path 抓取规则，无需写 Rust 代码。

## 数据存储

使用 SQLite 本地存储，三张核心表：

API Key 和 Secret 等敏感凭据通过 macOS Keychain 存储（使用 `security` CLI 或 `keyring` crate），不存入 SQLite。`accounts.config` 仅存放非敏感配置项。

```sql
-- 平台账号配置
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    username TEXT NOT NULL,
    config TEXT,              -- JSON, 非敏感配置项（Keychain 存凭据）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 粉丝数快照
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    followers INTEGER NOT NULL,
    extra TEXT,               -- JSON, 附加数据
    fetched_at DATETIME NOT NULL
);

-- 里程碑记录
CREATE TABLE milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    target INTEGER NOT NULL,
    reached_at DATETIME,
    notified BOOLEAN NOT NULL DEFAULT 0
);
```

### 数据保留策略

- 最近 7 天：保留每次抓取的原始数据
- 7 天以上：每天只保留一条（当日最后一次抓取）
- 清理时机：每次应用启动时执行一次清理

## 里程碑逻辑

- 预设关卡序列：`100, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000`
- 每次抓取后检测：`上次粉丝数 < 关卡 <= 当前粉丝数` → 触发通知
- 已触发的里程碑记录到 `milestones` 表，不重复通知
- 粉丝数下降不触发通知

## UI 设计

### 弹出面板 — 总览视图（默认）

```
┌──────────────────────────────┐
│  FollowBar           ⚙️ 设置 │
├──────────────────────────────┤
│                              │
│  𝕏  @username        1,234  │
│     ──────────── ↑12 今日     │
│                              │
│  ▶️  channel          3,456  │
│     ──────────── ↑28 今日     │
│                              │
│  📺  username        12,345  │
│     ──────────── ↓3  今日     │
│                              │
│  📕  username           892  │
│     ──────────── ↑5  今日     │
│                              │
├──────────────────────────────┤
│  上次更新: 2 分钟前    🔄 刷新  │
└──────────────────────────────┘
```

- 每行：平台图标、用户名、粉丝数、今日增减
- 点击某行展开 7 日趋势迷你图
- 底部显示上次更新时间和手动刷新按钮

### 设置视图

- 添加/删除平台账号
- 配置 API Key（X、YouTube 等需要的平台）
- 自定义刷新间隔（分钟级）
- 里程碑提醒开关
- 开机自启动开关

### 通知样式

使用 macOS 原生通知中心：

> "🎉 你的 YouTube 频道粉丝突破 10,000！"

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Tauri v2 |
| 前端 | React + TypeScript |
| 样式 | Tailwind CSS |
| 图表 | recharts |
| 后端 | Rust |
| HTTP | reqwest |
| 数据库 | SQLite (rusqlite) |
| 通知 | tauri-plugin-notification |

## 项目结构

```
followbar/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── providers/
│   │   │   ├── mod.rs          # Provider trait + Manager
│   │   │   ├── x.rs
│   │   │   ├── youtube.rs
│   │   │   ├── bilibili.rs
│   │   │   ├── xiaohongshu.rs
│   │   │   ├── wechat.rs
│   │   │   └── douyin.rs
│   │   ├── scheduler.rs
│   │   ├── db.rs
│   │   ├── milestone.rs
│   │   └── commands.rs         # Tauri IPC 命令
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── AccountList.tsx
│   │   ├── AccountRow.tsx
│   │   ├── MiniChart.tsx
│   │   └── Settings.tsx
│   ├── hooks/
│   │   └── useAccounts.ts
│   └── main.tsx
├── package.json
└── README.md
```

## 非目标（不在初期范围）

- 多账号同平台管理（MCN 场景）
- 粉丝增长预测
- 数据导出
- 跨设备同步
- Windows/Linux 支持（Tauri 天然跨平台，但初期只关注 macOS）
