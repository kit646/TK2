'use strict';

const appEl = document.getElementById('app');

const IS_STATIC_HOST =
  window.location.hostname.endsWith('github.io') ||
  window.location.protocol === 'file:';

const BASE_PREFIX = (() => {
  if (!window.location.hostname.endsWith('github.io')) return '';
  const segs = window.location.pathname.split('/').filter(Boolean);
  return segs.length ? `/${segs[0]}` : '';
})();

let state = {
  staticMode: IS_STATIC_HOST,
  rawExamsCache: null,
  tests: [],
  history: [],
  filter: 'all',
  search: '',
  currentExam: null,
  timerInterval: null,
  remainingSeconds: 2400,
  elapsedSeconds: 0,
  timerPaused: false,
  activePart1Select: null,
  lastReport: null
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function resetThemeToDefault() {
  const root = document.documentElement.style;
  root.setProperty('--dark', '#1e293b');
  root.setProperty('--primary', '#334155');
  root.setProperty('--accent', '#2563eb');
  root.setProperty('--bright', '#3b82f6');
  root.setProperty('--soft', '#e0e7ff');
  root.setProperty('--pale', '#f8fafc');
  root.setProperty('--line', '#cbd5e1');
  root.setProperty('--ink', '#0f172a');
}

function applyExamTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--dark', theme.dark);
  root.setProperty('--primary', theme.primary);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--bright', theme.bright);
  root.setProperty('--soft', theme.soft);
  root.setProperty('--pale', theme.pale);
  root.setProperty('--line', theme.line);
  root.setProperty('--ink', theme.ink);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function navigate(path) {
  if (state.staticMode) {
    const targetHash = path === '/' ? '#/' : `#${path}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      handleRoute();
    }
    return;
  }
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  handleRoute();
}

window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);

async function handleRoute() {
  stopTimer();
  const hashMatch = window.location.hash.match(/^#\/test\/(\d+)$/);
  if (hashMatch) {
    await loadAndRenderExam(Number(hashMatch[1]));
    return;
  }
  const pathMatch = window.location.pathname.match(/\/test\/(\d+)$/);
  if (pathMatch && !state.staticMode) {
    await loadAndRenderExam(Number(pathMatch[1]));
  } else {
    await loadAndRenderHub();
  }
}

// ==================== STATIC / GITHUB PAGES DATA & GRADER ====================
const STATIC_HISTORY_KEY = 'a2_static_history_v1';

function getStaticHistory() {
  try {
    return JSON.parse(localStorage.getItem(STATIC_HISTORY_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function saveStaticHistory(records) {
  try {
    localStorage.setItem(STATIC_HISTORY_KEY, JSON.stringify(records.slice(0, 200)));
  } catch (_) {}
}

async function ensureStaticExamsLoaded() {
  if (state.rawExamsCache) return state.rawExamsCache;
  const ids = Array.from({ length: 13 }, (_, i) => i + 1);
  const exams = await Promise.all(
    ids.map(async id => {
      const num = String(id).padStart(2, '0');
      const res = await fetch(`${BASE_PREFIX}/data/tests/test_${num}.json`);
      if (!res.ok) throw new Error(`Không thể tải test_${num}.json`);
      return res.json();
    })
  );
  exams.sort((a, b) => a.id - b.id);
  state.rawExamsCache = exams;
  return exams;
}

function toPublicExam(exam) {
  return {
    id: exam.id,
    slug: exam.slug,
    category: exam.category,
    badge: exam.badge,
    title: exam.title,
    subtitle: exam.subtitle,
    topic: exam.topic,
    duration_minutes: exam.duration_minutes,
    theme: exam.theme,
    word_bank: exam.word_bank,
    sec_a_part1: exam.sec_a_part1.map(({ num, pre, post }) => ({ num, pre, post })),
    passage: exam.passage,
    sec_a_part2: exam.sec_a_part2.map(({ num, statement }) => ({ num, statement })),
    sec_a_part3_responses: exam.sec_a_part3_responses,
    sec_a_part3: exam.sec_a_part3.map(({ num, question }) => ({ num, question })),
    sec_a_part4: exam.sec_a_part4.map(({ num, pre, wrong_word, post }) => ({ num, pre, wrong_word, post })),
    sec_b_part1: exam.sec_b_part1.map(({ num, sentence, options }) => ({ num, sentence, options })),
    sec_b_part2: exam.sec_b_part2.map(({ num, blocks }) => ({ num, blocks })),
    sec_b_part3: exam.sec_b_part3.map(({ num, pre, post }) => ({ num, pre, post }))
  };
}

function normalizeStaticText(raw) {
  return String(raw || '')
    .trim()
    .replace(/[’‘]/g, "'")
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeStaticWordOrder(raw) {
  return String(raw || '')
    .replace(/[’‘]/g, "'")
    .replace(/[.?!,]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function gradeExamLocally(exam, payload) {
  const answers = payload.answers || {};
  const partCounts = [0, 0, 0, 0, 0, 0, 0];
  const results = [];
  const answerKey = [];

  const getText = num => {
    const val = answers[num] ?? answers[String(num)];
    if (Array.isArray(val)) return val.join(' ').trim();
    return String(val || '').trim();
  };

  exam.sec_a_part1.forEach(item => {
    const user = getText(item.num);
    const ok = normalizeStaticText(user) === normalizeStaticText(item.answer);
    if (ok) partCounts[0]++;
    results.push({ num: item.num, part: 'Section A – Part 1', is_correct: ok, user_answer: user, correct_answer: item.answer });
    answerKey.push({ num: item.num, answer: item.answer });
  });

  exam.sec_a_part2.forEach(item => {
    const user = getText(item.num);
    const ok = normalizeStaticText(user) === normalizeStaticText(item.answer);
    if (ok) partCounts[1]++;
    results.push({ num: item.num, part: 'Section A – Part 2', is_correct: ok, user_answer: user, correct_answer: item.answer });
    answerKey.push({ num: item.num, answer: item.answer });
  });

  exam.sec_a_part3.forEach(item => {
    const user = getText(item.num);
    const ok = normalizeStaticText(user) === normalizeStaticText(item.answer);
    if (ok) partCounts[2]++;
    results.push({ num: item.num, part: 'Section A – Part 3', is_correct: ok, user_answer: user, correct_answer: item.answer });
    answerKey.push({ num: item.num, answer: item.answer });
  });

  exam.sec_a_part4.forEach(item => {
    const user = getText(item.num);
    const ok = normalizeStaticText(user) === normalizeStaticText(item.answer);
    if (ok) partCounts[3]++;
    results.push({ num: item.num, part: 'Section A – Part 4', is_correct: ok, user_answer: user, correct_answer: item.answer });
    answerKey.push({ num: item.num, answer: item.answer });
  });

  exam.sec_b_part1.forEach(item => {
    const user = getText(item.num);
    const ok = normalizeStaticText(user) === normalizeStaticText(item.answer);
    if (ok) partCounts[4]++;
    results.push({ num: item.num, part: 'Section B – Part 1', is_correct: ok, user_answer: user, correct_answer: item.answer });
    answerKey.push({ num: item.num, answer: item.answer });
  });

  exam.sec_b_part2.forEach(item => {
    const rawVal = answers[item.num] ?? answers[String(item.num)];
    const chosenBlocks = Array.isArray(rawVal)
      ? rawVal
      : String(rawVal || '').trim() ? String(rawVal).trim().split(/\s+/) : [];
    const joined = chosenBlocks.join(' ');
    const norm = normalizeStaticWordOrder(joined);
    const ok = chosenBlocks.length === item.blocks.length &&
      item.accepted.some(acc => normalizeStaticWordOrder(acc) === norm);
    if (ok) partCounts[5]++;
    results.push({ num: item.num, part: 'Section B – Part 2', is_correct: ok, user_answer: joined, correct_answer: item.display_answer });
    answerKey.push({ num: item.num, answer: item.display_answer });
  });

  exam.sec_b_part3.forEach(item => {
    const user = getText(item.num);
    const norm = normalizeStaticText(user);
    const ok = item.accepted.some(acc => normalizeStaticText(acc) === norm);
    if (ok) partCounts[6]++;
    results.push({ num: item.num, part: 'Section B – Part 3', is_correct: ok, user_answer: user, correct_answer: item.display_answer });
    answerKey.push({ num: item.num, answer: item.display_answer });
  });

  const totalCorrect = partCounts.reduce((a, b) => a + b, 0);
  const totalQuestions = 50;
  const tenScale = Math.round((totalCorrect / totalQuestions) * 100) / 10;
  const accuracyPercent = Math.round((totalCorrect / totalQuestions) * 100);

  const partMeta = [
    ['Section A – Part 1 (Word Box: 1–10)', 10],
    ['Section A – Part 2 (Reading T/F: 11–18)', 8],
    ['Section A – Part 3 (Matching: 19–24)', 6],
    ['Section A – Part 4 (Spelling: 25–30)', 6],
    ['Section B – Part 1 (Grammar Choice: 31–40)', 10],
    ['Section B – Part 2 (Word Order: 41–45)', 5],
    ['Section B – Part 3 (Word Forms: 46–50)', 5]
  ];

  const parts = partMeta.map(([title, maxQ], idx) => {
    const correct = partCounts[idx];
    const incorrect = maxQ - correct;
    return {
      title,
      total_questions: maxQ,
      correct,
      incorrect,
      score: Math.round(correct * 0.2 * 10) / 10,
      max_score: Math.round(maxQ * 0.2 * 10) / 10
    };
  });

  const now = new Date();
  const submittedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} · ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  const studentName = (payload.student_name || '').trim() || 'Not entered';
  const studentClass = (payload.student_class || '').trim() || '—';

  const record = {
    id: `${Date.now()}-${exam.id}`,
    test_id: exam.id,
    test_title: exam.title,
    category: exam.category,
    student_name: studentName,
    student_class: studentClass,
    total_correct: totalCorrect,
    total_questions: totalQuestions,
    ten_scale: tenScale,
    accuracy_percent: accuracyPercent,
    elapsed_seconds: payload.elapsed_seconds || 0,
    submitted_at: submittedAt
  };
  const history = getStaticHistory();
  history.unshift(record);
  saveStaticHistory(history);

  return {
    test_id: exam.id,
    test_title: exam.title,
    student_name: studentName,
    student_class: studentClass,
    submitted_at: submittedAt,
    elapsed_seconds: payload.elapsed_seconds || 0,
    total_correct: totalCorrect,
    total_questions: totalQuestions,
    ten_scale: tenScale,
    accuracy_percent: accuracyPercent,
    parts,
    results,
    answer_key: answerKey
  };
}

// ==================== HUB VIEW ====================
async function loadAndRenderHub() {
  resetThemeToDefault();
  state.currentExam = null;
  state.lastReport = null;
  document.title = 'A2.1 – Progress Test 2 Practice Portal';

  try {
    if (!state.staticMode) {
      const [testsRes, histRes] = await Promise.all([
        fetch('/api/tests'),
        fetch('/api/history')
      ]);
      if (testsRes.ok && histRes.ok) {
        state.tests = await testsRes.json();
        state.history = await histRes.json();
        renderHub();
        return;
      }
      state.staticMode = true;
    }

    const exams = await ensureStaticExamsLoaded();
    const history = getStaticHistory();
    state.history = history;
    state.tests = exams.map(exam => {
      const attempts = history.filter(h => h.test_id === exam.id);
      const bestTen = attempts.length ? Math.max(...attempts.map(a => a.ten_scale)) : null;
      const bestCorrect = attempts.length ? Math.max(...attempts.map(a => a.total_correct)) : null;
      return {
        id: exam.id,
        slug: exam.slug,
        category: exam.category,
        badge: exam.badge,
        title: exam.title,
        subtitle: exam.subtitle,
        topic: exam.topic,
        duration_minutes: exam.duration_minutes,
        question_count: 50,
        theme: exam.theme,
        attempt_count: attempts.length,
        best_score_ten: bestTen,
        best_correct: bestCorrect
      };
    });
    renderHub();
  } catch (err) {
    appEl.innerHTML = `<div class="loading-screen"><p>Không thể tải dữ liệu đề thi: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderHub() {
  const refTests = state.tests.filter(t => t.category === 'reference');
  const pracTests = state.tests.filter(t => t.category === 'practice');
  const completedCount = state.tests.filter(t => t.attempt_count > 0).length;
  const bestScores = state.tests.map(t => t.best_score_ten).filter(s => s !== null && s !== undefined);
  const avgScore = bestScores.length
    ? (bestScores.reduce((a, b) => a + b, 0) / bestScores.length).toFixed(1)
    : '—';

  const query = state.search.trim().toLowerCase();
  const filtered = state.tests.filter(t => {
    if (state.filter !== 'all' && t.category !== state.filter) return false;
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      t.topic.toLowerCase().includes(query) ||
      t.badge.toLowerCase().includes(query) ||
      t.subtitle.toLowerCase().includes(query)
    );
  });

  appEl.innerHTML = `
    <header class="hub-header">
      <span class="eyebrow">CEFR A2.1 · Progress Test 2 · Rust + Axum</span>
      <h1>Hệ Thống Luyện Thi A2.1 – Progress Test 2 (13 Đề)</h1>
      <p>Bao gồm <b>3 đề gốc</b> tham chiếu từ Google Sites và <b>10 đề phát triển mới</b> (500 câu mới, tổng 650 câu) chuẩn cấu trúc 50 câu / 40 phút với chấm điểm tự động phía server.</p>
    </header>

    <main class="hub-main">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-val">${state.tests.length}</div>
          <div class="stat-lbl">Tổng số đề thi (${refTests.length} gốc + ${pracTests.length} mới)</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${state.tests.length * 50}</div>
          <div class="stat-lbl">Tổng số câu hỏi (50 câu/đề)</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${completedCount} / ${state.tests.length}</div>
          <div class="stat-lbl">Số đề đã làm</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${avgScore}${avgScore !== '—' ? ' / 10' : ''}</div>
          <div class="stat-lbl">Điểm cao nhất trung bình</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="filter-tabs">
          <button class="filter-btn ${state.filter === 'all' ? 'active' : ''}" data-filter="all">Tất cả (${state.tests.length})</button>
          <button class="filter-btn ${state.filter === 'reference' ? 'active' : ''}" data-filter="reference">Đề gốc (${refTests.length})</button>
          <button class="filter-btn ${state.filter === 'practice' ? 'active' : ''}" data-filter="practice">Đề phát triển mới (${pracTests.length})</button>
        </div>
        <div class="search-box">
          <input type="search" id="hubSearch" placeholder="Tìm theo chủ đề hoặc tên đề..." value="${escapeHtml(state.search)}">
        </div>
      </div>

      <div class="tests-grid">
        ${filtered.length ? filtered.map(renderTestCard).join('') : '<p style="grid-column:1/-1;text-align:center;color:#64748b">Không tìm thấy đề thi phù hợp.</p>'}
      </div>

      <section class="history-card">
        <div class="history-head">
          <h2>Lịch sử làm bài gần đây (${state.history.length})</h2>
          ${state.history.length ? '<button type="button" class="ghost-btn" id="clearHistoryBtn">Xoá lịch sử</button>' : ''}
        </div>
        ${renderHistoryTable(state.history)}
      </section>
    </main>
  `;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      renderHub();
    });
  });

  const searchInp = document.getElementById('hubSearch');
  if (searchInp) {
    searchInp.addEventListener('input', e => {
      state.search = e.target.value;
      renderHub();
      const el = document.getElementById('hubSearch');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  document.querySelectorAll('.start-test-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`/test/${btn.dataset.id}`);
    });
  });

  const clearBtn = document.getElementById('clearHistoryBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (state.staticMode) {
        saveStaticHistory([]);
      } else {
        await fetch('/api/history', { method: 'DELETE' });
      }
      state.history = [];
      await loadAndRenderHub();
    });
  }
}

