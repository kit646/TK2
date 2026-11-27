mod grader;
mod loader;
mod models;

use axum::{
    extract::{Path as AxumPath, State},
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use models::{AttemptRecord, ExamSummary, ExamTest, GradeReport, PublicExamTest, SubmitRequest};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tower_http::services::ServeDir;

#[derive(Clone)]
struct AppState {
    exams: Arc<Vec<ExamTest>>,
    history: Arc<RwLock<Vec<AttemptRecord>>>,
    history_path: PathBuf,
}

#[tokio::main]
async fn main() {
    let tests_dir = PathBuf::from("data/tests");
    let history_path = PathBuf::from("data/history.json");

    let exams = loader::load_all_exams(&tests_dir).unwrap_or_else(|err| {
        eprintln!("Failed to load exam tests: {err}");
        std::process::exit(1);
    });

    let history = loader::load_history(&history_path);

    let state = AppState {
        exams: Arc::new(exams),
        history: Arc::new(RwLock::new(history)),
        history_path,
    };

    let app = Router::new()
        .route("/", get(serve_index))
        .route("/test/{id}", get(serve_index))
        .route("/api/tests", get(list_tests))
        .route("/api/tests/{id}", get(get_test))
        .route("/api/tests/{id}/submit", post(submit_test))
        .route("/api/history", get(get_history).delete(clear_history))
        .nest_service("/static", ServeDir::new("static"))
        .with_state(state);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("====================================================");
    println!("  A2.1 Progress Test 2 Portal (Rust + Axum)");
    println!("  Loaded 13 tests (3 reference + 10 practice)");
    println!("  Local:     http://127.0.0.1:{port}");
    println!("  Listening: http://{addr}");
    println!("====================================================");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind TCP listener");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Server error");
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    println!("\nShutting down gracefully...");
}

async fn serve_index() -> impl IntoResponse {
    match tokio::fs::read_to_string(Path::new("static/index.html")).await {
        Ok(html) => (StatusCode::OK, Html(html)).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to load static/index.html: {err}"),
        )
            .into_response(),
    }
}

async fn list_tests(State(state): State<AppState>) -> Json<Vec<ExamSummary>> {
    let history = state.history.read().expect("History lock poisoned");
    let summaries = state
        .exams
        .iter()
        .map(|exam| {
            let mut attempt_count = 0usize;
            let mut best_score_ten: Option<f64> = None;
            let mut best_correct: Option<usize> = None;

            for rec in history.iter().filter(|h| h.test_id == exam.id) {
                attempt_count += 1;
                best_score_ten = Some(match best_score_ten {
                    Some(prev) => prev.max(rec.ten_scale),
                    None => rec.ten_scale,
                });
                best_correct = Some(match best_correct {
                    Some(prev) => prev.max(rec.total_correct),
                    None => rec.total_correct,
                });
            }

            ExamSummary {
                id: exam.id,
                slug: exam.slug.clone(),
                category: exam.category.clone(),
                badge: exam.badge.clone(),
                title: exam.title.clone(),
                subtitle: exam.subtitle.clone(),
                topic: exam.topic.clone(),
                duration_minutes: exam.duration_minutes,
                question_count: 50,
                theme: exam.theme.clone(),
                attempt_count,
                best_score_ten,
                best_correct,
            }
        })
        .collect();

    Json(summaries)
}

async fn get_test(
    AxumPath(id): AxumPath<u32>,
    State(state): State<AppState>,
) -> Result<Json<PublicExamTest>, (StatusCode, String)> {
    let exam = state
        .exams
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Test {id} not found")))?;

    Ok(Json(PublicExamTest::from(exam)))
}

async fn submit_test(
    AxumPath(id): AxumPath<u32>,
    State(state): State<AppState>,
    Json(payload): Json<SubmitRequest>,
) -> Result<Json<GradeReport>, (StatusCode, String)> {
    let exam = state
        .exams
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("Test {id} not found")))?;

    let report = grader::grade_exam(exam, &payload);

    let record = AttemptRecord {
        id: format!(
            "{}-{}",
            chrono::Utc::now().timestamp_millis(),
            exam.id
        ),
        test_id: exam.id,
        test_title: exam.title.clone(),
        category: exam.category.clone(),
        student_name: report.student_name.clone(),
        student_class: report.student_class.clone(),
        total_correct: report.total_correct,
        total_questions: report.total_questions,
        ten_scale: report.ten_scale,
        accuracy_percent: report.accuracy_percent,
        elapsed_seconds: report.elapsed_seconds,
        submitted_at: report.submitted_at.clone(),
    };

    {
        let mut history = state.history.write().expect("History lock poisoned");
        history.insert(0, record);
        if history.len() > 200 {
            history.truncate(200);
        }
        if let Err(err) = loader::save_history(&state.history_path, &history) {
            eprintln!("Warning: could not persist history: {err}");
        }
    }

    Ok(Json(report))
}

async fn get_history(State(state): State<AppState>) -> Json<Vec<AttemptRecord>> {
    let history = state.history.read().expect("History lock poisoned");
    Json(history.clone())
}

async fn clear_history(State(state): State<AppState>) -> StatusCode {
    {
        let mut history = state.history.write().expect("History lock poisoned");
        history.clear();
        let _ = loader::save_history(&state.history_path, &history);
    }
    StatusCode::NO_CONTENT
}
