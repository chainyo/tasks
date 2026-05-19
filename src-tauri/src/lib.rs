use std::{fs, path::PathBuf, thread, time::Duration};

use chrono::{Duration as ChronoDuration, Local, NaiveDateTime};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use tauri::{
    Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl,
    WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const DEFAULT_TASK: &str = "Choose one useful task for today";

#[derive(Clone)]
struct AppState {
    db_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DailyTask {
    id: i64,
    content: String,
    date: String,
    completed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
enum StickerCorner {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

impl StickerCorner {
    fn as_str(self) -> &'static str {
        match self {
            Self::TopLeft => "top-left",
            Self::TopRight => "top-right",
            Self::BottomLeft => "bottom-left",
            Self::BottomRight => "bottom-right",
        }
    }

    fn from_str(value: &str) -> Self {
        match value {
            "top-left" => Self::TopLeft,
            "bottom-left" => Self::BottomLeft,
            "bottom-right" => Self::BottomRight,
            _ => Self::TopRight,
        }
    }
}

impl Default for StickerCorner {
    fn default() -> Self {
        Self::TopRight
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StickerSettings {
    corner: StickerCorner,
}

#[tauri::command]
fn get_daily_tasks(state: State<'_, AppState>) -> Result<Vec<DailyTask>, String> {
    tasks_for_today(&state.db_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_sticker_settings(state: State<'_, AppState>) -> Result<StickerSettings, String> {
    let corner = sticker_corner(&state.db_path).map_err(|error| error.to_string())?;
    Ok(StickerSettings { corner })
}

#[tauri::command]
fn save_sticker_settings(
    corner: StickerCorner,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<StickerSettings, String> {
    save_sticker_corner(&state.db_path, corner).map_err(|error| error.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        position_window(&window, corner);
    }
    Ok(StickerSettings { corner })
}

#[tauri::command]
fn save_daily_tasks(
    contents: Vec<String>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<DailyTask>, String> {
    let tasks = save_tasks(&state.db_path, &contents).map_err(|error| error.to_string())?;
    app.emit("daily-tasks-changed", &tasks)
        .map_err(|error| error.to_string())?;
    Ok(tasks)
}

#[tauri::command]
fn set_today_completed(
    id: i64,
    completed: bool,
    state: State<'_, AppState>,
) -> Result<Vec<DailyTask>, String> {
    set_completed(&state.db_path, id, completed).map_err(|error| error.to_string())
}

#[tauri::command]
fn reorder_daily_tasks(
    ids: Vec<i64>,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<DailyTask>, String> {
    let tasks = reorder_tasks(&state.db_path, &ids).map_err(|error| error.to_string())?;
    app.emit("daily-tasks-changed", &tasks)
        .map_err(|error| error.to_string())?;
    Ok(tasks)
}

#[tauri::command]
fn hide_sticker_until_tomorrow(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    hide_sticker_for_current_task_day(&state.db_path).map_err(|error| error.to_string())?;
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn resize_sticker_window(
    height: u32,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let current_size = window.outer_size().map_err(|error| error.to_string())?;
    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
    let current_width = current_size.width as f64 / scale_factor;
    let next_height = height.max(32) as f64;
    window
        .set_size(LogicalSize::new(current_width, next_height))
        .map_err(|error| error.to_string())?;
    let corner = sticker_corner(&state.db_path).unwrap_or_default();
    position_window(&window, corner);
    Ok(())
}

#[tauri::command]
fn open_config_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("config") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "config", WebviewUrl::App("index.html#config".into()))
        .title("Daily Sticker Settings")
        .inner_size(560.0, 500.0)
        .resizable(false)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_pilot::init());

    builder
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
            fs::create_dir_all(&app_data_dir)
                .map_err(|error| format!("failed to create app data dir: {error}"))?;
            let db_path = app_data_dir.join("daily-task.sqlite3");
            init_database(&db_path).map_err(|error| error.to_string())?;
            app.manage(AppState {
                db_path: db_path.clone(),
            });
            create_menu_bar_icon(app).map_err(|error| error.to_string())?;
            position_main_window(app);
            sync_sticker_visibility(app, &db_path);
            start_sticker_visibility_poll(app.handle().clone(), db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_daily_tasks,
            get_sticker_settings,
            save_sticker_settings,
            save_daily_tasks,
            set_today_completed,
            reorder_daily_tasks,
            hide_sticker_until_tomorrow,
            resize_sticker_window,
            open_config_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running daily task sticker");
}

fn create_menu_bar_icon(app: &tauri::App) -> tauri::Result<()> {
    let app_handle = app.handle().clone();

    TrayIconBuilder::with_id("daily-task-sticker")
        .title("✓")
        .tooltip("Daily Task Sticker")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = open_config_window(app_handle.clone());
            }
        })
        .build(app)?;

    Ok(())
}

fn position_main_window(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let state = app.state::<AppState>();
    let corner = sticker_corner(&state.db_path).unwrap_or_default();
    position_window(&window, corner);
}

fn sync_sticker_visibility(app: &tauri::App, path: &PathBuf) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if should_hide_sticker(path).unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
    }
}

fn start_sticker_visibility_poll(app: tauri::AppHandle, path: PathBuf) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(60));
            let Some(window) = app.get_webview_window("main") else {
                continue;
            };

            if should_hide_sticker(&path).unwrap_or(false) {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let corner = sticker_corner(&path).unwrap_or_default();
                position_window(&window, corner);
            }
        }
    });
}