function renderTestCard(t) {
  const bestBadge = t.best_score_ten !== null && t.best_score_ten !== undefined
    ? `<span class="best-pill">Best: ${t.best_score_ten.toFixed(1)}/10 (${t.best_correct}/50)</span>`
    : '';
  const btnText = t.attempt_count > 0 ? 'Làm lại đề này' : 'Bắt đầu làm bài';

  return `
    <article class="test-card">
      <div class="card-stripe" style="background:linear-gradient(90deg, ${escapeHtml(t.theme.primary)}, ${escapeHtml(t.theme.bright)})"></div>
      <div class="card-body">
        <div class="card-top">
          <span class="cat-badge" style="background:${escapeHtml(t.theme.soft)};color:${escapeHtml(t.theme.dark)};border:1px solid ${escapeHtml(t.theme.line)}">${escapeHtml(t.badge)}</span>
          ${bestBadge}
        </div>
        <h3>${escapeHtml(t.title)}</h3>
        <div class="card-topic"><b>Chủ đề:</b> ${escapeHtml(t.topic)}</div>
        <div class="card-meta">
          <span>📝 ${t.question_count} câu hỏi</span>
          <span>⏱ ${t.duration_minutes} phút</span>
          <span>📊 ${t.attempt_count} lượt làm</span>
        </div>
        <button type="button" class="card-btn start-test-btn" data-id="${t.id}" style="background:linear-gradient(120deg, ${escapeHtml(t.theme.primary)}, ${escapeHtml(t.theme.accent)})">${btnText}</button>
      </div>
    </article>
  `;
}

