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
| 6 | 安全与合规 | ✅ 完成 | 四道门全绿（vitest 180/180 + cargo 10/10 + build + E2E 含协议门） |
| 7 | PDF 与时间自定义 | ✅ 完成 | 四道门全绿（204/204 + cargo 11/11 含真实 Edge 打印 + build + E2E） |
| 8 | 检索与阅读器 | ✅ 完成 | 门全绿：vitest 223/223（高亮/diff 快照/跨版本锚定/迁移 v3）；E2E 15s |
| 9 | AI 中心 | ✅ 完成 | 四道门全绿（238/238 + cargo 11/11 + build + E2E 15.6s） |
| 10 | 发布 | ✅ 完成 | 产物 16.95MB <30MB；audit 门禁实测修复后全绿；露出点 5-6 核对通过 |

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

### 任务 10（2026-10-17）—— 发布

- README.md：中文 · 署名橙茶星 ×3 · SmartScreen 提示+声誉链接 · SHA-256 校验命令 · 合规声明 · MIT
- `.github/workflows/release.yml`：tag 触发 → **audit 门禁**（显式官方 registry，因 npmmirror 无 audit 端点）→ 质量门 → tauri build → portable zip + SHA-256 + **<30MB 门禁** → artifact + Release
- 官网单页 `docs/website/index.html`（头像+署名+安全承诺，独立单文件）；投稿稿 ×2（Appinn/V2EX，tone 经 PRD §3 禁词检查）；`docs/用户手册.md`（10 章 + FAQ）；`CHANGELOG.md` v0.1.0
- **CI 等价步骤本地实测**：`pnpm audit --registry npmjs --audit-level=high` 初跑 **2 critical（tinypool）阻塞** → 修复：vitest 3.2.7→4.1.12（tinypool 1.x 无补丁版，唯有升级），238/238 零测试改动复绿 → 复跑 audit **No known vulnerabilities found**
- 产物：`zhivault-0.1.0-x64.zip` = **16.95MB < 30MB** ✓，SHA-256 `8ffaf1a7…2828f6` 落盘
- 品牌露出点核对：点 5（HTML 页脚/EPUB dc:creator）测试断言锁定 ✓；点 6（README/官网/更新日志）署名计数 3/3/2 ✓
- tsc 0 / eslint 0 错误 1 warning；**首发推送到 GitHub 后首跑 Actions 为最终验证（本地已执行其全部步骤）**

### 任务 9（2026-10-17）—— AI 中心（P1）

