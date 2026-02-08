// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use std::net::TcpListener;
use std::time::Duration;

// 查找可用端口
fn find_available_port() -> u16 {
    (3000..4000)
        .find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
        .unwrap_or(3000)
}

// 等待服务器启动
async fn wait_for_server(port: u16, max_attempts: u32) -> bool {
    for _ in 0..max_attempts {
        if TcpListener::bind(("127.0.0.1", port)).is_err() {
            return true; // 端口被占用，说明服务器已启动
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 在生产模式下启动 Next.js 服务器
            #[cfg(not(debug_assertions))]
            {
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let port = find_available_port();
                    log::info!("Starting Next.js server on port {}", port);

                    // 启动 Node.js 服务器
                    let shell = app_handle.shell();
                    
                    // TODO: 这里需要配置 Node.js 可执行文件路径
                    // 目前先使用系统的 Node.js
                    let _server = shell
                        .command("node")
                        .args(["server/server.js"])
                        .env("PORT", port.to_string())
                        .spawn();

                    // 等待服务器启动
                    if wait_for_server(port, 60).await {
                        log::info!("Next.js server started successfully");
                        
                        // 更新窗口 URL
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let url = format!("http://localhost:{}", port);
                            let _ = window.eval(&format!("window.location.href = '{}'", url));
                        }
                    } else {
                        log::error!("Failed to start Next.js server");
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