fn position_window(window: &tauri::WebviewWindow, corner: StickerCorner) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let work_area = monitor.work_area();
    let window_size = window.outer_size().ok();
    let fallback_size = PhysicalSize::new(214, 86);
    let size = window_size.unwrap_or(fallback_size);
    let position = corner_position(
        corner,
        work_area.position.x,
        work_area.position.y,
        work_area.size.width,
        work_area.size.height,
        size.width,
        size.height,
        18,
    );
    let _ = window.set_position(position);
}

fn corner_position(
    corner: StickerCorner,
    area_x: i32,
    area_y: i32,
    area_width: u32,
    area_height: u32,
    window_width: u32,
    window_height: u32,
    margin: i32,
) -> PhysicalPosition<i32> {
    let max_x = area_x + area_width as i32 - window_width as i32 - margin;
    let max_y = area_y + area_height as i32 - window_height as i32 - margin;
    let min_x = area_x + margin;
    let min_y = area_y + margin;
    let x = match corner {
        StickerCorner::TopLeft | StickerCorner::BottomLeft => min_x,
        StickerCorner::TopRight | StickerCorner::BottomRight => max_x.max(min_x),
    };
    let y = match corner {
        StickerCorner::TopLeft | StickerCorner::TopRight => min_y,
        StickerCorner::BottomLeft | StickerCorner::BottomRight => max_y.max(min_y),
    };

    PhysicalPosition::new(x, y)
}

fn init_database(path: &PathBuf) -> rusqlite::Result<()> {
    let connection = Connection::open(path)?;
    migrate_daily_state_schema(&connection)?;
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_state (
            task_id INTEGER NOT NULL DEFAULT 1,
            task_date TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (task_id, task_date)
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            position INTEGER NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        );
        ",
    )?;
    migrate_legacy_task(&connection)?;
    seed_default_task(&connection)?;
    Ok(())
}

fn tasks_for_today(path: &PathBuf) -> rusqlite::Result<Vec<DailyTask>> {
    let connection = open_initialized(path)?;
    let today = today();
    let mut statement = connection.prepare(
        "
        SELECT tasks.id, tasks.content, COALESCE(daily_state.completed, 0)
        FROM tasks
        LEFT JOIN daily_state
            ON daily_state.task_id = tasks.id
            AND daily_state.task_date = ?1
        WHERE tasks.active = 1
        ORDER BY tasks.position ASC, tasks.id ASC
        ",
    )?;

    statement
        .query_map([&today], |row| {
            Ok(DailyTask {
                id: row.get(0)?,
                content: row.get(1)?,
                date: today.clone(),
                completed: row.get::<_, i64>(2)? != 0,
            })
        })?
        .collect()
}

fn save_tasks(path: &PathBuf, contents: &[String]) -> rusqlite::Result<Vec<DailyTask>> {
    let mut connection = open_initialized(path)?;
    let trimmed_contents = normalized_contents(contents);
    let transaction = connection.transaction()?;
    transaction.execute("UPDATE tasks SET active = 0", [])?;

    for (position, content) in trimmed_contents.iter().enumerate() {
        transaction.execute(
            "INSERT INTO tasks (content, position, active) VALUES (?1, ?2, 1)",
            params![content, position as i64],
        )?;
    }

    transaction.commit()?;
    tasks_for_today(path)
}

