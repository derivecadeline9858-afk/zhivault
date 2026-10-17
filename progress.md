# 知藏 ZhiVault 任务看板与执行日志

> 按 PRD §9.1–9.4 维护：任务状态一行 + 验收记录 + 自主决策记录（Ruling）。
> 计划文件：`../产品方案-知藏-知乎内容存档工具.md`（v2.0）。PRD 第 9 章契约优先于通用流程约定，看板落本文件（而非临时目录）。

## 任务状态（0–10）

| 任务 | 内容 | 状态 | 验收结论 |
|---|---|---|---|
| 0 | 脚手架与品牌 | ✅ 完成 | 四道门全绿；zip 3.24MB；启动 0.18s；品牌露出点 1-4 截图核对通过 |
| 1 | 数据层 | ✅ 完成 | 四道门全绿；store 测试 34 新增全过（合计 51/51）；build 成功 |
| 2 | 采集内核 | ✅ 完成 | 四道门全绿；fetch 测试 29 新增全过（合计 80/80）；build 成功 |
| 3 | 采集器与执行器 | ✅ 完成 | tsc/eslint 0 错误；vitest 118/118（新增 38）；纯 TS 无壳改动 |
| 4 | 导出引擎 | ✅ 完成 | 四道门全绿；导出测试 22 新增全过（合计 140/140）；build 成功 |
| 5 | GUI（P0 页面） | ✅ 完成 | 四道门全绿 + E2E 12s 通过（含 pandoc ✅）；品牌露出点复核；zip 16.7MB |
| 6 | 安全与合规 | ⚪ 未开始 | |
| 7 | PDF 与时间自定义 | ⚪ 未开始 | |
| 8 | 检索与阅读器 | ⚪ 未开始 | |
| 9 | AI 中心 | ⚪ 未开始 | |
| 10 | 发布 | ⚪ 未开始 | |

## 环境基线（§9.1 自检）

- Node v24.22.0 / npm 11.19.1 / pnpm 11.28.6 —— 满足（≥22 / ≥10）
- WebView2 Runtime 155.0.4283.45 —— 满足
- Python 3.13.7 + Pillow 11.3.0 —— 品牌资产派生可用
- Rustup(MSVC) / VS2022 BuildTools(C++) —— 任务 0 开工时 winget 后台安装中
- 品牌资产 `assets/avatar.png` 641×641 RGBA —— 存在，无 blocker

## 验收记录

（每任务：验收命令 → 输出摘要 → 时间）

### 任务 1（2026-10-17）—— 数据层

- `pnpm vitest run tests/store`（先写后实现）→ RED：5 文件全败（模块不存在），确认失败原因正确
- 实现后 `pnpm test` → 9 文件 **51/51**（新增 store 34：实体 CRUD 13 / 版本 6 / FTS 7 / 标注+游标 5 / 迁移器 3）
- `pnpm tsc` → 0 错误（修复 plugin-sql v2.6 `select` API 误用）
- `pnpm eslint` → 0 错误 1 warning（任务 0 已记录的上游约定）
- `cargo test` → 2/2 通过（tauri-plugin-sql 编入）
- `pnpm tauri build` → 成功（release 53.65s，NSIS 3.62MiB，tauri-plugin-sql 编入）
- 终态复跑：`pnpm test` 51/51、`tsc` 0 错误

### 任务 5（2026-10-17）—— GUI（P0 页面）

- 新增单测：log-redact 14（含敏感键值/URL 参数/多处置脱敏）、run-store 5（状态机/去重/失败隔离/脱敏出口/订阅）、列表查询 2 → 全量 **161/161**
- `pnpm test:e2e`（Playwright + 系统 Edge）→ **1 passed (11.6s)**：粘贴 URL → 类型识别 chips → 添加任务 → 演示模式运行（五联计数+脱敏日志流）→ 导出中心（epub 勾选）→ 报告 html/epub/json ✅ + markdown/docx ❌ partial_success 语义可见
- `pnpm tauri build` → 成功（NSIS 15.75MiB；exe 26MB（资产压缩嵌入），便携 zip 实测 **16.7MB < 30MB**——Ruling-36 的旁置 scheme 方案经实测不需要）
- 品牌露出点复核（新构建 PrintWindow）：点 1 窗口图标 ✓、点 2 splash ✓（头像+知藏 ZhiVault+作者：橙茶星）；点 3/4 组件未改动沿用任务 0 证据