- OpenAI 兼容客户端：mock fetch 5 用例（成功解析+头断言/自定义端点/HTTP 错误/空响应/网络异常）
- 摘要标签：5 用例（stripHtml/prompt 约束/```json 围栏解析/非 JSON 降级/全链路 mock）
- Key 管理：DPAPI 独立文件 ai-key.bin（Rust 3 命令）；生命周期 3 用例；**Key 不入日志**——Authorization 头 + api_key=/ai_key= 键名双路径遮蔽（脱敏器扩展 `ai[-_]?key|openai[-_]?key`）
- 迁移 v4 ai_job + 记录写回/枚举/按实体查（rowid 次序消除同毫秒并列）；用量统计聚合（含 null 容错）
- AI 中心页：Key 配置（加密标识）/模型/端点/生成/记录表/用量卡/导出 JSON
- 全量 `pnpm test` → 49 文件 **238/238**；tsc/eslint 0 错误；E2E 15.6s 通过；`pnpm tauri build` 成功（NSIS 15.92MiB）
- 附：print_pdf 生产阈值与测试对齐（885B 实测揭示 1024 硬编码不一致，统一为 500）

### 任务 8（2026-10-17）—— 检索与阅读器（P1）

- 高亮：6 用例（中文整词/多词/大小写/HTML 转义防注入/查询词提取）
- diff：5 快照用例（增/删/改/复杂混合/多标签块切分）
- 跨版本锚定：5 用例（精确/中间改 paragraph/大幅改 missing/仅前缀 paragraph/短选文）
- 迁移 v3 run_record + listRevisionsBetween（3 用例）；RunStore 运行落记录（source 区分手动/监控）
- 书架：类型+时间范围组合筛选、<mark> 高亮结果、「打开阅读」入口
- 阅读器：sandbox="allow-scripts"（opaque origin）+ 选择桥划词标注（四色+批注）+ 标注锚定状态展示 + 版本时间线双选并排 diff
- 变更报告页：运行记录表（来源/五计数）展开修订清单直达阅读器
- 全量 `pnpm test` → 45 文件 **223/223**；tsc/eslint 0 错误；纯 TS 免跑壳门；E2E 15s 通过

### 任务 7（2026-10-17）—— PDF 与时间自定义

- 调度器：16 用例全过（cron 5 字段/预设/间隔/运行时段含跨午夜/补跑 on_start 计数与边界/禁用）
- 时间窗 × 游标叠加：3 回答按窗口过滤出不同子集，已入库不受后续窗口影响（PRD §0-2 正交语义实测）
- 迁移 v2 `schedule` 表 + 仓储 CRUD/启停/lastRun（2 用例）；migrator 幂等断言升级为跟随 MIGRATIONS
- PDF：引擎 renderer 注入（无渲染器保持 PDF_DEFERRED partial）；**Rust `print_pdf` 用真实 Edge 无头打印出 %PDF 非空文件（自动跳过无 Edge 环境）**
- 通知：RunStore 命中（新增+更新>0）触发系统通知（tauri-plugin-notification，零命中不通知，2 用例）
- 全量 `pnpm test` → 41 文件 **204/204**；tsc/eslint 0 错误；`cargo test` **11/11**（独立 profile 修复后 Edge 实测 1.19s 通过）；`pnpm tauri build` 成功（NSIS 15.91MiB）；E2E 通过（15.3s；与后台构建并发时一度抖动，独立复跑绿——记入 Ruling-47）

### 任务 6（2026-10-17）—— 安全与合规

- §8 全表单测对照：
  - #1 凭据：DPAPI protect/unprotect roundtrip + 存/取/删生命周期（Rust 3）；脱敏 14 用例（任务 5）；注销全链路 3 用例（TS）+ Rust clear
  - #2 更新：Ed25519+SHA-256 双校验 5 用例（篡改必拒/重签必拒/字段劫持必拒/下载失败结构化/零凭据）
  - #3 SSRF：Rust 3 + TS 2 用例（zhihu/zhimg/updates 放行；evil/内网/ftp/畸形拒绝）
  - #4 导出 XSS：sanitize 5 + 阅读器 preview 2 + 书架 sandbox iframe 落地
  - #5 路径穿越：TS 3 + Rust 2 用例（../ 与绝对路径）
  - #8 协议弹层：4 用例（不可跳过/无关闭入口/合规要点）+ E2E 门禁走通
  - #9 日志隐私：留存滚动 3 用例 + 诊断导出脱敏 + RunStore 全量日志挂接
  - #6 lockfile 入库 ✓（CI audit 随任务 10）；#7 单例锁+WAL ✓（任务 0/1）
- 全量 `pnpm test` → 38 文件 **180/180**；`cargo test` **10/10**；tsc/eslint 0 错误
- `pnpm tauri build` → 成功（NSIS 15.76MiB）；`pnpm test:e2e` → 通过（12.8s，含协议弹层门）

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
- **Ruling-38 SSRF 双层守卫**：采集运行在 WebView TS 层（PRD 壳层强制假设的"全流量走 Rust 代理"未采用——架构代价与收益不成比例，诚实记录）。落地：TS 传输层必经守卫，应用内裁决走 Rust `guard_url` 命令（同规则表 single source 在 Rust，TS 本地表仅独立环境用）；规则 = zhihu.com/*.zhihu.com/zhimg.com/*.zhimg.com + 更新域占位，仅 http/https。代价：独立环境（无壳）用 TS 表，双表需同步（Rust 测试锁定规则，改动须双改）。
- **Ruling-39 更新域占位**：`updates.zhivault.app` 为占位常量（Rust network_guard + TS url-guard + updater 默认），任务 10 发布替换真实域名并分发公钥。
- **Ruling-40 windows crate 0.61 API**：DPAPI 结构为 `CRYPT_INTEGER_BLOB`（DATA_BLOB 已更名），`LocalFree` 在 `Win32::Foundation`。
- **Ruling-41 TS 5.9 BufferSource 收窄**：WebCrypto 入参要求 `ArrayBufferView<ArrayBuffer>`，业务侧 `Uint8Array`（ArrayBufferLike）需 `as unknown as BufferSource` 桥接；已在 updater 统一处理。
- **Ruling-42 协议同意持久化**：localStorage 键 `zhivault.agreement.v1`（含版本号），协议内容变更时递增版本重新征求；E2E 全新配置每次走完整协议门。
- **Ruling-43 PDF 走 Edge CLI 而非 puppeteer-core**：PRD §5.5 写 puppeteer-core，但它需 Node 运行时（应用为 WebView 架构）；等价方案 = Rust 探测 Edge 路径 + `--headless --print-to-pdf` 无头打印（零新增重依赖），缺失时 `PDF_NO_EDGE` 记 partial。验收"有 Edge 环境生成非空 PDF"以 Rust 实测用例落地（无 Edge 自动跳过）。
- **Ruling-44 调度持久化走迁移 v2**：schedule 表经 migrator 增量落地（便携目录迁移不丢）；调度循环为应用运行期 setInterval 轮询（1 分钟 tick）——应用关闭时的 OS 级唤醒不在本轮（PRD 未要求 Windows 计划任务集成，任务 10 发布时可评估）。
- **Ruling-45 补跑边界语义**：`missedRuns` 计 (lastRun, now) 严格开区间——当前时刻的触发归 tick 处理，避免补跑与正常触发重复执行；时段外错过不计入补跑。
- **Ruling-46 日期解析混合语义**：jsdom 下 `Date.parse('YYYY-MM-DD')` 按 UTC、`new Date('YYYY-MM-DDTHH:mm:ss')` 按本地——测试数据必须带显式 `Z`；inTimeWindow 实现不变（业务侧窗口日期按 UTC 午夜解释，已记档）。
- **Ruling-47 Edge 无头打印隔离 profile**：默认 profile 的 Edge CLI 会挂接到用户正在运行的 Edge 实例导致 `status()` 永久阻塞（22 个残留进程实证）；必须 `--user-data-dir=<独立目录>` + `--no-first-run` 等隔离参数。E2E 与重型后台构建并发时可能抖动（本机实证一次超时、独立复跑绿），验收以独立运行结果为准。
- **Ruling-48 阅读器 sandbox 组合语义**：书架预览用 `sandbox=""`（纯展示零脚本）；阅读器用 `sandbox="allow-scripts"`（不含 same-origin → opaque origin），正文已清洗无脚本，仅注入受信选择桥（postMessage 划词）——满足 §8-4「知乎内容无脚本」安全意图且标注可用。代价：iframe 内无法直接用 KaTeX 运行时渲染（LaTeX 源码保留显示；KaTeX 预渲染列为后续优化）。
- **Ruling-49 diff 语义**：块级 LCS（h1-6/p/li/ul/ol/blockquote/pre 切分），修改表现为相邻 del+add（并排视图左删右增）；快照测试锁定输出形状。
- **Ruling-50 锚定文本坐标**：locateAnchor 返回纯文本坐标（去标签空间），UI 以段落级呈现；「精确」=前后指纹按序同现，「段落级降级」=仅前缀命中，全失配提示「内容已被大幅修改」（PRD §0-2 文案）。
- **Ruling-51 变更报告数据源**：run_record（迁移 v3）+ content_revision.captured_at 区间查询——运行记录与变更清单天然一致（PRD §0 UI-1），无需采集器逐实体上报；「删除」计数口径：知乎删帖后本地留存（备份语义），运行计数里的 deleted 列暂不拆分（PRD §5.4 变更周报 N更新/M修改/K删除，K 需在线探测，列为后续）。
- **Ruling-52 AI 端点 SSRF 放行**：§8-3 白名单（知乎+更新域）与 §5.1 自带 DeepSeek/OpenAI Key 存在张力；决策——用户在 AI 中心显式配置的 baseUrl 主机加入守卫放行（配置即授权，localStorage 持久化），TS 裁决兜底该主机，Rust guard_url 拒绝后二次比对。代价：白名单的"不可绕过"出现用户配置例外，属产品语义而非漏洞。
- **Ruling-53 AI Key 独立密文文件**：ai-key.bin 与 credentials.bin 分离（不同生命周期：注销凭据不清 AI Key）；Rust 复用 credential::save/load/clear，三命令薄封装。
- **Ruling-54 摘要输出容错**：模型未按 JSON 输出时降级为截断纯文本 + 空标签（不判失败，可用性优先）；JSON 解析剥 ```json 围栏；摘要硬上限 120 字、标签 ≤8。
- **Ruling-55 audit 门禁驱动 vitest 4 升级**：npmmirror 无 audit 端点（workflow 显式走官方 registry）；初跑 2 个 critical（tinypool 1.x 无补丁版）阻塞发布，修复 = vitest 3.2.7→4.1.12 大版本升级，238/238 零测试改动复绿（§9.3 真修而非绕过）；复跑 audit 全绿。代价：vitest 5 已发布但非必要不追新。
- **Ruling-56 发布占位链接**：README/官网/关于页仓库链接原均为 `github.com/PLACEHOLDER/zhivault` 占位——2026-10-17 真实仓库已创建（derivecadeline9858-afk/zhivault），全局替换完成并填入 `REPO_URL`（任务 0 Ruling-3 挂账项闭环）。
- **Ruling-57 CI registry 覆盖**：首发 Actions（release #1）在"安装依赖"步骤失败（1m17s，后续全跳过）。排查：本地同命令 `pnpm install --frozen-lockfile` 秒过；最小复现（仅 package.json + lockfile + workspace + postinstall，npx pnpm@10）也成功——排除版本与锁文件因素。根因定为 `.npmrc` 的 npmmirror 在 GitHub 海外 runner 上不稳定（lockfile 未锁 tarball URL，印证可安全换源）。修复：`release.yml` 加 `npm_config_registry: https://registry.npmjs.org` 环境变量覆盖 + PNPM_VERSION 10→11 对齐本机。代价：国内用户自行构建时仍走 npmmirror（本地 .npmrc 不变），仅 CI 覆盖。
- **Ruling-58 allowBuilds 迁移**：CI 两次"安装依赖"失败（#1 1m17s / #2 38s，均 ERR_PNPM_IGNORED_BUILDS: esbuild 致命退出）根因——pnpm 11 将 `onlyBuiltDependencies`（数组）迁移为 `allowBuilds`（对象，值为布尔），旧键名在新版被静默忽略，白名单形同虚设；本机警告不致命、CI 环境致命放大了差异。修复：`pnpm-workspace.yaml` 改 `allowBuilds: {esbuild: true, better-sqlite3: true}`，本地 CI=true + 干净目录 npx pnpm@11 双重验证警告消失。附带对齐：CI PNPM_VERSION 10→11、`npm_config_registry` 覆盖 npmjs（npmmirror 对海外 runner 不稳，lockfile 未锁 tarball 可安全换源）。