fn set_completed(path: &PathBuf, id: i64, completed: bool) -> rusqlite::Result<Vec<DailyTask>> {
    let connection = open_initialized(path)?;
    let today = today();
    connection.execute(
        "
        INSERT INTO daily_state (task_id, task_date, completed)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(task_id, task_date) DO UPDATE SET completed = excluded.completed
        ",
        params![id, today, completed],
    )?;
    tasks_for_today(path)
}

fn hide_sticker_for_current_task_day(path: &PathBuf) -> rusqlite::Result<()> {
    let connection = open_initialized(path)?;
    connection.execute(
        "
        INSERT INTO settings (key, value)
        VALUES ('hidden_task_date', ?1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        [today()],
    )?;
    Ok(())
}

fn should_hide_sticker(path: &PathBuf) -> rusqlite::Result<bool> {
    let connection = open_initialized(path)?;
    let hidden_date = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'hidden_task_date'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    Ok(hidden_date.as_deref() == Some(today().as_str()))
}

fn sticker_corner(path: &PathBuf) -> rusqlite::Result<StickerCorner> {
    let connection = open_initialized(path)?;
    let corner = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'sticker_corner'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    Ok(corner
        .as_deref()
        .map(StickerCorner::from_str)
        .unwrap_or_default())
}

fn save_sticker_corner(path: &PathBuf, corner: StickerCorner) -> rusqlite::Result<()> {
    let connection = open_initialized(path)?;
    connection.execute(
        "
        INSERT INTO settings (key, value)
        VALUES ('sticker_corner', ?1)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        [corner.as_str()],
    )?;
    Ok(())
}

fn reorder_tasks(path: &PathBuf, ids: &[i64]) -> rusqlite::Result<Vec<DailyTask>> {
    let mut connection = open_initialized(path)?;
    let transaction = connection.transaction()?;
    let mut position = 0_i64;

    for id in ids {
        let updated = transaction.execute(
            "UPDATE tasks SET position = ?1 WHERE id = ?2 AND active = 1",
            params![position, id],
        )?;

        if updated > 0 {
            position += 1;
        }
    }

    let mut statement = transaction
        .prepare("SELECT id FROM tasks WHERE active = 1 ORDER BY position ASC, id ASC")?;
    let existing_ids = statement
        .query_map([], |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(statement);

    for id in existing_ids {
        if !ids.contains(&id) {
            transaction.execute(
                "UPDATE tasks SET position = ?1 WHERE id = ?2 AND active = 1",
                params![position, id],
            )?;
            position += 1;
        }
    }

    transaction.commit()?;
    tasks_for_today(path)
}

fn open_initialized(path: &PathBuf) -> rusqlite::Result<Connection> {
    init_database(path)?;
    Connection::open(path)
}

fn migrate_daily_state_schema(connection: &Connection) -> rusqlite::Result<()> {
    let mut statement = connection.prepare("PRAGMA table_info(daily_state)")?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    if !columns.is_empty() && !columns.iter().any(|column| column == "task_id") {
        connection.execute("DROP TABLE daily_state", [])?;
    }

    Ok(())
}

fn migrate_legacy_task(connection: &Connection) -> rusqlite::Result<()> {
    if active_task_count(connection)? > 0 {
        return Ok(());
    }

    let legacy_content = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'task_content'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if let Some(content) = legacy_content {
        connection.execute(
            "INSERT INTO tasks (content, position, active) VALUES (?1, 0, 1)",
            [content.trim()],
        )?;
    }

    Ok(())
}

fn seed_default_task(connection: &Connection) -> rusqlite::Result<()> {
    if active_task_count(connection)? == 0 {
        connection.execute(
            "INSERT INTO tasks (content, position, active) VALUES (?1, 0, 1)",
            [DEFAULT_TASK],
        )?;
    }

    Ok(())
}

fn active_task_count(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row("SELECT COUNT(*) FROM tasks WHERE active = 1", [], |row| {
        row.get(0)
    })
}

fn normalized_contents(contents: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = contents
        .iter()
        .filter_map(|content| {
            let trimmed = content.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        })
        .collect();

    if normalized.is_empty() {
        normalized.push(DEFAULT_TASK.to_string());
    }

    normalized
}

fn today() -> String {
    task_date_for_naive(Local::now().naive_local())
}

fn task_date_for_naive(now: NaiveDateTime) -> String {
    (now - ChronoDuration::hours(5))
        .date()
        .format("%Y-%m-%d")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn database_path() -> PathBuf {
        tempdir()
            .expect("temporary directory")
            .keep()
            .join("daily-task.sqlite3")
    }

    #[test]
    fn initializes_default_task() {
        let path = database_path();

        let tasks = tasks_for_today(&path).expect("tasks");

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].content, DEFAULT_TASK);
        assert_eq!(tasks[0].completed, false);
        assert_eq!(tasks[0].date, today());
    }

    #[test]
    fn task_day_starts_at_five_am() {
        let before_rollover = chrono::NaiveDate::from_ymd_opt(2026, 5, 18)
            .expect("date")
            .and_hms_opt(4, 59, 0)
            .expect("time");
        let after_rollover = chrono::NaiveDate::from_ymd_opt(2026, 5, 18)
            .expect("date")
            .and_hms_opt(5, 0, 0)
            .expect("time");

        assert_eq!(task_date_for_naive(before_rollover), "2026-05-17");
        assert_eq!(task_date_for_naive(after_rollover), "2026-05-18");
    }

    #[test]
    fn hides_sticker_only_for_current_task_day() {
        let path = database_path();

        assert_eq!(should_hide_sticker(&path).expect("visibility"), false);

        hide_sticker_for_current_task_day(&path).expect("hidden");

        assert_eq!(should_hide_sticker(&path).expect("visibility"), true);
    }

    #[test]
    fn saves_sticker_corner_setting() {
        let path = database_path();

        assert_eq!(
            sticker_corner(&path).expect("corner"),
            StickerCorner::TopRight
        );

        save_sticker_corner(&path, StickerCorner::BottomLeft).expect("saved corner");

        assert_eq!(
            sticker_corner(&path).expect("corner"),
            StickerCorner::BottomLeft
        );
    }

    #[test]
    fn positions_bottom_right_inside_work_area() {
        let position = corner_position(StickerCorner::BottomRight, 0, 25, 1440, 835, 214, 86, 18);

        assert_eq!(position.x, 1208);
        assert_eq!(position.y, 756);
    }

    #[test]
    fn saves_trimmed_contents() {
        let path = database_path();

        let tasks = save_tasks(
            &path,
            &[
                "  Read the roadmap  ".to_string(),
                " Ship the build ".to_string(),
            ],
        )
        .expect("saved tasks");

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].content, "Read the roadmap");
        assert_eq!(tasks[1].content, "Ship the build");
    }

    #[test]
    fn blank_content_falls_back_to_default() {
        let path = database_path();

        let tasks = save_tasks(&path, &["   ".to_string()]).expect("saved tasks");

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].content, DEFAULT_TASK);
    }

    #[test]
    fn toggles_completion_for_today() {
        let path = database_path();
        let tasks = tasks_for_today(&path).expect("tasks");
        let id = tasks[0].id;

        let completed = set_completed(&path, id, true).expect("completed task");
        let incomplete = set_completed(&path, id, false).expect("incomplete task");

        assert_eq!(completed[0].completed, true);
        assert_eq!(incomplete[0].completed, false);
    }

    #[test]
    fn opens_existing_database_without_resetting_state() {
        let path = database_path();
        let saved = save_tasks(&path, &["Keep the habit".to_string()]).expect("saved tasks");
        set_completed(&path, saved[0].id, true).expect("completed task");

        let tasks = tasks_for_today(&path).expect("tasks");

        assert_eq!(tasks[0].content, "Keep the habit");
        assert_eq!(tasks[0].completed, true);
    }

    #[test]
    fn reorders_active_tasks_by_id() {
        let path = database_path();
        let saved = save_tasks(
            &path,
            &[
                "First".to_string(),
                "Second".to_string(),
                "Third".to_string(),
            ],
        )
        .expect("saved tasks");

        let reordered = reorder_tasks(&path, &[saved[2].id, saved[0].id]).expect("reordered tasks");

        assert_eq!(reordered[0].content, "Third");
        assert_eq!(reordered[1].content, "First");
        assert_eq!(reordered[2].content, "Second");
    }
}
