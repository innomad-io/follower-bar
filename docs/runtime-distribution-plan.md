# Runtime 分发方案

本文说明 FollowerBar 对 runtime 依赖平台的分发方案，目标是解决发布版在用户机器上无法直接执行 sidecar 的问题。

当前依赖 runtime 的平台包括：

- X（`public_page`）
- Douyin
- Threads
- Instagram
- 知乎
- Xiaohongshu
- 微信公众号

## 1. 问题

当前 sidecar 采用 Node + Playwright。

开发环境没有问题：

- 本机有 `node`
- 依赖通过 `pnpm` 安装

发布环境存在两个现实问题：

1. 不能要求普通用户自己安装 `pnpm`
2. 不能默认要求普通用户自己安装 Node.js

已经修掉的一点是：

- 发布版不再在用户机器上执行 `pnpm install`

但仍然存在一个缺口：

- sidecar 启动和 Playwright 浏览器安装仍然依赖 `node`

所以发布版当前并不真正自包含。

## 2. 目标

目标很明确：

- 用户点击 `Install Runtime` 后，runtime 可以在干净 macOS 环境中完成安装
- 不要求用户手动安装 `pnpm`
- 不强制要求用户手动安装 Node.js
- 保持现有 Node + Playwright sidecar 架构，避免一次性重写 provider 逻辑

## 3. 推荐方案

推荐方案是：

1. 优先使用系统 Node
2. 系统 Node 不可用或版本不符合要求时，按需下载内置 Node
3. Chromium 继续按需下载
4. sidecar 继续保持 Node + Playwright

这是当前风险最低的路线。

原因：

- 对现有代码改动最小
- Playwright 兼容性最好
- 主安装包不需要直接塞入完整 Node runtime
- 普通用户最终不需要自己装 Node

## 4. 运行时选择顺序

runtime 解析顺序定义如下：

1. 已下载的内置 Node
2. 系统 `node`
3. 下载内置 Node，然后使用内置 Node

也可以做成“先探测系统 Node，再下载”的用户体验，但最终运行时决策仍应满足：

- 优先使用可控版本
- 不接受低版本或不兼容版本

日志中应明确记录运行时来源：

- `embedded`
- `system`

## 5. 系统 Node 探测规则

探测方式：

- 执行 `node --version`

系统 Node 只有在满足以下条件时才可用：

- `node` 在 `PATH` 中可执行
- 版本不低于最低要求

建议最低版本：

- `>= 22`

如果系统 Node 不满足要求：

- 直接忽略
- 进入内置 Node 下载流程

这样做的原因：

- 避免老版本 Node 和 Playwright 产生兼容性问题
- 避免用户机器上的杂乱 Node 环境干扰 runtime

## 6. 内置 Node 下载方案

### 6.1 下载时机

不要随主安装包一起分发 Node。

Node 应按需下载，触发条件包括：

- 用户点击 `Install Runtime`
- 首次启用依赖 runtime 的 provider

### 6.2 下载目录

建议存放在：

`~/Library/Application Support/io.innomad.followbar/advanced-runtime/node/`

目录结构建议：

```text
advanced-runtime/
  node/
    darwin-arm64/
      bin/node
    darwin-x64/
      bin/node
  browsers/
  profiles/
  logs/
  manifest.json
```

### 6.3 完整性校验

每个 Node runtime 产物都必须校验：

- 版本号
- SHA-256

如果校验失败：

- 删除该下载产物
- 返回安装失败
- 在日志中写明原因

## 7. sidecar 启动规则

一旦 runtime 解析完成：

- 所有 sidecar 入口都应使用“解析后的 Node 路径”
- 不再直接写死系统 `node`

daemon 启动命令应变为：

```text
<resolved-node> <bundled-sidecar-entry> --daemon
```

浏览器安装命令应变为：

```text
<resolved-node> <playwright-cli.js> install chromium
```

## 8. UI 要求

UI 需要把 runtime 状态说清楚。

建议显式展示：

- 使用系统 Node
- 已下载本地 runtime
- 需要下载 runtime

可以使用的状态文案：

- `Using system Node`
- `Downloaded local runtime`
- `Runtime not installed`

这能减少用户对“为什么还要安装”的困惑，也方便排查问题。

## 9. 日志要求

运行时相关日志至少要记录：

- runtime 来源：`system` / `embedded`
- Node 版本
- 浏览器安装路径
- sidecar 启动命令
- 失败原因

日志继续写入现有目录：

`advanced-runtime/logs/`

## 10. 体积判断

Node runtime 自身就接近百 MB 量级，Chromium 体积更大。

所以不建议：

- 把 Node 和 Chromium 全部直接塞进主安装包

建议：

- 主安装包只带应用本体和 sidecar 资源
- Node 按需下载
- Chromium 按需下载

这能保持首次安装包相对可控。

## 11. Bun 的完整方案

Bun 不是“把 `node` 命令换成 `bun`”这么简单。

如果要彻底使用 Bun，目标应该是：

- sidecar 编译成自包含可执行文件
- 用户机器不需要 Node
- app 只需要分发 Bun 编译后的 sidecar + Chromium

### 11.1 Bun 能解决什么

如果 Bun sidecar 编译成功并稳定运行，可以解决：

- 用户机器无 Node 环境的问题
- sidecar 启动链更简洁
- runtime 分发更像传统桌面应用

### 11.2 Bun 不能自动解决什么

Bun 不会自动解决以下问题：

- Playwright 与 Bun 的兼容性
- 浏览器安装流程
- provider 进程管理
- 浏览器资源路径
- sidecar daemon 生命周期

真正的高风险点不是 JS 运行时，而是：

- Playwright
- 运行时安装流程
- 资源分发路径

### 11.3 Bun 的两种落地方式

#### 方案 A：Bun 仅作为 sidecar 自包含运行时

做法：

- 用 Bun compile 生成 sidecar binary
- 保留现有 Playwright 资源
- 浏览器仍按需下载

优点：

- 用户不需要 Node
- 分发体验更好

风险：

- Playwright 兼容细节可能比较多

#### 方案 B：Bun + sidecar 安装链彻底重构

做法：

- sidecar、浏览器安装、资源定位全部围绕 Bun 设计

优点：

- 体系更干净

风险：

- 工程量明显更大
- 出问题时排查成本高

### 11.4 Bun 的定位

Bun 适合作为第二阶段实验，不适合作为当前发布问题的首选修复。

推荐顺序：

1. 先把 Node 方案做稳定
2. 确保普通用户无需手动装 Node
3. 再单独验证 Bun + Playwright 的真实兼容性
4. 验证通过后再考虑替换 Node 方案

## 12. 实施阶段

### 第一阶段

实现：

- 系统 Node 探测
- 内置 Node 下载
- runtime 来源选择
- 用解析后的 Node 启动 daemon
- 用解析后的 Node 安装 Chromium

保持不变：

- provider 逻辑
- daemon 协议
- browser profile 模型

### 第二阶段

实验：

- Bun compile sidecar
- 自包含 sidecar 分发

### 第三阶段

如果 Bun 方案验证稳定：

- 让生产环境默认改用 Bun sidecar
- Node 方案保留为回退路径，或逐步移除

## 13. 结论

当前推荐方案不是直接迁到 Bun。

当前推荐方案是：

- 系统 Node 可用就用系统 Node
- 系统 Node 不可用或版本不符时，下载内置 Node
- 继续保留 Node + Playwright sidecar
- Chromium 继续按需下载

这条路线最稳，能先解决发布版无法正常安装 runtime 的核心问题。

Bun 方案应当保留，但作为第二阶段实验，而不是当前阻塞问题的直接修复。
