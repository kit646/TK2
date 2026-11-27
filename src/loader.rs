use crate::models::{AttemptRecord, ExamTest};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::Path;

pub fn load_all_exams(dir: &Path) -> Result<Vec<ExamTest>, String> {
    if !dir.exists() {
        return Err(format!("Tests directory does not exist: {}", dir.display()));
    }

    let mut files = Vec::new();
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read tests directory {}: {e}", dir.display()))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                if name.starts_with("test_") && name.ends_with(".json") {
                    files.push(path);
                }
            }
        }
    }

    files.sort();
    if files.is_empty() {
        return Err(format!("No test_*.json files found in {}", dir.display()));
    }

    let mut exams = Vec::with_capacity(files.len());
    let mut seen_ids = HashSet::new();

    for path in files {
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
        let exam: ExamTest = serde_json::from_str(&raw)
            .map_err(|e| format!("Failed to parse {}: {e}", path.display()))?;
        validate_exam(&exam)
            .map_err(|e| format!("Validation failed for {}: {e}", path.display()))?;
        if !seen_ids.insert(exam.id) {
            return Err(format!("Duplicate test id {} in {}", exam.id, path.display()));
        }
        exams.push(exam);
    }

    exams.sort_by_key(|e| e.id);
    Ok(exams)
}