### 任务 4（2026-10-17）—— 导出引擎

- RED：`tests/export` 8 文件全败 → 实现后 **22/22**（pandoc 用例为真实 pandoc-wasm 集成）
- 全量 `pnpm test` → 29 文件 **140/140**
- `pnpm tsc` → 0 错误（修 paths 正则、epub 未用参数、PandocQueue 校验职责）
- `pnpm eslint` → 0 错误 1 warning
- `pnpm build`（vite）→ 通过；pandoc-wasm 懒加载块暂未入包（导出模块未被入口引用，任务 5 接线后随动态 import 产出）
- `pnpm tauri build` → 成功（NSIS 3.64MiB）
- 验收映射：单书格式（六格式成功 + PDF partial）✓；Obsidian vault golden test ✓（文件树+内容逐字比对）；partial 语义 ✓；路径穿越 ✓；EPUB mimetype 首条 stored + dc:creator 署名 ✓；pandoc 串行队列 + 空输出判败 + files 二进制回传 ✓

### 任务 3（2026-10-17）—— 采集器与执行器

- RED：`tests/zhihu` 7 文件全败（模块不存在）→ 实现后 **38/38**
- 全量 `pnpm test` → 21 文件 **118/118**（累计）
- `pnpm tsc` → 0 错误（修 CollectorTarget 收窄、rawJson 类型、未用参数等）
- `pnpm eslint` → 0 错误 1 warning（上游约定）
- 壳无改动 → 按 §9.4-4 免跑 tauri build；cargo test 沿用任务 2 的 2/2
- 验收映射：mock API 全类型端到端 ✓（8 类目标+搜索，真实 :memory: 库）；评论树层级+赞数筛选 ✓；二次增量产生版本记录 ✓（revision 递增/旧版留存/幂等不变）；并发下总速率不超额 ✓（真实令牌桶+虚拟时钟定时器调度，相邻请求间隔 ≥1000ms）；断点续抓 ✓（游标 capture_meta，恢复后 offset=1 续页）

### 任务 2（2026-10-17）—— 采集内核

- RED：`tests/fetch` 5 文件全败（模块不存在）→ 实现后 **29/29**
- `pnpm test` 全量 → 14 文件 **80/80**（任务 0/1/2 累计）
- `pnpm tsc` → 0 错误（修 evalFn 短路、constants 再导出、getState mock 缺 burst、unknown 断言四处）
- `pnpm eslint` → 0 错误 1 warning（上游约定）
- `cargo test` → 2/2（新增 `eval_in_webview` 命令编译通过）
- `pnpm tauri build` → 成功（release 28.71s，NSIS 3.64MiB；capability ACL 编译期校验通过）

### 任务 0（2026-10-16）

- `pnpm tsc` → 0 错误（修复 theme.test.ts 未用导入 vi 后）
- `pnpm eslint` → 0 错误 1 warning（button.tsx 导出 buttonVariants 属 shadcn 上游约定，见 Ruling-9）
- `pnpm test`（vitest）→ 4 文件 17/17 通过（branding 3 / theme 9 / ipc 2 / splash 3）
- `pnpm build`（vite）→ 1702 模块，产物正常（index.js 221.8KB / css 14.5KB / 头像资产内联）
- `cargo test` → 2/2 通过（data_dir_lives_beside_exe / data_dir_parent_is_exe_dir），0 warning
- `pnpm tauri build` → 成功（release 78s）；zhivault.exe 9.6MB；NSIS 安装包 2.60MiB
- **验收：zip <30MB** → Compress-Archive 出 `zhivault-0.1.0-x64.zip` = **3.24MB** ✓
- **验收：启动 <2s** → 进程启动到主窗口可见 = **0.18s**（PowerShell Stopwatch 实测）✓
- **验收：品牌露出点**（截图核对）：
  - 点 1 窗口/任务栏图标 ✓（标题栏显示头像图标；icons 全套由 avatar 派生）
  - 点 2 splash ✓（PrintWindow 逐帧捕获 f3：头像 + 知藏 ZhiVault + 作者：橙茶星，见 Ruling-10）
  - 点 3 设置页底栏 ✓（头像 + 知藏 v0.1.0 · 作者：橙茶星；数据目录回显 exe 旁 zhivault-data 真实路径）
  - 点 4 关于页 ✓（头像 + 署名 + slogan + v0.1.0）
