//! 壳内 SQLite 命令组（Ruling-63）：tauri-plugin-sql 2.6 在 release 构建中 execute 永久挂起
//!（plugins-workspace#1386 同类症状：建空库文件后 CREATE TABLE 永不返回，dev 正常），
//! 替换为 rusqlite(bundled) 直连 + 三条薄命令；TS 侧 SqlExecutor 接口不变（生产 = IPC 适配）。

use std::sync::Mutex;

use rusqlite::{params_from_iter, types::Value as SqlValue, Connection, ToSql};
use serde::Serialize;
use serde_json::Value as JsonValue;
use tauri::State;

use crate::AppState;

pub struct SqliteState {
    pub conn: Mutex<Option<Connection>>,
}

#[derive(Serialize)]
pub struct RunResult {
    pub changes: u64,
    pub last_id: i64,
}

fn json_to_sql(v: &JsonValue) -> Box<dyn ToSql> {
    match v {
        JsonValue::Null => Box::new(None::<String>),
        JsonValue::Bool(b) => Box::new(*b as i64),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(n.to_string())
            }
        }
        JsonValue::String(s) => Box::new(s.clone()),
        other => Box::new(other.to_string()),
    }
}

fn bind_params(params: &[JsonValue]) -> Vec<Box<dyn ToSql>> {
    params.iter().map(json_to_sql).collect()
}

fn rows_to_json(stmt: &mut rusqlite::Statement, params: &[JsonValue]) -> Result<Vec<serde_json::Map<String, JsonValue>>, String> {
    let columns: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|c| c.to_string())
        .collect();
    let boxed = bind_params(params);
    let refs: Vec<&dyn ToSql> = boxed.iter().map(|b| b.as_ref()).collect();
    let mut rows = Vec::new();
    let mut rows_iter = stmt
        .query(params_from_iter(refs))
        .map_err(|e| e.to_string())?;
    loop {
        let row = rows_iter.next().map_err(|e| e.to_string())?;
        let row = match row {
            Some(r) => r,
            None => break,
        };
        let mut obj = serde_json::Map::new();
        for (i, name) in columns.iter().enumerate() {
            let v: SqlValue = row.get(i).map_err(|e| e.to_string())?;
            let jv = match v {
                SqlValue::Null => JsonValue::Null,
                SqlValue::Integer(n) => JsonValue::from(n),
                SqlValue::Real(f) => JsonValue::from(f),
                SqlValue::Text(s) => JsonValue::from(s),
                SqlValue::Blob(b) => JsonValue::from(b),
            };
            obj.insert(name.clone(), jv);
        }
        rows.push(obj);
    }
    Ok(rows)
}

fn with_conn<R>(
    state: &State<'_, SqliteState>,
    f: impl FnOnce(&Connection) -> Result<R, String>,
) -> Result<R, String> {
    let guard = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    let conn = guard.as_ref().ok_or("数据库未打开（先调用 db_open）")?;
    f(conn)
}

/// 打开便携库（WAL + 外键），路径由前端经 get_data_dir 拼接
#[tauri::command]
pub fn db_open(path: String, state: State<'_, SqliteState>) -> Result<(), String> {
    let mut guard = state.conn.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_some() {
        return Ok(());
    }
    let conn = Connection::open(&path).map_err(|e| format!("打开数据库失败（{path}）：{e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn db_run(sql: String, params: Vec<JsonValue>, state: State<'_, SqliteState>) -> Result<RunResult, String> {
    with_conn(&state, |conn| {
        let boxed = bind_params(&params);
        let refs: Vec<&dyn ToSql> = boxed.iter().map(|b| b.as_ref()).collect();
        let r = conn
            .execute(&sql, params_from_iter(refs))
            .map_err(|e| format!("db_run 失败：{e}（{sql}）"))?;
        Ok(RunResult {
            changes: r as u64,
            last_id: conn.last_insert_rowid(),
        })
    })
}

#[tauri::command]
pub fn db_all(
    sql: String,
    params: Vec<JsonValue>,
    state: State<'_, SqliteState>,
) -> Result<Vec<serde_json::Map<String, JsonValue>>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("db_all prepare 失败：{e}（{sql}）"))?;
        rows_to_json(&mut stmt, &params)
    })
}

#[tauri::command]
pub fn db_get(
    sql: String,
    params: Vec<JsonValue>,
    state: State<'_, SqliteState>,
) -> Result<Option<serde_json::Map<String, JsonValue>>, String> {
    with_conn(&state, |conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("db_get prepare 失败：{e}（{sql}）"))?;
        let mut rows = rows_to_json(&mut stmt, &params)?;
        if rows.is_empty() {
            Ok(None)
        } else {
            Ok(Some(rows.remove(0)))
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_db_roundtrip() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)", [])
            .unwrap();
        conn.execute("INSERT INTO t (name) VALUES (?1)", ["知藏"])
            .unwrap();
        let mut stmt = conn.prepare("SELECT id, name FROM t WHERE name = ?1").unwrap();
        let rows = rows_to_json(&mut stmt, &[JsonValue::from("知藏")]).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["name"], JsonValue::from("知藏"));
    }

    #[test]
    fn json_param_types() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE p (i INTEGER, f REAL, s TEXT, n TEXT)", [])
            .unwrap();
        let params = vec![
            JsonValue::from(42),
            JsonValue::from(1.5),
            JsonValue::from("橙茶星"),
            JsonValue::Null,
        ];
        let r = {
            let boxed = bind_params(&params);
            let refs: Vec<&dyn ToSql> = boxed.iter().map(|b| b.as_ref()).collect();
            conn.execute("INSERT INTO p VALUES (?1,?2,?3,?4)", params_from_iter(refs))
                .unwrap()
        };
        assert_eq!(r, 1);
    }
}
