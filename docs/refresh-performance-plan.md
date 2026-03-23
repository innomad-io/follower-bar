# FollowerBar 刷新性能优化方案

本文档记录当前刷新链路的性能问题、已经实施的修复，以及后续建议的优化方向。

## 1. 问题背景

当前应用支持多个平台，且不同平台的刷新成本差异很大：

- 轻量平台
  - Bilibili
  - YouTube（公开页 / 官方 API）
  - X（官方 API）
- 中量平台
  - X（public page + sidecar）
  - Douyin（public page + sidecar）
- 重量平台
  - Xiaohongshu（browser-assisted）
  - WeChat Official Account（browser-assisted）

其中，使用 browser-assisted / Playwright sidecar 的平台刷新开销明显更高，因为一次刷新通常需要：

1. 启动 `node`
2. 启动 Playwright
3. 拉起 Chromium 或复用其上下文
4. 打开目标页面
5. 执行页面脚本并提取数据
6. 退出进程

这类平台如果和其他账号一起被全量刷新，会拖慢整个弹层交互。

## 2. 已定位的主要瓶颈

### 2.1 全量刷新是串行执行

当前后端的 `do_refresh_all` 会按账号逐个串行刷新。  
这意味着列表里只要存在一个慢账号，其后的所有账号都必须排队等待。

影响：

- 点击全局 `Refresh` 时等待时间长
- 后台定时刷新整体完成时间长
- Sidecar 平台会拖慢非 sidecar 平台

### 2.2 账号行展开时错误地触发了全量刷新

这是已经修复的关键问题。

之前的行为是：

- 用户点击某一行账号，想展开趋势图
- 前端调用的是 `refreshAll()`
- 实际触发了整张列表的全量刷新

结果：

- 用户只是看一个账号，却要等待所有账号刷新
- 如果列表里有 Xiaohongshu / WeChat 等重平台，体感会非常慢

### 2.3 Sidecar 平台每次刷新都会新起进程

当前 `advanced_runtime` 的 public/connected provider 调用会在每次抓取时：

- 新建一个 `node` 进程
- 执行 sidecar 脚本
- 结束进程

这会产生额外开销：

- 进程启动成本
- Playwright 初始化成本
- 浏览器上下文创建成本

## 3. 已经实施的优化

### 3.1 单账号展开只刷新当前账号

已实施。

现在账号行展开时不再调用 `refresh_all`，而是调用新的单账号刷新命令：

- 前端命令：`refreshAccount(accountId)`
- 后端命令：`refresh_account`

实现效果：

- 点击某个账号行展开图表时，只刷新该账号
- 不再顺手刷新整张列表
- 交互延迟显著降低

## 4. 已继续实施的优化

### 4.1 全量刷新改成“轻平台并发 + 重平台串行”

已实施。

目标：

- 轻量平台并发执行
- 重量 browser-assisted 平台继续限制并发

建议分类：

#### 轻平台，可并发

- Bilibili
- YouTube（public page / official API）
- X（official API）

#### 中量平台，低并发

- X（public page + sidecar）
- Douyin（public page + sidecar）

#### 重量平台，串行或并发数 1

- Xiaohongshu（browser-assisted）
- WeChat Official Account（browser-assisted）

建议调度策略：

- 轻平台：并发 3 到 5
- 中量平台：并发 1 到 2
- 重平台：串行

当前实现：

- 轻平台并发数：`3`
- 重平台：串行
- 当前轻平台判定：
  - `Bilibili`
  - `YouTube`
  - `X(official_api)`
- 当前重平台判定：
  - `X(public_page)`
  - `Douyin`
  - `Xiaohongshu`
  - `WeChat Official Account`

### 4.2 增加最短刷新间隔

已实施。

当前策略：

- 45 秒内不重复刷新同一账号

这样可以避免：

- 用户频繁点开/收起同一账号时重复抓取
- 手动刷新和后台刷新撞车
- 重平台无意义地重复启动 sidecar

### 4.3 浏览器型 provider 的统一冷却

已部分实施。

当前策略：

- `Xiaohongshu` 的 challenge 仍保留 30 分钟冷却
- browser-assisted 平台如果返回会话缺失/需要验证，会进入短冷却
- 当前短冷却时长：10 分钟

目的：

- 避免明知会失败的连续重试
- 避免 WeChat / Xiaohongshu 在未重新连接前持续拉起 sidecar

### 4.4 刷新中的 UI 反馈

已实施基础版。

当前前端行为：

- 全局刷新期间，footer 显示 `Refreshing accounts...`
- 刷新完成后，footer 会显示摘要：
  - `x refreshed · y skipped`
  - 如果有失败，再附加 `z failed`
- 列表数据刷新时不再强制把整个列表切回 loading 空态

## 5. 中期优化方向

### 5.1 Sidecar 常驻化

当前每次刷新都会新起 sidecar 进程。  
中期可以考虑将 sidecar 改成常驻服务：

- 启动一次
- 接收多次请求
- 长期持有 Playwright/browser context

收益：

- 降低进程启动成本
- 降低 Playwright 初始化成本
- 降低重平台的单次刷新延迟

代价：

- 架构复杂度显著上升
- 需要管理 sidecar 生命周期
- 需要做 crash recovery

因此不建议作为第一步优化。

## 6. 建议实施顺序

按优先级排序：

1. 已完成：账号行展开只刷新当前账号
2. 已完成：全量刷新改成分层并发
3. 已完成：增加抓取前最短刷新间隔
4. 已完成：补充浏览器型 provider 的冷却/跳过逻辑
5. 已完成：增加全局刷新摘要反馈
6. 中期：常驻 sidecar

## 7. 结论

当前“刷新太慢”的最直接原因，不是单个平台实现错误，而是：

- 全量刷新串行
- 账号行展开误触发全量刷新
- sidecar 平台进程级开销大

当前已经完成的修复：

- 账号行展开只刷新当前账号
- 全量刷新分层并发
- 45 秒内跳过重复刷新
- browser-assisted 平台冷却
- footer 刷新摘要

后续最值得继续做的优化：

- sidecar 常驻化
- 更细粒度的刷新进度事件
- 区分中量平台的独立并发组

这轮优化已经在不大改架构的前提下，明显减少了无意义刷新和全量等待。
