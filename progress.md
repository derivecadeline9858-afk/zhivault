# 知藏 ZhiVault 任务看板与执行日志

> 按 PRD §9.1–9.4 维护：任务状态一行 + 验收记录 + 自主决策记录（Ruling）。
> 计划文件：`../产品方案-知藏-知乎内容存档工具.md`（v2.0）。PRD 第 9 章契约优先于通用流程约定，看板落本文件（而非临时目录）。

## 任务状态（0–10）

| 任务 | 内容 | 状态 | 验收结论 |
|---|---|---|---|
| 0 | 脚手架与品牌 | ✅ 完成 | 四道门全绿；zip 3.24MB；启动 0.18s；品牌露出点 1-4 截图核对通过 |
| 1 | 数据层 | ✅ 完成 | 四道门全绿；store 测试 34 新增全过（合计 51/51）；build 成功 |
| 2 | 采集内核 | ⚪ 未开始 | |
| 3 | 采集器与执行器 | ⚪ 未开始 | |
| 4 | 导出引擎 | ⚪ 未开始 | |
| 5 | GUI（P0 页面） | ⚪ 未开始 | |
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
