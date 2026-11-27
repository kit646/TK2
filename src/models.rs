use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemePalette {
    pub name: String,
    pub dark: String,
    pub primary: String,
    pub accent: String,
    pub bright: String,
    pub soft: String,
    pub pale: String,
    pub line: String,
    pub ink: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part1Item {
    pub num: u8,
    pub pre: String,
    pub post: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Passage {
    pub title: String,
    pub subtitle: String,
    pub paragraphs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part2Item {
    pub num: u8,
    pub statement: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part3Response {
    pub letter: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part3Item {
    pub num: u8,
    pub question: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Part4Item {
    pub num: u8,
    pub pre: String,
    pub wrong_word: String,
    pub post: String,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecBPart1Item {
    pub num: u8,
    pub sentence: String,
    pub options: Vec<String>,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecBPart2Item {
    pub num: u8,
    pub blocks: Vec<String>,
    pub display_answer: String,
    pub accepted: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecBPart3Item {
    pub num: u8,
    pub pre: String,
    pub post: String,
    pub display_answer: String,
    pub accepted: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExamTest {
    pub id: u32,
    pub slug: String,
    pub category: String,
    pub badge: String,
    pub title: String,
    pub subtitle: String,
    pub topic: String,
    pub duration_minutes: u32,
    pub theme: ThemePalette,
    pub word_bank: Vec<String>,
    pub sec_a_part1: Vec<Part1Item>,
    pub passage: Passage,
    pub sec_a_part2: Vec<Part2Item>,
    pub sec_a_part3_responses: Vec<Part3Response>,
    pub sec_a_part3: Vec<Part3Item>,
    pub sec_a_part4: Vec<Part4Item>,
    pub sec_b_part1: Vec<SecBPart1Item>,
    pub sec_b_part2: Vec<SecBPart2Item>,
    pub sec_b_part3: Vec<SecBPart3Item>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicPart1Item {
    pub num: u8,
    pub pre: String,
    pub post: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicPart2Item {
    pub num: u8,
    pub statement: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicPart3Item {
    pub num: u8,
    pub question: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicPart4Item {
    pub num: u8,
    pub pre: String,
    pub wrong_word: String,
    pub post: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicSecBPart1Item {
    pub num: u8,
    pub sentence: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicSecBPart2Item {
    pub num: u8,
    pub blocks: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicSecBPart3Item {
    pub num: u8,
    pub pre: String,
    pub post: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicExamTest {
    pub id: u32,
    pub slug: String,
    pub category: String,
    pub badge: String,
    pub title: String,
    pub subtitle: String,
    pub topic: String,
    pub duration_minutes: u32,
    pub theme: ThemePalette,
    pub word_bank: Vec<String>,
    pub sec_a_part1: Vec<PublicPart1Item>,
    pub passage: Passage,
    pub sec_a_part2: Vec<PublicPart2Item>,
    pub sec_a_part3_responses: Vec<Part3Response>,
    pub sec_a_part3: Vec<PublicPart3Item>,
    pub sec_a_part4: Vec<PublicPart4Item>,
    pub sec_b_part1: Vec<PublicSecBPart1Item>,
    pub sec_b_part2: Vec<PublicSecBPart2Item>,
    pub sec_b_part3: Vec<PublicSecBPart3Item>,
}

impl From<&ExamTest> for PublicExamTest {
    fn from(exam: &ExamTest) -> Self {
        Self {
            id: exam.id,
            slug: exam.slug.clone(),
            category: exam.category.clone(),
            badge: exam.badge.clone(),
            title: exam.title.clone(),
            subtitle: exam.subtitle.clone(),
            topic: exam.topic.clone(),
            duration_minutes: exam.duration_minutes,
            theme: exam.theme.clone(),
            word_bank: exam.word_bank.clone(),
            sec_a_part1: exam
                .sec_a_part1
                .iter()
                .map(|i| PublicPart1Item {
                    num: i.num,
                    pre: i.pre.clone(),
                    post: i.post.clone(),
                })
                .collect(),
            passage: exam.passage.clone(),
            sec_a_part2: exam
                .sec_a_part2
                .iter()
                .map(|i| PublicPart2Item {
                    num: i.num,
                    statement: i.statement.clone(),
                })
                .collect(),
            sec_a_part3_responses: exam.sec_a_part3_responses.clone(),
            sec_a_part3: exam
                .sec_a_part3
                .iter()
                .map(|i| PublicPart3Item {
                    num: i.num,
                    question: i.question.clone(),
                })
                .collect(),
            sec_a_part4: exam
                .sec_a_part4
                .iter()
                .map(|i| PublicPart4Item {
                    num: i.num,
                    pre: i.pre.clone(),
                    wrong_word: i.wrong_word.clone(),
                    post: i.post.clone(),
                })
                .collect(),
            sec_b_part1: exam
                .sec_b_part1
                .iter()
                .map(|i| PublicSecBPart1Item {
                    num: i.num,
                    sentence: i.sentence.clone(),
                    options: i.options.clone(),
                })
                .collect(),
            sec_b_part2: exam
                .sec_b_part2
                .iter()
                .map(|i| PublicSecBPart2Item {
                    num: i.num,
                    blocks: i.blocks.clone(),
                })
                .collect(),
            sec_b_part3: exam
                .sec_b_part3
                .iter()
                .map(|i| PublicSecBPart3Item {
                    num: i.num,
                    pre: i.pre.clone(),
                    post: i.post.clone(),
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ExamSummary {
    pub id: u32,
    pub slug: String,
    pub category: String,
    pub badge: String,
    pub title: String,
    pub subtitle: String,
    pub topic: String,
    pub duration_minutes: u32,
    pub question_count: usize,
    pub theme: ThemePalette,
    pub attempt_count: usize,
    pub best_score_ten: Option<f64>,
    pub best_correct: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum AnswerValue {
    Text(String),
    Blocks(Vec<String>),
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubmitRequest {
    #[serde(default)]
    pub student_name: String,
    #[serde(default)]
    pub student_class: String,
    #[serde(default)]
    pub elapsed_seconds: u32,
    #[serde(default)]
    pub answers: HashMap<u8, AnswerValue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PartBreakdown {
    pub title: String,
    pub total_questions: usize,
    pub correct: usize,
    pub incorrect: usize,
    pub score: f64,
    pub max_score: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct QuestionResult {
    pub num: u8,
    pub part: String,
    pub is_correct: bool,
    pub user_answer: String,
    pub correct_answer: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnswerKeyItem {
    pub num: u8,
    pub answer: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GradeReport {
    pub test_id: u32,
    pub test_title: String,
    pub student_name: String,
    pub student_class: String,
    pub submitted_at: String,
    pub elapsed_seconds: u32,
    pub total_correct: usize,
    pub total_questions: usize,
    pub ten_scale: f64,
    pub accuracy_percent: u32,
    pub parts: Vec<PartBreakdown>,
    pub results: Vec<QuestionResult>,
    pub answer_key: Vec<AnswerKeyItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttemptRecord {
    pub id: String,
    pub test_id: u32,
    pub test_title: String,
    pub category: String,
    pub student_name: String,
    pub student_class: String,
    pub total_correct: usize,
    pub total_questions: usize,
    pub ten_scale: f64,
    pub accuracy_percent: u32,
    pub elapsed_seconds: u32,
    pub submitted_at: String,
}
