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
