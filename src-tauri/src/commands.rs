use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{Manager, State};

use crate::AppState;

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
    let win = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("webview 窗口不存在：{label}"))?;
    win.eval(&js).map_err(|e| e.to_string())
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

fn credentials_path(state: &State<'_, AppState>) -> std::path::PathBuf {
    let guard = state.data_dir.lock().unwrap_or_else(|e| e.into_inner());
    guard.join("credentials.bin")
}

/// 凭据保存（DPAPI 加密落盘，PRD §8-1）
#[tauri::command]
pub fn credential_save(data: String, state: State<'_, AppState>) -> Result<(), String> {
    crate::credential::save(&credentials_path(&state), &data)
}

/// 凭据读取（解密）；未保存返回 None
#[tauri::command]
pub fn credential_load(state: State<'_, AppState>) -> Result<Option<String>, String> {
    crate::credential::load(&credentials_path(&state))
}

/// 注销全链路：删凭据文件（内存副本由前端清除）
#[tauri::command]
pub fn credential_clear(state: State<'_, AppState>) -> Result<(), String> {
    crate::credential::clear(&credentials_path(&state))
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
        Ok(m) if m.len() > 1024 => Ok(pdf_rel),
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
