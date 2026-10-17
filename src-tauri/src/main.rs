// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod credential;
mod network_guard;
mod pdf_edge;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;

/// 应用运行期状态：便携数据目录路径（exe 旁 ./zhivault-data/）
pub struct AppState {
    pub data_dir: Mutex<PathBuf>,
}

fn main() {
    let exe_path = std::env::current_exe().expect("无法定位可执行文件路径");
    let exe_dir = exe_path
        .parent()
        .expect("可执行文件路径缺少父目录")
        .to_path_buf();
    let data_dir = commands::resolve_data_dir(&exe_dir);
    std::fs::create_dir_all(&data_dir).expect("无法创建便携数据目录");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 单实例锁（PRD §8-7）：第二实例启动时聚焦已有主窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(AppState {
            data_dir: Mutex::new(data_dir),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_data_dir,
            commands::eval_in_webview,
            commands::export_write_text,
            commands::export_write_binary,
            commands::open_path,
            commands::credential_save,
            commands::credential_load,
            commands::credential_clear,
            commands::ai_key_save,
            commands::ai_key_load,
            commands::ai_key_clear,
            commands::guard_url,
            commands::detect_edge,
            commands::print_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
