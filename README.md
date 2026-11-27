# A2.1 – Progress Test 2 Practice Portal (Rust + Axum)

Ứng dụng web luyện thi tiếng Anh trình độ **CEFR A2.1 – Progress Test 2** được viết bằng ngôn ngữ **Rust** (`axum`, `tokio`, `serde`, `tower-http`), tổng hợp **3 đề gốc** tham chiếu và **10 đề phát triển mới** (500 câu mới, tổng cộng 650 câu hỏi).

## Cấu trúc mỗi đề thi (50 câu · 40 phút)

- **Section A: Vocabulary (30 câu)**
  - Part 1 (Q1–10): Word Box (12 từ chọn 10, có chip tương tác + dropdown)
  - Part 2 (Q11–18): Reading Comprehension True / False (giao diện chia 2 cột)
  - Part 3 (Q19–24): Matching Questions with Responses (`a`–`f`)
  - Part 4 (Q25–30): Spelling Correction
- **Section B: Grammar (20 câu)**
  - Part 1 (Q31–40): Multiple Choice (3 lựa chọn)
  - Part 2 (Q41–45): Word Order (kéo/nhấn khối từ vào khay câu)
  - Part 3 (Q46–50): Word Forms (chia từ trong ngoặc)

## Cấu trúc thư mục

- `src/main.rs` — Axum HTTP server, API routes, lưu lịch sử làm bài (`data/history.json`)
- `src/models.rs` — Các struct dữ liệu và DTO ẩn đáp án khi đang thi (`PublicExamTest`)
- `src/loader.rs` — Nạp & kiểm định toàn bộ file đề `data/tests/test_*.json`
- `src/grader.rs` — Bộ chấm điểm phía server + chuẩn hoá đáp án + unit tests
- `data/tests/` — `test_01.json`..`test_03.json` (3 đề gốc) & `test_04.json`..`test_13.json` (10 đề mới)
- `static/` — Giao diện frontend (`index.html`, `styles.css`, `app.js`)

## Chạy kiểm thử và khởi động server

```powershell
# Chạy toàn bộ unit tests & kiểm định 13 đề (650 câu)
cargo test

# Khởi động web server tại http://127.0.0.1:3000
cargo run
```

Có thể đổi cổng qua biến môi trường `PORT` (mặc định `3000`).

## Mở server online

### Cách 1: Mở link công khai ngay từ máy cá nhân (Cloudflare Tunnel)
```powershell
# Terminal 1: chạy server Rust
cargo run

# Terminal 2: mở đường hầm HTTPS công khai
cloudflared tunnel --url http://127.0.0.1:3000
```

### Cách 2: Deploy 24/7 lên Render.com (miễn phí từ GitHub)
Repo đã kèm sẵn `Dockerfile` và `render.yaml`:
1. Đăng nhập [Render.com](https://render.com) → chọn **New +** → **Blueprint** (hoặc **Web Service**).
2. Kết nối repository GitHub `kit646/TK2`.
3. Render tự đọc `render.yaml` / `Dockerfile`, build ứng dụng Rust và cấp domain HTTPS công khai 24/7.
