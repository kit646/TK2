use crate::loader::normalize_word_order_text;
use crate::models::{
    AnswerKeyItem, AnswerValue, ExamTest, GradeReport, PartBreakdown, QuestionResult, SubmitRequest,
};
use chrono::Local;

fn normalize_text(raw: &str) -> String {
    raw.trim()
        .replace('’', "'")
        .replace('‘', "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn get_text_answer(req: &SubmitRequest, num: u8) -> String {
    match req.answers.get(&num) {
        Some(AnswerValue::Text(s)) => s.trim().to_string(),
        Some(AnswerValue::Blocks(b)) => b.join(" ").trim().to_string(),
        None => String::new(),
    }
}

fn get_block_answers(req: &SubmitRequest, num: u8) -> Vec<String> {
    match req.answers.get(&num) {
        Some(AnswerValue::Blocks(b)) => b.clone(),
        Some(AnswerValue::Text(s)) => {
            if s.trim().is_empty() {
                Vec::new()
            } else {
                s.split_whitespace().map(ToString::to_string).collect()
            }
        }
        None => Vec::new(),
    }
}

pub fn grade_exam(exam: &ExamTest, req: &SubmitRequest) -> GradeReport {
    let mut part_counts = [0usize; 7];
    let mut results = Vec::with_capacity(50);
    let mut answer_key = Vec::with_capacity(50);

    // 1. Section A - Part 1 (Q1-10)
    for item in &exam.sec_a_part1 {
        let user = get_text_answer(req, item.num);
        let is_correct = normalize_text(&user) == normalize_text(&item.answer);
        if is_correct {
            part_counts[0] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section A – Part 1".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.answer.clone(),
        });
    }

    // 2. Section A - Part 2 (Q11-18)
    for item in &exam.sec_a_part2 {
        let user = get_text_answer(req, item.num);
        let is_correct = normalize_text(&user) == normalize_text(&item.answer);
        if is_correct {
            part_counts[1] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section A – Part 2".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.answer.clone(),
        });
    }

    // 3. Section A - Part 3 (Q19-24)
    for item in &exam.sec_a_part3 {
        let user = get_text_answer(req, item.num);
        let is_correct = normalize_text(&user) == normalize_text(&item.answer);
        if is_correct {
            part_counts[2] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section A – Part 3".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.answer.clone(),
        });
    }

    // 4. Section A - Part 4 (Q25-30)
    for item in &exam.sec_a_part4 {
        let user = get_text_answer(req, item.num);
        let is_correct = normalize_text(&user) == normalize_text(&item.answer);
        if is_correct {
            part_counts[3] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section A – Part 4".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.answer.clone(),
        });
    }

    // 5. Section B - Part 1 (Q31-40)
    for item in &exam.sec_b_part1 {
        let user = get_text_answer(req, item.num);
        let is_correct = normalize_text(&user) == normalize_text(&item.answer);
        if is_correct {
            part_counts[4] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section B – Part 1".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.answer.clone(),
        });
    }

    // 6. Section B - Part 2 (Q41-45)
    for item in &exam.sec_b_part2 {
        let chosen_blocks = get_block_answers(req, item.num);
        let joined = chosen_blocks.join(" ");
        let norm = normalize_word_order_text(&joined);
        let is_correct = chosen_blocks.len() == item.blocks.len()
            && item.accepted.iter().any(|acc| normalize_word_order_text(acc) == norm);
        if is_correct {
            part_counts[5] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section B – Part 2".to_string(),
            is_correct,
            user_answer: joined,
            correct_answer: item.display_answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.display_answer.clone(),
        });
    }

    // 7. Section B - Part 3 (Q46-50)
    for item in &exam.sec_b_part3 {
        let user = get_text_answer(req, item.num);
        let norm = normalize_text(&user);
        let is_correct = item
            .accepted
            .iter()
            .any(|acc| normalize_text(acc) == norm);
        if is_correct {
            part_counts[6] += 1;
        }
        results.push(QuestionResult {
            num: item.num,
            part: "Section B – Part 3".to_string(),
            is_correct,
            user_answer: user,
            correct_answer: item.display_answer.clone(),
        });
        answer_key.push(AnswerKeyItem {
            num: item.num,
            answer: item.display_answer.clone(),
        });
    }

    let total_correct: usize = part_counts.iter().sum();
    let total_questions = 50usize;
    let ten_scale = ((total_correct as f64 / total_questions as f64) * 10.0 * 10.0).round() / 10.0;
    let accuracy_percent =
        ((total_correct as f64 / total_questions as f64) * 100.0).round() as u32;

    let part_meta = [
        ("Section A – Part 1 (Word Box: 1–10)", 10usize),
        ("Section A – Part 2 (Reading T/F: 11–18)", 8usize),
        ("Section A – Part 3 (Matching: 19–24)", 6usize),
        ("Section A – Part 4 (Spelling: 25–30)", 6usize),
        ("Section B – Part 1 (Grammar Choice: 31–40)", 10usize),
        ("Section B – Part 2 (Word Order: 41–45)", 5usize),
        ("Section B – Part 3 (Word Forms: 46–50)", 5usize),
    ];

    let parts = part_meta
        .iter()
        .enumerate()
        .map(|(idx, (title, max_q))| {
            let correct = part_counts[idx];
            let incorrect = max_q - correct;
            let score = ((correct as f64 * 0.2) * 10.0).round() / 10.0;
            let max_score = ((*max_q as f64 * 0.2) * 10.0).round() / 10.0;
            PartBreakdown {
                title: (*title).to_string(),
                total_questions: *max_q,
                correct,
                incorrect,
                score,
                max_score,
            }
        })
        .collect();

    let student_name = if req.student_name.trim().is_empty() {
        "Not entered".to_string()
    } else {
        req.student_name.trim().to_string()
    };

    let student_class = if req.student_class.trim().is_empty() {
        "—".to_string()
    } else {
        req.student_class.trim().to_string()
    };

    let submitted_at = Local::now().format("%H:%M · %d/%m/%Y").to_string();

    GradeReport {
        test_id: exam.id,
        test_title: exam.title.clone(),
        student_name,
        student_class,
        submitted_at,
        elapsed_seconds: req.elapsed_seconds,
        total_correct,
        total_questions,
        ten_scale,
        accuracy_percent,
        parts,
        results,
        answer_key,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::loader::load_all_exams;
    use std::collections::{HashMap, HashSet};
    use std::path::Path;

    fn build_perfect_submission(exam: &ExamTest) -> SubmitRequest {
        let mut answers = HashMap::new();
        for q in &exam.sec_a_part1 {
            answers.insert(q.num, AnswerValue::Text(q.answer.clone()));
        }
        for q in &exam.sec_a_part2 {
            answers.insert(q.num, AnswerValue::Text(q.answer.clone()));
        }
        for q in &exam.sec_a_part3 {
            answers.insert(q.num, AnswerValue::Text(q.answer.clone()));
        }
        for q in &exam.sec_a_part4 {
            answers.insert(q.num, AnswerValue::Text(q.answer.clone()));
        }
        for q in &exam.sec_b_part1 {
            answers.insert(q.num, AnswerValue::Text(q.answer.clone()));
        }
        for q in &exam.sec_b_part2 {
            // Reconstruct block ordering matching display_answer
            let mut pool = q.blocks.clone();
            let mut chosen = Vec::new();
            let target = normalize_word_order_text(&q.display_answer);
            let mut remaining = target.as_str();
            while !remaining.is_empty() {
                let idx = pool
                    .iter()
                    .position(|blk| {
                        let norm_blk = normalize_word_order_text(blk);
                        !norm_blk.is_empty()
                            && (remaining == norm_blk
                                || remaining.starts_with(&format!("{norm_blk} ")))
                    })
                    .unwrap_or_else(|| {
                        panic!(
                            "Exam {} Q{}: could not reconstruct '{}' from blocks {:?}",
                            exam.id, q.num, remaining, pool
                        )
                    });
                let blk = pool.remove(idx);
                let norm_blk = normalize_word_order_text(&blk);
                chosen.push(blk);
                remaining = remaining[norm_blk.len()..].trim_start();
            }
            for leftover in pool {
                if normalize_word_order_text(&leftover).is_empty() {
                    chosen.push(leftover);
                }
            }
            answers.insert(q.num, AnswerValue::Blocks(chosen));
        }
        for q in &exam.sec_b_part3 {
            answers.insert(q.num, AnswerValue::Text(q.display_answer.clone()));
        }
        SubmitRequest {
            student_name: "Test Student".to_string(),
            student_class: "A2.1-01".to_string(),
            elapsed_seconds: 1200,
            answers,
        }
    }

    #[test]
    fn all_13_exams_load_validate_and_grade_perfectly() {
        let exams = load_all_exams(Path::new("data/tests"))
            .expect("All 13 test JSON files should load and validate");
        assert_eq!(exams.len(), 13, "Expected exactly 13 exams (3 reference + 10 practice)");

        let ref_count = exams.iter().filter(|e| e.category == "reference").count();
        let prac_count = exams.iter().filter(|e| e.category == "practice").count();
        assert_eq!(ref_count, 3);
        assert_eq!(prac_count, 10);

        for exam in &exams {
            let perfect = build_perfect_submission(exam);
            let report = grade_exam(exam, &perfect);
            assert_eq!(
                report.total_correct, 50,
                "Exam {} failed perfect score: {:?}",
                exam.id,
                report
                    .results
                    .iter()
                    .filter(|r| !r.is_correct)
                    .collect::<Vec<_>>()
            );
            assert_eq!(report.ten_scale, 10.0);
            assert_eq!(report.accuracy_percent, 100);

            let empty = SubmitRequest {
                student_name: String::new(),
                student_class: String::new(),
                elapsed_seconds: 0,
                answers: HashMap::new(),
            };
            let zero_report = grade_exam(exam, &empty);
            assert_eq!(zero_report.total_correct, 0);
            assert_eq!(zero_report.ten_scale, 0.0);
            assert_eq!(zero_report.accuracy_percent, 0);
        }
    }

    #[test]
    fn practice_exams_have_unique_passages_and_questions() {
        let exams = load_all_exams(Path::new("data/tests")).expect("Load exams");
        let mut passage_titles = HashSet::new();
        let mut p1_sentences = HashSet::new();
        let mut p2_statements = HashSet::new();
        let mut b1_sentences = HashSet::new();

        for exam in &exams {
            assert!(
                passage_titles.insert(exam.passage.title.to_lowercase()),
                "Duplicate passage title in exam {}: {}",
                exam.id,
                exam.passage.title
            );
            if exam.category == "practice" {
                for q in &exam.sec_a_part1 {
                    let full = format!("{}_{}", q.pre.trim(), q.post.trim()).to_lowercase();
                    assert!(
                        p1_sentences.insert(full.clone()),
                        "Duplicate P1 sentence in exam {}: {}",
                        exam.id,
                        full
                    );
                }
                for q in &exam.sec_a_part2 {
                    assert!(
                        p2_statements.insert(q.statement.to_lowercase()),
                        "Duplicate P2 statement in exam {}: {}",
                        exam.id,
                        q.statement
                    );
                }
                for q in &exam.sec_b_part1 {
                    assert!(
                        b1_sentences.insert(q.sentence.to_lowercase()),
                        "Duplicate B1 sentence in exam {}: {}",
                        exam.id,
                        q.sentence
                    );
                }
            }
        }
    }

    #[test]
    fn normalization_and_edge_cases() {
        let exams = load_all_exams(Path::new("data/tests")).expect("Load exams");
        let exam1 = &exams[0];

        let mut answers = HashMap::new();
        // Curly apostrophe and uppercase on Q50 ("aren't" / "are not")
        answers.insert(50, AnswerValue::Text("  AREN’T ".to_string()));
        // Q48 uppercase
        answers.insert(48, AnswerValue::Text("are".to_string()));
        // Q41 incomplete blocks should fail even if prefix matches
        answers.insert(41, AnswerValue::Blocks(vec!["my father".to_string()]));
        // Q25 case-insensitive spelling
        answers.insert(25, AnswerValue::Text(" Sandwich ".to_string()));

        let req = SubmitRequest {
            student_name: "Linh".to_string(),
            student_class: "".to_string(),
            elapsed_seconds: 300,
            answers,
        };
        let report = grade_exam(exam1, &req);
        let q25 = report.results.iter().find(|r| r.num == 25).unwrap();
        let q41 = report.results.iter().find(|r| r.num == 41).unwrap();
        let q48 = report.results.iter().find(|r| r.num == 48).unwrap();
        let q50 = report.results.iter().find(|r| r.num == 50).unwrap();

        assert!(q25.is_correct);
        assert!(!q41.is_correct);
        assert!(q48.is_correct);
        assert!(q50.is_correct);
        assert_eq!(report.total_correct, 3);
    }
}
