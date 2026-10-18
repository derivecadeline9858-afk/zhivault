use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

use crate::AppState;

/// 知乎代理窗口的 document-start 主世界运行器（Ruling-61/62）：
/// WebView2 ExecuteScript 运行在隔离世界（访问不到页面 JS 全局与 __TAURI_INTERNALS__），
/// 故经 initialization_script 在主世界装轮询器；Rust 侧以隔离 eval 写 data-zv-job 属性派单，
/// 运行器在主世界完成签名（运行时互操作知乎 webpack 模块）+ fetch，经 __TAURI_INTERNALS__.invoke 回传。
const ZHIHU_RUNNER_JS: &str = r#"
(function () {
  if (window.__zvRunner) return;
  window.__zvRunner = true;
  // 隐藏 WebView2 标记：知乎前端指纹（snaker/瑞数）会探测 window.chrome.webview 并将会话标记为异常（40362）。
  // Tauri IPC 的 init 脚本先于本脚本运行、已捕获 postMessage 引用，此处对页面脚本隐藏不影响回传通道。
  try {
    if (window.chrome && window.chrome.webview) {
      Object.defineProperty(window.chrome, 'webview', { get: function () { return undefined; }, configurable: true });
    }
  } catch (e) {}
  // 捕获知乎自家请求完整请求头（对比"被接受请求"与"40362 请求"的差异，诊断反爬触发点）
  var __cap = [];
  (function () {
    function capPush(u, h) {
      try {
        u = String(u);
        if (u.indexOf('zhihu.com') !== -1 && u.indexOf('/api/') !== -1 && __cap.length < 40) {
          __cap.push({ url: u.slice(0, 160), h: h || {} });
          if (__cap.length === 10) {
            report({ seq: 0, ok: true, status: 0, body: 'CAP:' + JSON.stringify(__cap) });
          }
        }
      } catch (e) {}
    }
    var _open = XMLHttpRequest.prototype.open;
    var _setH = XMLHttpRequest.prototype.setRequestHeader;
    var _send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; this.__h = {}; return _open.apply(this, arguments); };
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { this.__h[k] = v; } catch (e) {} return _setH.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { capPush(this.__u, this.__h); return _send.apply(this, arguments); };
    var _fetch = window.fetch;
    window.fetch = function (input, init) {
      capPush(typeof input === 'string' ? input : (input && input.url) || '', init && init.headers);
      return _fetch.apply(this, arguments);
    };
  })();
  var MODULES = { headers: 93823, encryptor: 1514, transforms: 18543, prefix: 62845, md5: 10261 };
  var CHUNK = 'webpackChunkheifetz';
  // x-zst-81：知乎客户端静态常量（2026-10-18 从自家请求头捕获；发送时必须同值参与签名源串）
  var XZST81 = '3_2.0VhnTj77m-qofgh3TxTnq2_Qq2LYuDhV80wSL7iUZQ6nxELYqm4fBJCHMiqHPD4S1hCS974e1DrNPAQLYlUefii7q26fp2L2ZKgSfnveCgrNOQwXTt_Fq6DQye8t9DGwT9RFZQAuTLbHP2GomybO1VhRTQ6kp-XxmxgNK-GNTjTkxkhkKh0PhHix_F0kfIComgUxCXBL1eee8hrxqHBH9TUo0bqo1oX2GNqo1Lqc0t9p8SwVf0uC1FH_zCqVxqBVKDvOLqJgGncfVPvwm8ee8XhcmCUFVECcLDgOZgUXYJcPfo_O91R38suemLGeKUwtLp4wY0q9KBDoVwBHYM4xm3qSB9GNOqg38YwVMQANLQXYs';
  function report(p) {
    var t = window.__TAURI_INTERNALS__;
    if (t && typeof t.invoke === 'function') {
      t.invoke('zhivault_proxy_result', { payload: p }).catch(function () {});
    }
  }
  // 安装信标（seq=0 无监听方，仅落诊断日志；用于区分"运行器未装"与"回传不通"）
  report({ seq: 0, ok: true, status: 0, body: 'runner-installed:internals=' + (window.__TAURI_INTERNALS__ ? typeof window.__TAURI_INTERNALS__.invoke : 'missing') });
  function getSigner() {
    if (window.__zvSigner) return window.__zvSigner;
    var g = window[CHUNK];
    if (!g) throw new Error('SIGNATURE_UNAVAILABLE: chunk global missing');
    var req = null;
    g.push([[Math.random()], {}, function (r) { req = r; }]);
    var h = req(MODULES.headers), enc = req(MODULES.encryptor), tr = req(MODULES.transforms),
        pf = req(MODULES.prefix), md5m = req(MODULES.md5);
    var md5 = md5m.default || md5m.a || md5m;
    if (typeof md5 !== 'function' || typeof enc.ZP !== 'function' || typeof tr.mR !== 'function') {
      throw new Error('SIGNATURE_UNAVAILABLE: signer shape changed');
    }
    window.__zvSigner = { h: h, enc: enc, tr: tr, pf: pf, md5: md5 };
    return window.__zvSigner;
  }
  async function run(job) {
    if (job.type === 'probe') {
      return { ok: true, status: 0, body: 'ready:' + document.readyState + ':dc0=' + (document.cookie.indexOf('d_c0=') !== -1 ? '1' : '0') + ':ua=' + navigator.userAgent.slice(0, 40) };
    }
    if (job.type === 'capture') {
      return { ok: true, status: 0, body: 'capture:' + JSON.stringify(__cap.slice(0, 10)) };
    }
    var S = getSigner();
    var zse93 = S.h.$8(S.h.HN.Web, S.enc.XL, '101')[0];
    var parts = [zse93, S.tr.mR(job.url), S.tr.rA()];
    if (job.body !== undefined && job.body !== null) {
      var bw = S.tr.Wn(job.body);
      if (S.tr.kA(bw)) parts.push(bw);
    }
    parts.push(XZST81);
    var source = parts.filter(Boolean).join('+');
    var sig = S.enc.ZP(S.md5(source));
    var headers = {
      accept: '*/*',
      referer: 'https://www.zhihu.com/',
      'x-requested-with': 'fetch',
      'x-zse-93': zse93,
      'x-zse-96': S.pf.F + '_' + sig,
      'x-zst-81': XZST81,
    };
    if (job.method === 'POST') {
      var xsrf = /(?:^|;\s*)_xsrf=([^;]+)/.exec(document.cookie);
      if (xsrf) headers['x-xsrftoken'] = xsrf[1];
    }
    if (job.body !== undefined && job.body !== null) headers['content-type'] = 'application/json';
    var init = { method: job.method || 'GET', credentials: 'include', headers: headers };
    if (job.body !== undefined && job.body !== null) init.body = job.body;
    // WAF 40362 为概率性判定：带退避重试（每次重算签名；最多 4 次尝试）
    var res = null;
    var text = '';
    for (var attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise(function (r) { setTimeout(r, 2500 + attempt * 1500); });
        parts = [zse93, S.tr.mR(job.url), S.tr.rA()];
        if (job.body !== undefined && job.body !== null) {
          var bw2 = S.tr.Wn(job.body);
          if (S.tr.kA(bw2)) parts.push(bw2);
        }
        parts.push(XZST81);
        headers['x-zse-96'] = S.pf.F + '_' + S.enc.ZP(S.md5(parts.filter(Boolean).join('+')));
        init.headers = headers;
      }
      res = await fetch(job.url, init);
      text = await res.text();
      if (res.status !== 403 || text.indexOf('40362') === -1) break;
    }
    return { ok: true, status: res.status, body: text };
  }
  setInterval(function () {
    var el = document.documentElement;
    var raw = el.getAttribute('data-zv-job');
    if (!raw) return;
    el.removeAttribute('data-zv-job');
    var job;
    try { job = JSON.parse(raw); } catch (e) { return; }
    run(job).then(function (r) {
      report({ seq: job.seq, ok: r.ok, status: r.status, body: r.body });
    }).catch(function (e) {
      report({ seq: job.seq, ok: false, error: String((e && e.message) || e) });
    });
  }, 150);
})();
"#;

