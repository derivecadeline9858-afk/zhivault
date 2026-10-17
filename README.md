# 知藏 ZhiVault —— 把知乎装进自己口袋

> 知乎内容存档导出桌面软件：采集 → 本地 SQLite → 全文检索 / 阅读器 / 标注 / 版本历史 → 七格式导出。
> **作者：橙茶星**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6.svg)]()

## 它能做什么

- **免登录采集公开内容**：回答 / 文章 / 想法 / 问题（整问题全量）/ 收藏夹 / 专栏 / 话题 / 用户公开创作；粘贴 URL 或文件批量导入，任意多个整批启动
- **增量备份 + 断点续抓**：二次运行只抓新增与更新；中断后从游标恢复
- **独家版本历史**：内容被修改自动留旧版，任选两版本并排 diff；被删内容本地留档——**备份只存现在，存档保存历史**
- **评论树导出**：回复层级 + 赞数筛选
- **FTS5 全文检索**：中文 trigram 分词，结果高亮 + 类型/时间组合筛选
- **阅读器 + 标注**：sandbox 隔离渲染，四色高亮批注，跨版本指纹锚定
- **七格式导出**：HTML / EPUB / Markdown / TXT / DOCX / PDF / JSON（RAG 友好，JSON 存原始响应），Obsidian Vault 一键导出
- **定时监控**：cron 预设/自定义 + 运行时段 + 补跑策略，命中更新系统通知
- **AI 摘要与标签**：自带 DeepSeek / OpenAI 兼容 Key，生成记录可回溯可导出
- **图片三档**：原图 / 压缩 WebP / 无图，跨任务去重

## 安全设计（可审计）

- 凭据 Windows **DPAPI 加密落盘**，注销一键清除；日志全链路脱敏
- 更新包 **Ed25519 签名 + SHA-256 校验**，篡改必拒；更新请求零凭据
- SSRF 白名单（知乎域 + 官方更新域 + 用户显式配置的 AI 端点），壳层强制
- 导出内容内联清除脚本与事件属性；阅读器 sandbox 渲染；输出路径穿越校验
- 核心引擎 MIT 开源；便携模式单实例锁 + SQLite WAL

## 下载与安装

绿色免安装，解压即用（便携模式：数据库与配置在程序旁 `zhivault-data/`，**整目录复制即可迁移**）。

1. 从 [Releases](https://github.com/derivecadeline9858-afk/zhivault/releases) 下载 `zhivault-x.x.x-x64.zip`
2. 解压到任意目录（不要放 Program Files）
3. 运行 `zhivault.exe`

> **关于 Windows SmartScreen**：未购买代码签名证书，首次运行可能提示"Windows 已保护你的电脑"。点击"更多信息"→"仍要运行"即可。发布包附 SHA-256 哈希，可自行校验；声誉随下载量自动积累（参考 [Microsoft SmartScreen 声誉机制](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)）。

### 校验哈希（PowerShell）

```powershell
Get-FileHash zhivault-0.1.0-x64.zip -Algorithm SHA256
# 与 Releases 页面公布的哈希比对
```

## 快速上手

1. 粘贴知乎链接（回答/收藏夹/话题/用户主页……）→ 添加任务 → 开始运行
2. 书架里全文检索、阅读、划词标注
3. 导出中心勾选格式 → 出书（HTML/EPUB/Markdown/TXT/DOCX/PDF/JSON）

详细见 [docs/用户手册.md](docs/用户手册.md)。

## 合规声明

仅限个人学习存档；内置限速（默认 ≤1 req/s，不可关闭到危险值）；不触碰盐选等付费内容；不破解、不绕过知乎人机验证（触发风控自动减速并提示）。请勿将导出内容用于再分发或商业采集。

## 开发与构建

```bash
pnpm install        # 依赖（自动准备 pandoc.wasm 到 public/）
pnpm test           # vitest 单测
pnpm test:e2e       # Playwright（系统 Edge）
pnpm tauri build    # 产物在 src-tauri/target/release/
```

环境：Node ≥22 · pnpm ≥10 · Rustup(MSVC) ≥1.85 · WebView2（Win11 自带）。

## 协议与署名

- 核心引擎 MIT（见 LICENSE）；作者：**橙茶星**
- 导出产物版权页署名：HTML 页脚 / EPUB `dc:creator` 均含"橙茶星（知藏 ZhiVault 导出）"
- 第三方：pandoc-wasm（pandoc 官方 WASM 构建，GPL-2.0+，以独立进程/资源形式使用）
