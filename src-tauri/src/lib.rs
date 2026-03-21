pub mod account_config;
pub mod advanced_runtime;
pub mod commands;
pub mod db;
pub mod keychain;
pub mod milestone;
pub mod providers;
pub mod scheduler;

use commands::AppState;
use db::Database;
use providers::ProviderManager;
use scheduler::Scheduler;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Rect, WebviewWindow,
    WindowEvent,
};

const POPOVER_VERTICAL_OFFSET: f64 = -4.0;
const WINDOW_EDGE_MARGIN: f64 = 10.0;
const WINDOW_SHADOW_PADDING: f64 = 8.0;

#[derive(Clone, Copy, Debug)]
struct PhysicalBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn bounds_contains(bounds: PhysicalBounds, point: PhysicalPosition<f64>) -> bool {
    point.x >= bounds.x
        && point.x <= bounds.x + bounds.width
        && point.y >= bounds.y
        && point.y <= bounds.y + bounds.height
}

fn monitor_work_area_bounds(monitor: &Monitor) -> PhysicalBounds {
    let work_area = monitor.work_area();

    PhysicalBounds {
        x: work_area.position.x as f64,
        y: work_area.position.y as f64,
        width: work_area.size.width as f64,
        height: work_area.size.height as f64,
    }
}

fn compute_popover_position(
    tray_bounds: PhysicalBounds,
    window_size: PhysicalSize<u32>,
    work_area: Option<PhysicalBounds>,
) -> PhysicalPosition<i32> {
    let window_width = window_size.width as f64;
    let window_height = window_size.height as f64;
    let tray_center_x = tray_bounds.x + tray_bounds.width / 2.0;

    let mut x = tray_center_x - window_width / 2.0;
    let mut y = tray_bounds.y + tray_bounds.height + POPOVER_VERTICAL_OFFSET - WINDOW_SHADOW_PADDING;

    if let Some(area) = work_area {
        let min_x = area.x + WINDOW_EDGE_MARGIN;
        let max_x = (area.x + area.width - window_width - WINDOW_EDGE_MARGIN).max(min_x);
        let min_y = area.y + WINDOW_EDGE_MARGIN;
        let max_y = (area.y + area.height - window_height - WINDOW_EDGE_MARGIN).max(min_y);

        x = x.clamp(min_x, max_x);
        y = y.clamp(min_y, max_y);
    }

    PhysicalPosition::new(x.round() as i32, y.round() as i32)
}

fn find_monitor_for_tray(window: &WebviewWindow, tray_bounds: PhysicalBounds) -> Option<Monitor> {
    let tray_center = PhysicalPosition::new(
        tray_bounds.x + tray_bounds.width / 2.0,
        tray_bounds.y + tray_bounds.height / 2.0,
    );

    window
        .available_monitors()
        .ok()
        .and_then(|monitors| {
            monitors.into_iter().find(|monitor| {
                bounds_contains(monitor_work_area_bounds(monitor), tray_center)
            })
        })
        .or_else(|| window.current_monitor().ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten())
}

fn position_window_below_tray(window: &WebviewWindow, rect: Rect) -> tauri::Result<()> {
    let scale_factor = window.scale_factor()?;
    let tray_position = rect.position.to_physical::<f64>(scale_factor);
    let tray_size = rect.size.to_physical::<f64>(scale_factor);
    let tray_bounds = PhysicalBounds {
        x: tray_position.x,
        y: tray_position.y,
        width: tray_size.width,
        height: tray_size.height,
    };
    let window_size = window.outer_size()?;
    let work_area = find_monitor_for_tray(window, tray_bounds).map(|monitor| monitor_work_area_bounds(&monitor));
    let position = compute_popover_position(tray_bounds, window_size, work_area);
    window.set_position(Position::Physical(position))
}