/// 诊断落盘（真实验收期定位链路问题；稳定期仅错误路径调用）
#[tauri::command]
pub fn diag_log(msg: String, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppState>() {
        let guard = state.data_dir.lock().unwrap_or_else(|e| e.into_inner());
        let _ = std::fs::create_dir_all(guard.join("log"));
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(guard.join("log").join("proxy-eval.log"))
        {
            use std::io::Write as _;
            let _ = writeln!(f, "[{}] diag: {}", chrono_now(), msg.chars().take(400).collect::<String>());
        }
    }
    Ok(())
}

/// 创建隐藏知乎代理窗口（Rust 侧 WebviewWindowBuilder，注入主世界运行器）
#[tauri::command]
pub async fn create_zhihu_proxy_window(label: String, url: String, app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }
    let parsed = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    // UA 覆写为真实 Chrome（与 WebView2 Runtime 155 同源版本号，避免客户端指纹被判异常 40362）
    const CHROME_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
    tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(parsed))
        .initialization_script(ZHIHU_RUNNER_JS)
        .user_agent(CHROME_UA)
        .visible(false)
        .inner_size(1.0, 1.0)
        .focused(false)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 知乎代理回传载荷（页面经 __TAURI_INTERNALS__.invoke 直报，Rust 转主窗口事件；