- 终态复跑四道门：tsc 0 错误 / eslint 0 错误 1 warning / vitest 17/17 / cargo test 2/2 全绿

## 自主决策记录（Ruling）

（每条：现象 → 决策 → 理由 → 如果错了的代价）

- **Ruling-1 看板位置**：PRD §9.1 指定 `zhivault/progress.md`，优先于通用流程默认的 `.superpowers/sdd/` 临时工作区。代价：多计划并行时会混在一个文件，用章节分隔缓解。
- **Ruling-2 git 身份**：本机无全局 git user.name/email，用仓库本地身份 `橙茶星 <zhivault@local>`。代价：提交归属为本地伪邮箱，发布前可改。
- **Ruling-3 仓库链接占位**：PRD §3 要求关于页含开源仓库链接但未给 URL；`REPO_URL` 常量留空、链接不渲染，任务 10 填真实地址。代价：关于页暂少一个链接。
- **Ruling-4 pnpm 11 设置迁移**：`onlyBuiltDependencies` 落 `pnpm-workspace.yaml`（package.json `pnpm` 字段已被 pnpm 11 忽略并告警，已移除）；esbuild postinstall 被忽略但平台二进制经 optionalDependencies 分发，功能验证通过。代价：install 输出保留一条 warning 噪音。
- **Ruling-5 eslint-plugin-react-hooks 5.2 导出名**：flat config 为 `configs.recommended`（无 `configs.flat.*`）。
- **Ruling-6 @eslint/js 显式声明**：pnpm 严格隔离下 eslint.config.js 不能 import 传递依赖，已加入 devDependencies。
- **Ruling-7 bundle targets=["nsis"]**：`all` 会额外产出 msi；任务 0 验收只要 zip，任务 10 再定发布矩阵。窗口 1200×800/最小 960×640（§6.2 信息密度参考 VS Code）。
- **Ruling-8 删除 android/ios 图标目录**：桌面-only 产品，`tauri icon` 自动生成的移动端产物删除。
- **Ruling-9 button.tsx 的 react-refresh warning 保留**：导出 `buttonVariants` 是 shadcn/ui 上游约定写法，fast refresh 仅对该文件不生效，可接受。
- **Ruling-10 splash 验收方法**：KimiCU 截图 snapshot id 不含内容维度且单实例聚焦会拍到旧实例，导致误判"splash 未显示"；改用 PowerShell + PrintWindow(PW_RENDERFULLCONTENT) 100ms 逐帧捕获，证实 splash 正常（白屏 0.1-0.3s → splash 0.4-1.3s → 主界面 1.4s+）。产品无缺陷，验收方法记入台账。代价：无产品影响；后续 UI 截图核对优先 PrintWindow 帧序列。
- **Ruling-11 驱动抽象（双驱动共用仓储）**：PRD §7.1 存储给 `tauri-plugin-sql / better-sqlite3` 二选一未落定；决策为仓储面向最小 `SqlExecutor` 接口（run/all/get），生产 = plugin-sql（WAL、便携绝对路径），测试 = better-sqlite3(:memory:)；DDL 单一来源 `schema.sql`，迁移器按分号切句逐条执行（无过程体，切分安全）。代价：两驱动事务语义差异需集成期复核；真实运行验证落在任务 5（首个 DB 使用方）。
- **Ruling-12 FTS5 中文 = trigram**：内置 trigram 分词器（SQLite 3.53 实测可用），中文按三元组索引、查询 ≥3 字，短查询抛错由 UI 兜底；question 不进 FTS（PRD §7.3 明确挂 answer/article/pin/comment）。代价：二字词不可检，任务 8 视验收反馈再定补救。
- **Ruling-13 版本历史挂 5 表**：answer/article/pin/comment/question 进 content_revision；collection/topic/author/activity 不进版本。PRD §5.4 列举"回答/文章/想法/评论通用"，question 纳入属合理扩展（diff 对问题同样成立）。代价：若产品收窄为多存版本也无害。
- **Ruling-14 实体行不存 content_hash**：比对读 content_revision 最新行 hash，保持 §7.3 通用字段纯粹。代价：每次 save 一次索引查询，可忽略。
- **Ruling-15 plugin-sql v2.6 API**：实例查询方法为 `select`（`load` 是静态工厂）；`sqlite:` 绝对路径直传 Rust（相对路径才落到 App 目录）。运行时验证延至任务 5。代价：若绝对路径不被接受，需 Rust 侧补命令——已在本条留证。
- **Ruling-16 better-sqlite3 白名单**：加入 `pnpm-workspace.yaml` onlyBuiltDependencies，13.0.3 预编译二进制直装可用（SQLite 3.53.4）。
- **Ruling-17 签名 eval 走 Rust 命令**：`@tauri-apps/api` 2.x 未暴露 `WebviewWindow.eval`（全包无此 API）；决策：JS 侧创建隐藏窗口（`core:webview:allow-create-webview-window`），eval 经自建命令 `eval_in_webview(label, js)`（Rust `WebviewWindow::eval`），signature-bridge 窗口加入 capability windows 白名单。代价：多一次 IPC；签名脚本入口 `window.__zhivault_sign_entry__` 需在真实知乎页面校准（任务 3 联调/运行时）。
- **Ruling-18 风控文案识别**：正则特征（风控/安全验证/系统检测异常/操作过于频繁），命中即 RISK_CONTROL + 退避 0.2 req/s（PRD §7.4-2）；429 同理。真实文案样例在联调期补充进测试。代价：误伤含这些词的正常正文概率低，且仅触发降速不阻断。
- **Ruling-19 内核可注入边界**：传输层（生产 axios 适配）与签名桥均为构造注入；验收按 PRD 用 mock 签名桥覆盖限速/退避/缓存/错误码（29 用例）。axios 传输层属网络边界不做单测，联调期覆盖。
- **Ruling-20 URL 实体口径**：PRD §10-3 写"7 类实体"，§5.1 P0 清单列 8 类（含用户活动）；按 §5.1 实现 8 类目标解析 + 评论树/搜索两个独立采集器，"七类采集器"理解为内容类采集器口径。代价：无。
- **Ruling-21 Fetcher 契约**：采集器经 `fetcher.fetchJson(url, {params})` 取数（生产 = kernel 绑定会话 d_c0）；测试替身必须用 `urlWithParams` 把 params 拼进 URL 以模拟生产 kernel——直接用裸 URL 路由会丢 order_by/offset/q 等参数（本任务 3 处测试 bug 根因）。
- **Ruling-22 统计语义**：`fetched` = API 条目数（含被时间窗/赞数过滤项），created/updated/unchanged = 实体保存结果（store SaveResult）；author/collection 等无版本表不计保存状态。activity 等非版本实体用 getActivity 预查区分 created/updated。代价：fetched 与入库数不同属预期（运行视图五联计数口径）。
- **Ruling-23 虚拟时钟测试陷阱**：sleep 内直接推进全局时钟会让"后续首个 acquire"读到推进后的时间而重复消费同一时段令牌（假 0 间隔）；必须定时器队列 + 微任务排干（1000 跳）+ 最早到期推进的迷你调度器。只影响测试设施，产品代码无碍。
- **Ruling-24 图片池生产接线延后**：`ImageDownloader`/`exists` 为注入边界（下载经传输层、exists 查图片池目录）；生产 fs 下载器依赖 fs 插件 scope，随任务 5 GUI 接线（PRD §7.1 壳 FS 权限）。代价：图片本地化端到端在任务 5 后可用。
- **Ruling-25 API 端点为契约常量**：所有 v4 端点/参数名为 mock 契约（`API_V4` 常量集中），真实联调（任务 3 后段/任务 5）按线上响应校准 include 字段与分页字段。
- **Ruling-26 任务 4 范围 = 六格式 + Obsidian + 标注集**：PRD §10-4 验收写"单书七格式"，但 §10-7 明确 PDF（Edge 无头打印）属任务 7；决策本任务 PDF 一律 `PDF_DEFERRED` partial（engine 留注入位，任务 7 注册 renderer）。代价：无。
- **Ruling-27 导出 HTML 零脚本**：PRD §10-4"HTML 渲染（代码高亮/KaTeX/清除脚本）"与安全要求（§8-4 导出无脚本）并存；决策导出文件内嵌零 `<script>`（CDN CSS 美化），KaTeX/highlight.js 渲染仅发生在应用内阅读器，导出文件离线可读。代价：导出 HTML 中高亮/公式为原文形态，阅读器内才有增强渲染。
- **Ruling-28 pandoc-wasm 集成方式**：58MB wasm（gzip 16MB）按需动态 import（首次转换才加载）；测试用真实 pandoc-wasm 但 `@vitest-environment node`（jsdom 的 Blob 缺 arrayBuffer，pandoc-wasm addFile 会崩）；校验职责在 PandocQueue（任何 runner 空输出都判 EXPORT_EMPTY_OUTPUT）。包内无 .d.ts → 自建 `src/types/pandoc-wasm.d.ts` 环境声明。
- **Ruling-29 ExportSink 边界**：引擎经 `ExportSink`（writeText/writeBinary/exists）落盘，MemorySink 测试；生产 fs 实现随任务 5（依赖 fs 插件 scope）。markdown 的 images/→assets/ 改写与 referencedAssets 清单由引擎产出，资产物理搬运归导出中心。
- **Ruling-30 清洗器为正则实现**：sanitizeHtml 覆盖 script/on*/javascript: 三类（§8-4 验证样本），非完整 HTML 解析器；任务 6 安全专项如需更强保障可换解析器实现（接口不变）。
- **Ruling-31 进度事件与 Tauri 事件**：任务 5 采集在 WebView TS 层执行，进度用前端订阅总线（run-store）；PRD 所说"Tauri 事件推进度"在任务 7 后台监控（Rust 定时器唤醒）接入壳事件通道。代价：窗口最小化时 WebView 节流可能影响长时间任务，任务 7 一并解决。
- **Ruling-32 浏览器演示模式**：无 Tauri 时 RunStore 用 BrowserDemoStore（StoreLike 内存实现，采集器最小仓储面已抽象）+ 演示 fetcher；导出中心落盘降级为内存 Sink 并在报告标注。E2E 由此可跑通全链路。代价：演示数据不计入真实库。
- **Ruling-33 pandoc-wasm 浏览器加载**：pandoc-wasm browser 入口 `import('./pandoc.wasm')` 期望 webpack 式 URL 导出，vite dev/build 默认不认 → 浏览器内 pandoc 系格式失败（错误如实入报告，partial 语义 E2E 顺带验证）。打包期方案（vite wasm 插件或自管 wasm URL）列任务 10；应用内单测已用真实 pandoc-wasm 覆盖转换正确性。代价：应用内 MD/DOCX 导出在任务 10 前不可用。
- **Ruling-34 MVP 书源**：导出书源 = 全部合并 + 按类型分书（回答/文章/想法/问题）；任务级分书需任务→实体映射表，随任务 8 变更报告/书架一并扩展。代价：暂时不能"按任务合并成书"。
- **Ruling-35 登录态 MVP**：Cookie 仅存内存（关闭即清），DPAPI 加密落盘 + 注销全链路属任务 6；匿名 d_c0 自动获取同任务 6。扫码登录入口灰显（需知乎网页端配合，Cookie 粘贴先行）。
- **Ruling-36 pandoc.wasm 落地方式（修订 Ruling-33）**：vite 预检插件把依赖内裸 `import('./pandoc.wasm')` 改写为指向 `/pandoc.wasm` 的 URL 导出；wasm 经 `public/` 进 dist（postinstall 自动从依赖复制，58MB 二进制不入库 .gitignore）。dev 与生产构建均验证可用，E2E 的 markdown ✅。嵌入后 exe 26MB / 便携 zip 16.7MB（资产压缩嵌入），<30MB 目标保持——原旁置 scheme 预案撤销。
- **Ruling-37 StoreLike 抽象**：采集器仓储面抽象为 StoreLike（unknown 参数 + 方法双变体兼容），浏览器演示模式用 BrowserDemoStore 内存实现，应用内就绪后 RunStore.setStore 切换真实便携库。代价：StoreLike 参数为 unknown，调用点类型安全靠 ContentStore 真实路径保障。