function renderHistoryTable(history) {
  if (!history.length) {
    return '<p style="margin:0;color:#64748b;font-size:14px">Chưa có lượt nộp bài nào. Hãy chọn một đề thi ở trên để bắt đầu!</p>';
  }
  return `
    <div class="table-wrap">
      <table class="history-table">
        <thead>
          <tr>
            <th>Đề thi</th>
            <th>Thí sinh</th>
            <th>Lớp</th>
            <th>Số câu đúng</th>
            <th>Điểm (/10)</th>
            <th>Thời gian làm</th>
            <th>Nộp lúc</th>
          </tr>
        </thead>
        <tbody>
          ${history.slice(0, 25).map(h => `
            <tr>
              <td><a href="/test/${h.test_id}" class="hist-link" data-id="${h.test_id}" style="font-weight:700;color:#1d4ed8;text-decoration:none">${escapeHtml(h.test_title)}</a></td>
              <td>${escapeHtml(h.student_name)}</td>
              <td>${escapeHtml(h.student_class)}</td>
              <td><b>${h.total_correct}</b> / ${h.total_questions} (${h.accuracy_percent}%)</td>
              <td><b style="color:#059669">${h.ten_scale.toFixed(1)} / 10</b></td>
              <td>${formatDuration(h.elapsed_seconds)}</td>
              <td>${escapeHtml(h.submitted_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

appEl.addEventListener('click', e => {
  const link = e.target.closest('a.hist-link');
  if (link) {
    e.preventDefault();
    navigate(`/test/${link.dataset.id}`);
  }
});

// ==================== EXAM RUNNER VIEW ====================
async function loadAndRenderExam(id) {
  appEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Đang tải đề thi...</p></div>';
  try {
    let exam = null;
    if (!state.staticMode) {
      const res = await fetch(`/api/tests/${id}`);
      if (res.ok) {
        exam = await res.json();
      } else if (res.status === 404) {
        appEl.innerHTML = `<div class="loading-screen"><p>Không tìm thấy đề thi #${id}.</p><button class="main-btn" onclick="history.back()">Quay lại</button></div>`;
        return;
      } else {
        state.staticMode = true;
      }
    }
    if (!exam) {
      const exams = await ensureStaticExamsLoaded();
      const raw = exams.find(e => e.id === id);
      if (!raw) {
        appEl.innerHTML = `<div class="loading-screen"><p>Không tìm thấy đề thi #${id}.</p><button class="main-btn" onclick="history.back()">Quay lại</button></div>`;
        return;
      }
      exam = toPublicExam(raw);
    }
    state.currentExam = exam;
    state.lastReport = null;
    state.remainingSeconds = exam.duration_minutes * 60;
    state.elapsedSeconds = 0;
    state.timerPaused = false;
    applyExamTheme(exam.theme);
    document.title = exam.title;
    renderExam(exam);
    restoreDraft(exam.id);
    startTimer();
    window.scrollTo({ top: 0, behavior: 'auto' });
  } catch (err) {
    appEl.innerHTML = `<div class="loading-screen"><p>Lỗi tải đề thi: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderExam(exam) {
  const p1Opts = `<option value="">-- choose --</option>` +
    exam.word_bank.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
  const matchOpts = `<option value="">--</option>` +
    exam.sec_a_part3_responses.map(r => `<option value="${escapeHtml(r.letter)}">${escapeHtml(r.letter)}</option>`).join('');

  const navDots = Array.from({ length: 50 }, (_, idx) => {
    const q = idx + 1;
    return `<button type="button" class="nav-dot" data-nav-q="${q}">${q}</button>`;
  }).join('');

  appEl.innerHTML = `
    <header class="exam-header">
      <div class="header-badge">${escapeHtml(exam.badge)} · 50 QUESTIONS · ${exam.duration_minutes} MINUTES</div>
      <h1>${escapeHtml(exam.title)}</h1>
      <p>${escapeHtml(exam.subtitle)}</p>
    </header>

    <main class="exam-main">
      <div class="exam-topbar">
        <div class="topbar-row">
          <div class="topbar-left">
            <button type="button" class="back-btn" id="backToHub">← Danh sách đề</button>
            <strong style="color:var(--dark);font-size:14.5px">${escapeHtml(exam.topic)}</strong>
          </div>
          <div class="topbar-controls">
            <div class="timer-pill" id="timerPill">
              <span>⏱ <span id="timerText">${formatDuration(state.remainingSeconds)}</span></span>
              <button type="button" class="mini-btn" id="toggleTimerBtn">Pause</button>
            </div>
            <button type="button" class="back-btn" id="toggleNavBtn">Bảng câu (1–50)</button>
          </div>
        </div>
        <div class="progress-row">
          <div class="progress-top">
            <span>Progress</span>
            <span id="count">0 / 50 answered</span>
          </div>
          <div class="track"><div class="fill" id="fill"></div></div>
        </div>
        <div class="nav-drawer" id="navDrawer">
          <div class="nav-grid">${navDots}</div>
        </div>
      </div>

      <div class="student-card">
        <div class="student-field">
          <label for="studentName">Student Name</label>
          <input type="text" id="studentName" placeholder="Enter your full name...">
        </div>
        <div class="student-field" style="max-width:260px">
          <label for="studentClass">Class (Optional)</label>
          <input type="text" id="studentClass" placeholder="e.g., A2.1 - Class 01">
        </div>
      </div>

      <div class="sec-banner">Section A: Vocabulary <span>30 questions</span></div>

      <section class="part-section">
        <h2><span class="tag">PART 1</span>Complete the sentences with the words in the box.</h2>
        <p class="small">There are TWO extra words. Click a word chip to fill the active/next empty gap, or choose from each dropdown. (Questions 1–10)</p>
        <div class="word-bank" id="wordBank">
          ${exam.word_bank.map(w => `<span class="bank-chip" data-word="${escapeHtml(w)}">${escapeHtml(w)}</span>`).join('')}
        </div>
        <div id="secA_part1">
          ${exam.sec_a_part1.map(item => `
            <div class="q-row" id="q-wrap-${item.num}" data-q="${item.num}">
              <b>${item.num}.</b> ${escapeHtml(item.pre)}
              <select class="inline-select p1-select" data-q="${item.num}" aria-label="Question ${item.num}">${p1Opts}</select>
              ${escapeHtml(item.post)}
              <span class="ans-slot"></span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="part-section">
        <h2><span class="tag">PART 2</span>Read the passage. Are the sentences True or False?</h2>
        <p class="small">Read the text on the left and choose True or False on the right. (Questions 11–18)</p>
        <div class="split-wrap">
          <div class="passage-sticky">
            <h3>${escapeHtml(exam.passage.title)}</h3>
            <div class="sub">${escapeHtml(exam.passage.subtitle)}</div>
            ${exam.passage.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
          </div>
          <div class="tf-list" id="secA_part2">
            ${exam.sec_a_part2.map(item => `
              <div class="tf-item" id="q-wrap-${item.num}" data-q="${item.num}">
                <div><b>${item.num}.</b> ${escapeHtml(item.statement)} <span class="ans-slot"></span></div>
                <div class="tf-opts">
                  <label class="pill-radio"><input type="radio" name="q${item.num}" value="True"> True</label>
                  <label class="pill-radio"><input type="radio" name="q${item.num}" value="False"> False</label>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="part-section">
        <h2><span class="tag">PART 3</span>Match the questions 19–24 with responses a–f.</h2>
        <p class="small">Select the matching response letter (a–f) for each question. (Questions 19–24)</p>
        <div class="match-grid">
          <div id="secA_part3">
            ${exam.sec_a_part3.map(item => `
              <div class="q-row match-row" id="q-wrap-${item.num}" data-q="${item.num}">
                <span><b>${item.num}.</b> ${escapeHtml(item.question)}</span>
                <div>
                  <select class="inline-select" style="min-width:74px" data-q="${item.num}" aria-label="Question ${item.num}">${matchOpts}</select>
                  <span class="ans-slot"></span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="resp-box">
            <h4>Responses (a–f)</h4>
            ${exam.sec_a_part3_responses.map(r => `
              <div class="resp-line"><b>${escapeHtml(r.letter)}.</b> ${escapeHtml(r.text)}</div>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="part-section">
        <h2><span class="tag">PART 4</span>Each sentence contains one spelling mistake. Write the correct word.</h2>
        <p class="small">Look at the bold misspelled word and type the correct spelling in the box next to each sentence. (Questions 25–30)</p>
        <div id="secA_part4">
          ${exam.sec_a_part4.map(item => `
            <div class="q-row" id="q-wrap-${item.num}" data-q="${item.num}">
              <div class="spell-row">
                <div class="spell-sent"><b>${item.num}.</b> ${escapeHtml(item.pre)}<b class="wrong-word">${escapeHtml(item.wrong_word)}</b>${escapeHtml(item.post)}</div>
                <div class="spell-ctrl">
                  <input type="text" class="inline-input spell-input" data-q="${item.num}" placeholder="Correct word..." aria-label="Question ${item.num}">
                  <span class="ans-slot"></span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="sec-banner">Section B: Grammar <span>20 questions</span></div>

      <section class="part-section">
        <h2><span class="tag">PART 1</span>Choose the correct answer for each question.</h2>
        <p class="small">Click the correct word or phrase to complete each sentence. (Questions 31–40)</p>
        <div id="secB_part1">
          ${exam.sec_b_part1.map(item => `
            <div class="q-row" id="q-wrap-${item.num}" data-q="${item.num}">
              <div><b>${item.num}.</b> ${escapeHtml(item.sentence)} <span class="ans-slot"></span></div>
              <div class="gram-opts">
                ${item.options.map(opt => `
                  <label class="pill-radio"><input type="radio" name="q${item.num}" value="${escapeHtml(opt)}"> ${escapeHtml(opt)}</label>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="part-section">
        <h2><span class="tag">PART 2</span>Put the words in the correct order.</h2>
        <p class="small">Click the word blocks below each box to build the sentence. Click a placed block to return it. (Questions 41–45)</p>
        <div id="secB_part2">
          ${exam.sec_b_part2.map(item => `
            <div class="order-card" id="q-wrap-${item.num}" data-q="${item.num}">
              <div class="order-head">
                <div><b>${item.num}.</b> <span class="ans-slot"></span></div>
                <button type="button" class="clear-blocks-btn" data-clear="${item.num}">Clear</button>
              </div>
              <div class="answer-tray" data-tray="${item.num}"></div>
              <div class="block-pool" data-pool="${item.num}">
                ${item.blocks.map((blk, idx) => `<span class="word-block" data-q="${item.num}" data-idx="${idx}" data-text="${escapeHtml(blk)}">${escapeHtml(blk)}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="part-section">
        <h2><span class="tag">PART 3</span>Write the correct form of the words in brackets.</h2>
        <p class="small">Type the correct grammatical form in each gap. (Questions 46–50)</p>
        <div id="secB_part3">
          ${exam.sec_b_part3.map(item => `
            <div class="q-row" id="q-wrap-${item.num}" data-q="${item.num}">
              <b>${item.num}.</b> ${escapeHtml(item.pre)}
              <input type="text" class="inline-input form-input" data-q="${item.num}" placeholder="Write form..." aria-label="Question ${item.num}">
              ${escapeHtml(item.post)}
              <span class="ans-slot"></span>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="actions">
        <button type="button" class="main-btn" id="submitBtn">Submit Answers</button>
        <button type="button" class="main-btn secondary" id="resetBtn">Reset Test</button>
      </div>

      <div id="result"></div>

      <footer>${escapeHtml(exam.title)} · 50 questions · ${exam.duration_minutes} minutes</footer>
    </main>
  `;

  bindExamEvents(exam);
}

function bindExamEvents(exam) {
  state.activePart1Select = document.querySelector('.p1-select');

  document.getElementById('backToHub').addEventListener('click', () => navigate('/'));

  document.getElementById('toggleNavBtn').addEventListener('click', () => {
    document.getElementById('navDrawer').classList.toggle('open');
  });

  document.getElementById('toggleTimerBtn').addEventListener('click', () => {
    state.timerPaused = !state.timerPaused;
    document.getElementById('toggleTimerBtn').textContent = state.timerPaused ? 'Resume' : 'Pause';
  });

  document.querySelectorAll('.nav-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const target = document.getElementById(`q-wrap-${dot.dataset.navQ}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.getElementById('secA_part1').addEventListener('focusin', e => {
    const sel = e.target.closest('.p1-select');
    if (sel) state.activePart1Select = sel;
  });

  document.getElementById('wordBank').addEventListener('click', e => {
    const chip = e.target.closest('.bank-chip');
    if (!chip) return;
    const word = chip.dataset.word;
    const selects = Array.from(document.querySelectorAll('.p1-select'));
    const target = (state.activePart1Select && !state.activePart1Select.value)
      ? state.activePart1Select
      : selects.find(s => !s.value) || state.activePart1Select;

    if (target) {
      target.value = word;
      const nextEmpty = selects.find(s => !s.value);
      if (nextEmpty) state.activePart1Select = nextEmpty;
      syncWordBank();
      updateProgress();
      saveDraft(exam.id);
    }
  });

  document.getElementById('secB_part2').addEventListener('click', e => {
    const poolBlock = e.target.closest('.block-pool .word-block');
    if (poolBlock) {
      placeWordBlock(poolBlock);
      updateProgress();
      saveDraft(exam.id);
      return;
    }

    const trayBlock = e.target.closest('.answer-tray .word-block');
    if (trayBlock) {
      const q = trayBlock.dataset.q;
      const idx = trayBlock.dataset.idx;
      trayBlock.remove();
      const orig = document.querySelector(`.block-pool[data-pool="${q}"] .word-block[data-idx="${idx}"]`);
      if (orig) orig.classList.remove('placed-hidden');
      updateProgress();
      saveDraft(exam.id);
      return;
    }

    const clearBtn = e.target.closest('.clear-blocks-btn');
    if (clearBtn) {
      const q = clearBtn.dataset.clear;
      document.querySelector(`.answer-tray[data-tray="${q}"]`).innerHTML = '';
      document.querySelectorAll(`.block-pool[data-pool="${q}"] .word-block`).forEach(b => b.classList.remove('placed-hidden'));
      updateProgress();
      saveDraft(exam.id);
    }
  });

  document.querySelector('.exam-main').addEventListener('change', () => {
    syncWordBank();
    updateProgress();
    saveDraft(exam.id);
  });

  document.querySelector('.exam-main').addEventListener('input', () => {
    updateProgress();
    saveDraft(exam.id);
  });

  document.getElementById('submitBtn').addEventListener('click', () => submitExam(exam));
  document.getElementById('resetBtn').addEventListener('click', () => resetExam(exam));
}

function placeWordBlock(poolBlock) {
  const q = poolBlock.dataset.q;
  const idx = poolBlock.dataset.idx;
  const text = poolBlock.dataset.text;
  poolBlock.classList.add('placed-hidden');

  const tray = document.querySelector(`.answer-tray[data-tray="${q}"]`);
  const item = document.createElement('span');
  item.className = 'word-block in-tray';
  item.dataset.q = q;
  item.dataset.idx = idx;
  item.dataset.text = text;
  item.textContent = text;
  tray.appendChild(item);
}

function syncWordBank() {
  const used = new Set();
  document.querySelectorAll('.p1-select').forEach(s => {
    if (s.value) used.add(s.value);
  });
  document.querySelectorAll('.bank-chip').forEach(chip => {
    chip.classList.toggle('used', used.has(chip.dataset.word));
  });
}

function collectAnswers() {
  const answers = {};
  document.querySelectorAll('select[data-q]').forEach(s => {
    if (s.value) answers[Number(s.dataset.q)] = s.value;
  });
  for (let q = 11; q <= 18; q++) {
    const chk = document.querySelector(`input[name="q${q}"]:checked`);
    if (chk) answers[q] = chk.value;
  }
  for (let q = 31; q <= 40; q++) {
    const chk = document.querySelector(`input[name="q${q}"]:checked`);
    if (chk) answers[q] = chk.value;
  }
  document.querySelectorAll('input[data-q]').forEach(inp => {
    if (inp.value.trim()) answers[Number(inp.dataset.q)] = inp.value;
  });
  for (let q = 41; q <= 45; q++) {
    const tray = document.querySelector(`.answer-tray[data-tray="${q}"]`);
    if (tray && tray.children.length > 0) {
      answers[q] = Array.from(tray.querySelectorAll('.word-block')).map(b => b.dataset.text);
    }
  }
  return answers;
}

function updateProgress() {
  const answers = collectAnswers();
  const answeredCount = Object.keys(answers).length;
  const countEl = document.getElementById('count');
  const fillEl = document.getElementById('fill');
  if (countEl) countEl.textContent = `${answeredCount} / 50 answered`;
  if (fillEl) fillEl.style.width = `${(answeredCount / 50) * 100}%`;

  if (!state.lastReport) {
    document.querySelectorAll('.nav-dot').forEach(dot => {
      const q = Number(dot.dataset.navQ);
      dot.classList.toggle('answered', Boolean(answers[q]));
    });
  }
}

function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    if (state.timerPaused) return;
    state.elapsedSeconds += 1;
    if (state.remainingSeconds > 0) {
      state.remainingSeconds -= 1;
    }
    const timerText = document.getElementById('timerText');
    const timerPill = document.getElementById('timerPill');
    if (timerText) timerText.textContent = formatDuration(state.remainingSeconds);
    if (timerPill) timerPill.classList.toggle('warning', state.remainingSeconds <= 300);
  }, 1000);
}

function saveDraft(testId) {
  try {
    const payload = {
      studentName: document.getElementById('studentName')?.value || '',
      studentClass: document.getElementById('studentClass')?.value || '',
      answers: collectAnswers()
    };
    localStorage.setItem(`a2_draft_test_${testId}`, JSON.stringify(payload));
  } catch (_) {}
}

function restoreDraft(testId) {
  try {
    const raw = localStorage.getItem(`a2_draft_test_${testId}`);
    if (!raw) {
      updateProgress();
      return;
    }
    const draft = JSON.parse(raw);
    if (draft.studentName) document.getElementById('studentName').value = draft.studentName;
    if (draft.studentClass) document.getElementById('studentClass').value = draft.studentClass;
    const ans = draft.answers || {};

    Object.entries(ans).forEach(([qStr, val]) => {
      const q = Number(qStr);
      const sel = document.querySelector(`select[data-q="${q}"]`);
      if (sel && typeof val === 'string') {
        sel.value = val;
        return;
      }
      const radio = document.querySelector(`input[name="q${q}"][value="${CSS.escape(String(val))}"]`);
      if (radio) {
        radio.checked = true;
        return;
      }
      const inp = document.querySelector(`input[data-q="${q}"]`);
      if (inp && typeof val === 'string') {
        inp.value = val;
        return;
      }
      if (Array.isArray(val) && q >= 41 && q <= 45) {
        val.forEach(wordText => {
          const poolBlocks = Array.from(document.querySelectorAll(`.block-pool[data-pool="${q}"] .word-block:not(.placed-hidden)`));
          const match = poolBlocks.find(b => b.dataset.text === wordText);
          if (match) placeWordBlock(match);
        });
      }
    });

    syncWordBank();
    updateProgress();
  } catch (_) {
    updateProgress();
  }
}

async function submitExam(exam) {
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Grading...';

  try {
    const payload = {
      student_name: document.getElementById('studentName').value.trim(),
      student_class: document.getElementById('studentClass').value.trim(),
      elapsed_seconds: state.elapsedSeconds,
      answers: collectAnswers()
    };

    let report;
    if (state.staticMode) {
      const exams = await ensureStaticExamsLoaded();
      const raw = exams.find(e => e.id === exam.id);
      if (!raw) throw new Error('Exam not found');
      report = gradeExamLocally(raw, payload);
    } else {
      const res = await fetch(`/api/tests/${exam.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Grading failed');
      report = await res.json();
    }
    state.lastReport = report;
    state.timerPaused = true;
    const toggleTimerBtn = document.getElementById('toggleTimerBtn');
    if (toggleTimerBtn) toggleTimerBtn.textContent = 'Paused';

    applyGradingHighlights(report);
    renderScoreReport(exam, report);
  } catch (err) {
    alert(`Lỗi khi chấm bài: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answers';
  }
}

function applyGradingHighlights(report) {
  document.querySelectorAll('.ans-slot').forEach(el => { el.innerHTML = ''; });
  document.querySelectorAll('.q-row, .tf-item, .order-card').forEach(el => el.classList.remove('correct', 'incorrect'));
  document.querySelectorAll('.pill-radio').forEach(el => el.classList.remove('right-choice', 'wrong-choice'));
  document.querySelectorAll('select, input.inline-input').forEach(el => el.classList.remove('correct', 'incorrect'));

  report.results.forEach(r => {
    const wrap = document.getElementById(`q-wrap-${r.num}`);
    if (wrap) {
      wrap.classList.add(r.is_correct ? 'correct' : 'incorrect');
      const slot = wrap.querySelector('.ans-slot');
      if (slot) {
        slot.innerHTML = r.is_correct
          ? `<span class="ans-badge">✓ ${escapeHtml(r.correct_answer)}</span>`
          : `<span class="ans-badge is-wrong">${escapeHtml(r.correct_answer)}</span>`;
      }
      const ctrl = wrap.querySelector('select[data-q], input[data-q]');
      if (ctrl) ctrl.classList.add(r.is_correct ? 'correct' : 'incorrect');

      const radios = wrap.querySelectorAll(`input[name="q${r.num}"]`);
      if (radios.length) {
        radios.forEach(rad => {
          if (rad.value === r.correct_answer) {
            rad.closest('.pill-radio')?.classList.add('right-choice');
          } else if (rad.checked && !r.is_correct) {
            rad.closest('.pill-radio')?.classList.add('wrong-choice');
          }
        });
      }
    }

    const navDot = document.querySelector(`.nav-dot[data-nav-q="${r.num}"]`);
    if (navDot) {
      navDot.classList.remove('answered', 'correct', 'incorrect');
      navDot.classList.add(r.is_correct ? 'correct' : 'incorrect');
    }
  });
}

function renderScoreReport(exam, report) {
  const nextId = exam.id < 13 ? exam.id + 1 : 1;
  const resultBox = document.getElementById('result');
  resultBox.style.display = 'block';
  resultBox.innerHTML = `
    <div class="res-header">
      <h3>TEST SCORE REPORT</h3>
      <div class="student-info-bar">
        <span>Student Name: <b>${escapeHtml(report.student_name)}</b></span>
        <span>Class: <b>${escapeHtml(report.student_class)}</b></span>
        <span>Duration: <b>${formatDuration(report.elapsed_seconds)}</b></span>
        <span>Submitted: <b>${escapeHtml(report.submitted_at)}</b></span>
      </div>
      <div class="score-highlight">
        <div class="score-pill">
          <div class="num">${report.total_correct} / ${report.total_questions}</div>
          <div class="lbl">Correct Answers</div>
        </div>
        <div class="score-pill secondary">
          <div class="num">${report.ten_scale.toFixed(1)} / 10</div>
          <div class="lbl">10-Point Scale (0.2/q)</div>
        </div>
        <div class="score-pill secondary">
          <div class="num">${report.accuracy_percent}%</div>
          <div class="lbl">Accuracy</div>
        </div>
      </div>
    </div>

    <table class="score-table">
      <thead>
        <tr>
          <th>Section &amp; Part</th>
          <th>Questions</th>
          <th>Correct</th>
          <th>Incorrect / Blank</th>
          <th>Section Score</th>
        </tr>
      </thead>
      <tbody>
        ${report.parts.map(p => `
          <tr>
            <td style="text-align:left;font-weight:600">${escapeHtml(p.title)}</td>
            <td>${p.total_questions}</td>
            <td style="color:#059669;font-weight:700">${p.correct}</td>
            <td style="color:${p.incorrect > 0 ? '#e11d48' : '#059669'}">${p.incorrect}</td>
            <td><b>${p.score.toFixed(1)}</b> / ${p.max_score.toFixed(1)}</td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td style="text-align:left">TOTAL SCORE</td>
          <td>${report.total_questions}</td>
          <td style="color:#059669">${report.total_correct}</td>
          <td>${report.total_questions - report.total_correct}</td>
          <td>${report.ten_scale.toFixed(1)} / 10</td>
        </tr>
      </tbody>
    </table>

    <div class="key-box">
      <h4>FULL ANSWER KEY (Q1–Q50)</h4>
      <div class="key-grid">
        ${report.answer_key.map(k => `
          <div class="key-item"><span>Q${k.num}:</span><span class="ans-val">${escapeHtml(k.answer)}</span></div>
        `).join('')}
      </div>
    </div>

    <div class="actions" style="margin-bottom:0">
      <button type="button" class="main-btn" id="printReportBtn">Print / Save PDF</button>
      <button type="button" class="main-btn secondary" id="retakeBtn">Retake Test</button>
      <button type="button" class="main-btn" id="nextTestBtn">Next Test (Test ${nextId}) →</button>
    </div>
  `;

  document.getElementById('printReportBtn').addEventListener('click', () => window.print());
  document.getElementById('retakeBtn').addEventListener('click', () => resetExam(exam));
  document.getElementById('nextTestBtn').addEventListener('click', () => navigate(`/test/${nextId}`));

  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetExam(exam) {
  try {
    localStorage.removeItem(`a2_draft_test_${exam.id}`);
  } catch (_) {}
  state.lastReport = null;
  state.remainingSeconds = exam.duration_minutes * 60;
  state.elapsedSeconds = 0;
  state.timerPaused = false;

  document.querySelectorAll('select[data-q]').forEach(s => {
    s.selectedIndex = 0;
    s.classList.remove('correct', 'incorrect');
  });
  document.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; });
  document.querySelectorAll('input.inline-input').forEach(inp => {
    inp.value = '';
    inp.classList.remove('correct', 'incorrect');
  });
  document.querySelectorAll('.answer-tray').forEach(t => { t.innerHTML = ''; });
  document.querySelectorAll('.block-pool .word-block').forEach(b => b.classList.remove('placed-hidden'));
  document.querySelectorAll('.q-row, .tf-item, .order-card').forEach(el => el.classList.remove('correct', 'incorrect'));
  document.querySelectorAll('.pill-radio').forEach(el => el.classList.remove('right-choice', 'wrong-choice'));
  document.querySelectorAll('.ans-slot').forEach(el => { el.innerHTML = ''; });
  document.querySelectorAll('.nav-dot').forEach(dot => dot.classList.remove('answered', 'correct', 'incorrect'));
  const resultBox = document.getElementById('result');
  if (resultBox) {
    resultBox.style.display = 'none';
    resultBox.innerHTML = '';
  }
  const timerText = document.getElementById('timerText');
  const timerPill = document.getElementById('timerPill');
  const toggleBtn = document.getElementById('toggleTimerBtn');
  if (timerText) timerText.textContent = formatDuration(state.remainingSeconds);
  if (timerPill) timerPill.classList.remove('warning');
  if (toggleBtn) toggleBtn.textContent = 'Pause';

  state.activePart1Select = document.querySelector('.p1-select');
  syncWordBank();
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

handleRoute();