/// 不依赖远程页 __TAURI__.event 插件注入——实测远程页该模块可能缺失）
#[derive(Serialize, Deserialize, Clone)]
pub struct ProxyResultPayload {
    pub seq: u64,
    pub ok: bool,
    #[serde(default)]
    pub status: Option<u32>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

#[tauri::command]
pub fn zhivault_proxy_result(app: tauri::AppHandle, payload: ProxyResultPayload) -> Result<(), String> {
    if let Some(state) = app.try_state::<AppState>() {
        let guard = state.data_dir.lock().unwrap_or_else(|e| e.into_inner());
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(guard.join("log").join("proxy-eval.log"))
        {
            use std::io::Write as _;
            let _ = writeln!(
                f,
                "[{}] result seq={} ok={} status={:?} err={:?} body={}",
                chrono_now(),
                payload.seq,
                payload.ok,
                payload.status,
                payload.error,
                payload.body.as_deref().unwrap_or("").chars().take(2000).collect::<String>()
            );
        }
    }
    app.emit_to("main", "zhivault:proxy-result", payload)
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub author: &'static str,
}

/// 便携数据目录：exe 旁 ./zhivault-data/（PRD §7.1，整目录复制即迁移）
pub fn resolve_data_dir(exe_dir: &Path) -> PathBuf {
    exe_dir.join("zhivault-data")
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "知藏 ZhiVault",
        version: env!("CARGO_PKG_VERSION"),
        author: "橙茶星",
    }
}

#[tauri::command]
pub fn get_data_dir(state: State<'_, AppState>) -> String {
    let guard = state.data_dir.lock().unwrap_or_else(|e| e.into_inner());
    guard.to_string_lossy().into_owned()
}

/// 在指定 webview 窗口中执行 JS（签名桥 eval 通道，PRD §7.4-1）
#[tauri::command]
pub async fn eval_in_webview(label: String, js: String, app: tauri::AppHandle) -> Result<(), String> {
    // 诊断落盘（真实验收期定位注入链路问题；稳定后可降级）
    if let Some(dir) = app.try_state::<AppState>() {
        let guard = dir.data_dir.lock().unwrap_or_else(|e| e.into_inner());
        let _ = std::fs::create_dir_all(guard.join("log"));
        let _ = std::fs::write(
            guard.join("log").join("proxy-eval.log"),
            format!("[{}] label={label} js={}\n", chrono_now(), js.chars().take(80).collect::<String>()),
        );
    }
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("webview 窗口不存在：{label}"))?;
    win.eval(&js).map_err(|e| e.to_string())
}