fn animate_and_hide(window: &WebviewWindow, is_open: &AtomicBool) {
    is_open.store(false, std::sync::atomic::Ordering::Relaxed);
    let _ = window.emit("followbar://closing", ());
    let _ = window.hide();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let is_window_open = Arc::new(AtomicBool::new(false));
    let window_open_for_events = Arc::clone(&is_window_open);

    tauri::Builder::default()
        .on_window_event(move |window, event| {
            if window.label() == "main" && matches!(event, WindowEvent::Focused(false)) {
                if let Some(webview_window) = window.app_handle().get_webview_window("main") {
                    animate_and_hide(&webview_window, &window_open_for_events);
                }
            }
        })
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(move |app| {
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;

            let db_path = app_dir.join("followbar.db");
            let db = Database::open(&db_path).expect("failed to open FollowBar database");
            let _ = db.cleanup_old_snapshots();

            let refresh_interval = db.get_refresh_interval().ok().flatten().unwrap_or(15);
            let milestone_enabled = db.get_milestone_enabled().ok().flatten().unwrap_or(true);
            let scheduler = Arc::new(Scheduler::new(refresh_interval));
            let state = AppState {
                db: Mutex::new(db),
                providers: ProviderManager::new(),
                scheduler: Arc::clone(&scheduler),
                milestone_enabled: AtomicBool::new(milestone_enabled),
            };
            app.manage(state);

            let app_handle = app.handle().clone();
            scheduler.start(move || {
                let current_app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    let state = current_app.state::<AppState>();
                    let _ = commands::do_refresh_all(&state, &current_app).await;
                });
            });

            let window = app
                .get_webview_window("main")
                .expect("main window should exist");
            let _ = window.set_shadow(false);
            let _ = window.hide();

            let tray_icon = Image::new(include_bytes!("../icons/icon.rgba"), 64, 64);

            let window_open_for_tray = Arc::clone(&is_window_open);
            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("FollowBar")
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window_open_for_tray.load(std::sync::atomic::Ordering::Relaxed) {
                                animate_and_hide(&window, &window_open_for_tray);
                            } else {
                                let _ = position_window_below_tray(&window, rect);
                                window_open_for_tray.store(true, std::sync::atomic::Ordering::Relaxed);
                                let _ = window.emit("followbar://opened", ());
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_accounts,
            commands::add_account,
            commands::update_account,
            commands::remove_account,
            commands::get_snapshots_7d,
            commands::get_available_providers,
            commands::refresh_all,
            commands::set_api_key,
            commands::get_api_key_exists,
            commands::get_refresh_interval,
            commands::set_refresh_interval,
            commands::get_autostart,
            commands::set_autostart,
            commands::get_milestone_enabled,
            commands::set_milestone_enabled,
            commands::get_advanced_provider_status,
            commands::install_advanced_provider_runtime,
            commands::connect_advanced_provider,
            commands::verify_xiaohongshu_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        compute_popover_position, PhysicalBounds, POPOVER_VERTICAL_OFFSET, WINDOW_EDGE_MARGIN,
        WINDOW_SHADOW_PADDING,
    };
    use tauri::PhysicalSize;

    #[test]
    fn positions_popover_centered_below_tray() {
        let position = compute_popover_position(
            PhysicalBounds {
                x: 540.0,
                y: 0.0,
                width: 24.0,
                height: 24.0,
            },
            PhysicalSize::new(380, 560),
            None,
        );

        assert_eq!(position.x, 362);
        assert_eq!(
            position.y,
            (24.0 + POPOVER_VERTICAL_OFFSET - WINDOW_SHADOW_PADDING).round() as i32
        );
    }

    #[test]
    fn clamps_horizontal_position_inside_work_area() {
        let position = compute_popover_position(
            PhysicalBounds {
                x: 4.0,
                y: 0.0,
                width: 22.0,
                height: 22.0,
            },
            PhysicalSize::new(380, 560),
            Some(PhysicalBounds {
                x: 0.0,
                y: 28.0,
                width: 1440.0,
                height: 872.0,
            }),
        );

        assert_eq!(position.x, WINDOW_EDGE_MARGIN as i32);
    }

    #[test]
    fn clamps_vertical_position_to_visible_work_area() {
        let position = compute_popover_position(
            PhysicalBounds {
                x: 680.0,
                y: 0.0,
                width: 20.0,
                height: 20.0,
            },
            PhysicalSize::new(380, 560),
            Some(PhysicalBounds {
                x: 0.0,
                y: 38.0,
                width: 1440.0,
                height: 860.0,
            }),
        );

        assert_eq!(position.y, (38.0 + WINDOW_EDGE_MARGIN).round() as i32);
    }
}
