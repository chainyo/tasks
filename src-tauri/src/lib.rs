use std::{fs, path::PathBuf};

use chrono::Local;
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use tauri::{
    Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder,
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

#[tauri::command]
fn get_daily_tasks(state: State<'_, AppState>) -> Result<Vec<DailyTask>, String> {
    tasks_for_today(&state.db_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_daily_tasks(
    contents: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<DailyTask>, String> {
    save_tasks(&state.db_path, &contents).map_err(|error| error.to_string())
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
fn open_config_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("config") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "config", WebviewUrl::App("index.html#config".into()))
        .title("Daily Sticker Settings")
        .inner_size(560.0, 420.0)
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
            app.manage(AppState { db_path });
            create_menu_bar_icon(app).map_err(|error| error.to_string())?;
            position_main_window(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_daily_tasks,
            save_daily_tasks,
            set_today_completed,
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
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let monitor_size = monitor.size();
    let window_size = window.outer_size().ok();
    let width = window_size.map_or(214, |size| size.width) as i32;
    let margin = 18;
    let x = monitor.position().x + monitor_size.width as i32 - width - margin;
    let y = monitor.position().y + margin;
    let _ = window.set_position(PhysicalPosition::new(x, y));
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
    Local::now().date_naive().format("%Y-%m-%d").to_string()
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
}