fn chrono_now() -> String {
    // 轻量时间戳（避免引入 chrono 依赖）
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{ms}")
}

/// 代理窗口导航（模拟真实浏览内容页，建立正常会话状态；Ruling-62 反 40362 手段之一）
#[tauri::command]
pub async fn proxy_navigate(label: String, url: String, app: tauri::AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("webview 窗口不存在：{label}"))?;
    let parsed = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    win.navigate(parsed).map_err(|e| e.to_string())
}

/// 导出写文件：path 必须是 root 之内（服务端二次校验，PRD §8-5）
#[tauri::command]
pub fn export_write_text(root: String, path: String, content: String) -> Result<(), String> {
    let full = resolve_under(&root, &path)?;
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(full, content).map_err(|e| e.to_string())
}

/// 导出写二进制（base64 传输）
#[tauri::command]
pub fn export_write_binary(root: String, path: String, data_base64: String) -> Result<(), String> {
    let full = resolve_under(&root, &path)?;
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| e.to_string())?;
    std::fs::write(full, bytes).map_err(|e| e.to_string())
}

/// 打开路径（资源管理器）
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 解析并校验 path 必须位于 root 内（防路径穿越）
fn resolve_under(root: &str, path: &str) -> Result<std::path::PathBuf, String> {
    let root_p = std::path::Path::new(root)
        .canonicalize()
        .map_err(|e| format!("输出根目录不可达：{e}"))?;
    let full = root_p.join(path);
    let full_c = full
        .canonicalize()
        .unwrap_or_else(|_| normalize_lexically(&full));
    if !full_c.starts_with(&root_p) {
        return Err(format!("路径穿越拒绝：{path}"));
    }
    Ok(full)
}

