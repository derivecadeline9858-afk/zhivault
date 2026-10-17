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
}