pub fn validate_exam(exam: &ExamTest) -> Result<(), String> {
    if exam.category != "reference" && exam.category != "practice" {
        return Err(format!("Invalid category '{}'", exam.category));
    }

    if exam.word_bank.len() != 12 {
        return Err(format!(
            "word_bank must have 12 items, found {}",
            exam.word_bank.len()
        ));
    }
    let bank_set: HashSet<&str> = exam.word_bank.iter().map(String::as_str).collect();
    if bank_set.len() != 12 {
        return Err("word_bank must contain 12 unique words".to_string());
    }

    if exam.sec_a_part1.len() != 10 {
        return Err(format!(
            "sec_a_part1 must have 10 items, found {}",
            exam.sec_a_part1.len()
        ));
    }
    let mut p1_answers = HashSet::new();
    for (idx, item) in exam.sec_a_part1.iter().enumerate() {
        let expected_num = (idx + 1) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_a_part1 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if !bank_set.contains(item.answer.as_str()) {
            return Err(format!(
                "Q{} answer '{}' is not in word_bank",
                item.num, item.answer
            ));
        }
        if !p1_answers.insert(item.answer.as_str()) {
            return Err(format!(
                "Q{} answer '{}' is used more than once in word_bank",
                item.num, item.answer
            ));
        }
    }

    if exam.passage.paragraphs.is_empty() {
        return Err("passage must have at least 1 paragraph".to_string());
    }

    if exam.sec_a_part2.len() != 8 {
        return Err(format!(
            "sec_a_part2 must have 8 items, found {}",
            exam.sec_a_part2.len()
        ));
    }
    for (idx, item) in exam.sec_a_part2.iter().enumerate() {
        let expected_num = (11 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_a_part2 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if item.answer != "True" && item.answer != "False" {
            return Err(format!(
                "Q{} answer must be 'True' or 'False', found '{}'",
                item.num, item.answer
            ));
        }
    }

    if exam.sec_a_part3_responses.len() != 6 || exam.sec_a_part3.len() != 6 {
        return Err("sec_a_part3 and responses must each have 6 items".to_string());
    }
    let resp_letters: HashSet<&str> = exam
        .sec_a_part3_responses
        .iter()
        .map(|r| r.letter.as_str())
        .collect();
    if resp_letters.len() != 6 {
        return Err("sec_a_part3_responses letters must be unique".to_string());
    }
    let mut p3_answers = HashSet::new();
    for (idx, item) in exam.sec_a_part3.iter().enumerate() {
        let expected_num = (19 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_a_part3 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if !resp_letters.contains(item.answer.as_str()) {
            return Err(format!(
                "Q{} answer '{}' not found in sec_a_part3_responses",
                item.num, item.answer
            ));
        }
        if !p3_answers.insert(item.answer.as_str()) {
            return Err(format!(
                "Q{} answer '{}' duplicated in sec_a_part3",
                item.num, item.answer
            ));
        }
    }

    if exam.sec_a_part4.len() != 6 {
        return Err(format!(
            "sec_a_part4 must have 6 items, found {}",
            exam.sec_a_part4.len()
        ));
    }
    for (idx, item) in exam.sec_a_part4.iter().enumerate() {
        let expected_num = (25 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_a_part4 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if item.wrong_word.eq_ignore_ascii_case(&item.answer) {
            return Err(format!(
                "Q{} wrong_word '{}' matches answer '{}'",
                item.num, item.wrong_word, item.answer
            ));
        }
    }

    if exam.sec_b_part1.len() != 10 {
        return Err(format!(
            "sec_b_part1 must have 10 items, found {}",
            exam.sec_b_part1.len()
        ));
    }
    for (idx, item) in exam.sec_b_part1.iter().enumerate() {
        let expected_num = (31 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_b_part1 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if item.options.len() != 3 {
            return Err(format!(
                "Q{} must have 3 options, found {}",
                item.num,
                item.options.len()
            ));
        }
        if !item.options.contains(&item.answer) {
            return Err(format!(
                "Q{} answer '{}' not present in options {:?}",
                item.num, item.answer, item.options
            ));
        }
    }

    if exam.sec_b_part2.len() != 5 {
        return Err(format!(
            "sec_b_part2 must have 5 items, found {}",
            exam.sec_b_part2.len()
        ));
    }
    for (idx, item) in exam.sec_b_part2.iter().enumerate() {
        let expected_num = (41 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_b_part2 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if item.blocks.len() < 3 || item.accepted.is_empty() {
            return Err(format!("Q{} has invalid blocks or accepted list", item.num));
        }
        let block_tokens = tokenize_normalized(&item.blocks.join(" "));
        let display_tokens = tokenize_normalized(&item.display_answer);
        if block_tokens != display_tokens {
            return Err(format!(
                "Q{} block token multiset {:?} != display_answer token multiset {:?}",
                item.num, block_tokens, display_tokens
            ));
        }
        let norm_display = normalize_word_order_text(&item.display_answer);
        if !item.accepted.iter().any(|a| a == &norm_display) {
            return Err(format!(
                "Q{} accepted list {:?} does not include normalized display_answer '{}'",
                item.num, item.accepted, norm_display
            ));
        }
    }

    if exam.sec_b_part3.len() != 5 {
        return Err(format!(
            "sec_b_part3 must have 5 items, found {}",
            exam.sec_b_part3.len()
        ));
    }
    for (idx, item) in exam.sec_b_part3.iter().enumerate() {
        let expected_num = (46 + idx) as u8;
        if item.num != expected_num {
            return Err(format!(
                "sec_b_part3 expected Q{}, found Q{}",
                expected_num, item.num
            ));
        }
        if item.accepted.is_empty() {
            return Err(format!("Q{} accepted list cannot be empty", item.num));
        }
    }

    Ok(())
}

pub fn normalize_word_order_text(raw: &str) -> String {
    let cleaned = raw
        .replace('’', "'")
        .replace('‘', "'")
        .replace(['.', '?', '!', ','], "");
    cleaned
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn tokenize_normalized(raw: &str) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    let norm = normalize_word_order_text(raw);
    for tok in norm.split_whitespace() {
        *counts.entry(tok.to_string()).or_insert(0) += 1;
    }
    counts
}

pub fn load_history(path: &Path) -> Vec<AttemptRecord> {
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str::<Vec<AttemptRecord>>(&raw).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_history(path: &Path, history: &[AttemptRecord]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create history dir {}: {e}", parent.display()))?;
    }
    let json = serde_json::to_string_pretty(history)
        .map_err(|e| format!("Failed to serialize history: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write history {}: {e}", path.display()))
}