/// 无盘符访问下的词法归一化（处理 .. 与 .）
fn normalize_lexically(p: &std::path::Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut out = std::path::PathBuf::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn ai_key_path(state: &State<'_, AppState>) -> std::path::PathBuf {
    let guard = state.data_dir.lock().unwrap_or_else(|e| e.into_inner());
    guard.join("ai-key.bin")
}

/// AI Key 保存（独立 DPAPI 文件 ai-key.bin，PRD §10-9）
#[tauri::command]
pub fn ai_key_save(data: String, state: State<'_, AppState>) -> Result<(), String> {
    crate::credential::save(&ai_key_path(&state), &data)
}

/// AI Key 读取
#[tauri::command]
pub fn ai_key_load(state: State<'_, AppState>) -> Result<Option<String>, String> {
    crate::credential::load(&ai_key_path(&state))
}

/// AI Key 清除
#[tauri::command]
pub fn ai_key_clear(state: State<'_, AppState>) -> Result<(), String> {
    crate::credential::clear(&ai_key_path(&state))
}

/// SSRF 白名单判定（PRD §8-3，前端请求前必查，不可绕过）
#[tauri::command]
pub fn guard_url(url: String) -> Result<(), String> {
    if crate::network_guard::is_allowed_url(&url) {
        Ok(())
    } else {
        Err(format!("SSRF 白名单拒绝：{url}"))
    }
}

/// 探测系统 Edge 安装路径（PRD §7.5 detect_edge）
#[tauri::command]
pub fn detect_edge() -> Option<String> {
    for path in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ] {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    None
}

/// Edge 无头打印 PDF（PRD §5.5：缺失降级由前端记 partial）。
/// html 写入 root/<bookDir>/pdf/.print.html，打印后删除临时文件。
#[tauri::command]
pub fn print_pdf(root: String, book_dir: String, html: String) -> Result<String, String> {
    let edge = detect_edge().ok_or("PDF_NO_EDGE：未检测到系统 Edge，无法打印 PDF")?;
    let pdf_dir_rel = format!("{book_dir}/pdf");
    let tmp_rel = format!("{pdf_dir_rel}/.print.html");
    export_write_text(root.clone(), tmp_rel.clone(), html)?;

    let root_p = std::path::Path::new(&root)
        .canonicalize()
        .map_err(|e| format!("输出根目录不可达：{e}"))?;
    let tmp_full = root_p.join(&tmp_rel);
    let pdf_rel = format!("{pdf_dir_rel}/{}.pdf", book_dir);
    let pdf_full = root_p.join(&pdf_rel);

    let url = format!("file:///{}", tmp_full.to_string_lossy().replace('\\', "/"));
    let out = format!("--print-to-pdf={}", pdf_full.to_string_lossy());
    // 独立 profile 目录：避免挂接到用户正在运行的 Edge 实例导致阻塞
    let profile_dir = root_p.join(format!("{pdf_dir_rel}/.edge-profile-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&profile_dir);
    let profile = format!("--user-data-dir={}", profile_dir.to_string_lossy());
    let status = std::process::Command::new(&edge)
        .args([
            "--headless",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-sync",
            "--no-pdf-header-footer",
            &profile,
            &out,
            &url,
        ])
        .status()
        .map_err(|e| format!("Edge 启动失败：{e}"))?;
    let _ = std::fs::remove_dir_all(&profile_dir);
    let _ = std::fs::remove_file(&tmp_full);
    if !status.success() {
        return Err(format!("Edge 打印失败（exit {:?}）", status.code()));
    }
    match std::fs::metadata(&pdf_full) {
        Ok(m) if m.len() > 500 => Ok(pdf_rel),
        Ok(m) => Err(format!("PDF 输出异常（{} 字节）", m.len())),
        Err(e) => Err(format!("PDF 未生成：{e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_dir_lives_beside_exe() {
        let exe_dir = Path::new("D:\\apps");
        let dir = resolve_data_dir(exe_dir);
        assert_eq!(dir, exe_dir.join("zhivault-data"));
        assert!(dir.ends_with("zhivault-data"));
    }

    #[test]
    fn data_dir_parent_is_exe_dir() {
        // 便携模式铁律（PRD §7.1）：数据目录必须落在 exe 旁，不写 Program Files 假设
        let exe_dir = Path::new("C:\\Tools\\知藏");
        let dir = resolve_data_dir(exe_dir);
        assert_eq!(dir.parent(), Some(exe_dir));
    }

    #[test]
    fn resolve_under_accepts_normal_paths() {
        let dir = std::env::temp_dir().join("zhivault-resolve-test");
        std::fs::create_dir_all(&dir).unwrap();
        let dir_c = dir.canonicalize().unwrap();
        let full = resolve_under(dir.to_str().unwrap(), "书/html/index.html").unwrap();
        assert!(full.starts_with(&dir_c));
    }

    #[test]
    fn resolve_under_rejects_dotdot_and_absolute() {
        let dir = std::env::temp_dir().join("zhivault-resolve-test2");
        std::fs::create_dir_all(&dir).unwrap();
        let root = dir.to_str().unwrap().to_string();
        assert!(resolve_under(&root, "../evil.txt").is_err());
        assert!(resolve_under(&root, "a/../../evil.txt").is_err());
        assert!(resolve_under(&root, "C:/Windows/evil.txt").is_err());
    }

    #[test]
    fn edge_prints_real_pdf_when_available() {
        // 验收（PRD §10-7）：有 Edge 环境生成非空 PDF；无 Edge 环境自动跳过
        if detect_edge().is_none() {
            eprintln!("跳过：未安装 Edge");
            return;
        }
        let root = std::env::temp_dir().join("zhivault-pdf-test");
        std::fs::create_dir_all(&root).unwrap();
        let html = "<h1>知藏 PDF 测试</h1><p>作者：橙茶星</p>".to_string();
        let rel = print_pdf(root.to_str().unwrap().to_string(), "测试书".to_string(), html)
            .expect("Edge 打印应成功");
        let bytes = std::fs::read(root.join(&rel)).expect("pdf 文件");
        assert!(bytes.len() > 500, "PDF 应非空（实际 {} 字节）", bytes.len());
        assert_eq!(&bytes[0..4], b"%PDF", "应为 PDF 文件头");
        let _ = std::fs::remove_dir_all(&root);
    }
}
