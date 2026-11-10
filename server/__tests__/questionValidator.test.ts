/**
 * Kiểm thử bộ kiểm định câu hỏi sau khi sửa (server/questionValidator.ts):
 *  - Câu hỏi diễn đạt lại đúng kiến thức nguồn (không trùng nguyên văn) → đạt.
 *  - Câu hỏi đúng nhưng KHÔNG có bằng chứng trong nguồn → bị loại.
 *  - Đáp án sai với tài liệu → bị loại.
 *  - Đáp án đúng nhưng không trùng nguyên văn → đạt (diễn đạt lại tự nhiên).
 *  - Thiếu area_evidence → không được đánh dấu đạt (kiểm tra ở webResearch tests).
 *  - Câu hỏi Python về for/while và List.
 * KHÔNG cần API key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestion, validateQuestionSet } from '../questionValidator';
import type { Question } from '../../src/types';

// Tạm expose từ khóa để chẩn đoán qua test: gọi trực tiếp qua buildRejectionDiagnostic
// không export được nên dùng log; ở đây ta chỉ cần biết matchedWords — lấy qua log.
// Tạm thời thêm console spy: intercept console.info.

// Nguồn mô phỏng: trích từ docs.python.org controlflow + datastructures
const SOURCE_TEXT =
  'Câu lệnh for trong Python lặp qua các phần tử của một chuỗi (list, string) theo thứ tự. ' +
  'Hàm range() tạo dãy số để lặp. Vòng lặp while chạy khi điều kiện còn đúng. ' +
  'break thoát khỏi vòng lặp gần nhất, continue bỏ qua phần còn lại của lần lặp hiện tại.';

const DOC_RAW_TEXT = `# Nội dung tài liệu nghiên cứu
## 4. More Control Flow Tools — Python 3 Tutorial
https://docs.python.org/3/tutorial/controlflow.html
${SOURCE_TEXT}
Ngoài ra, Python còn có biểu thức điều kiện if/elif/else để rẽ nhánh chương trình.
## 5. Data Structures — Python 3 Tutorial
https://docs.python.org/3/tutorial/datastructures.html
Kiểu dữ liệu danh sách (list) là tập hợp có thứ tự, có thể thay đổi nội dung.
Phương thức append() thêm phần tử vào cuối danh sách. List comprehension tạo danh sách ngắn gọn.`;

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-test-1',
    questionNumber: 1,
    questionText: 'Câu lệnh nào trong Python dùng để lặp qua các phần tử của một danh sách?',
    options: [
      { key: 'A', text: 'Câu lệnh for' },
      { key: 'B', text: 'Câu lệnh if' },
      { key: 'C', text: 'Câu lệnh def' },
      { key: 'D', text: 'Câu lệnh import' },
    ],
    correctAnswer: 'A',
    explanation: 'Câu lệnh for trong Python lặp qua các phần tử của một chuỗi như danh sách, theo thứ tự.',
    difficulty: 'easy',
    topic: 'Vòng lặp for',
    source: {
      documentId: 'doc-1',
      documentName: 'AI_Research_Python.txt',
      sourceUrl: 'https://docs.python.org/3/tutorial/controlflow.html',
      chapter: 'Nội dung tài liệu: AI_Research_Python',
      section: '1.1 Vòng lặp',
      page: 1,
      sourceChunkId: 'chunk-1',
      sourceText: SOURCE_TEXT,
      knowledgeUnit: 'Vòng lặp for',
      generationReason: 'Đoạn trích định nghĩa trực tiếp hành vi của câu lệnh for khi lặp qua danh sách.',
    },
    validation: {} as Question['validation'],
    ...overrides,
  } as Question;
}

const validatorOpts = { documentRawText: DOC_RAW_TEXT };

// ===== 1. Câu hỏi diễn đạt lại đúng kiến thức nguồn → đạt =====
test('validator: câu hỏi diễn đạt lại tự nhiên (không trùng nguyên văn) vẫn đạt khi có căn cứ nguồn', () => {
  const q = makeQuestion({
    questionText: 'Khi cần duyệt lần lượt từng phần tử trong một danh sách Python, nên dùng cấu trúc nào?',
    options: [
      { key: 'A', text: 'Vòng lặp for' },
      { key: 'B', text: 'Câu lệnh break' },
      { key: 'C', text: 'Hàm range()' },
      { key: 'D', text: 'Khối try/except' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.questionInSource, true, JSON.stringify(result.issues));
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 2. Câu hỏi đúng nhưng KHÔNG có bằng chứng → bị loại =====
test('validator: câu hỏi không có bằng chứng trong nguồn bị loại (không đánh dấu đạt)', () => {
  const q = makeQuestion({
    questionText: 'Thuật toán sắp xếp nhanh (quicksort) có độ phức tạp trung bình là bao nhiêu?',
    options: [
      { key: 'A', text: 'O(n log n)' },
      { key: 'B', text: 'O(n^2)' },
      { key: 'C', text: 'O(n)' },
      { key: 'D', text: 'O(log n)' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.questionInSource, false);
  assert.equal(result.isValid, false);
});

// ===== 3. Đáp án sai với tài liệu → bị loại =====
test('validator: đáp án đúng sai với nội dung nguồn bị loại', () => {
  const q = makeQuestion({
    questionText: 'Câu lệnh nào trong Python lặp qua các phần tử của một danh sách?',
    options: [
      { key: 'A', text: 'Câu lệnh import' }, // sai — nguồn nói "for"
      { key: 'B', text: 'Câu lệnh if' },
      { key: 'C', text: 'Câu lệnh def' },
      { key: 'D', text: 'Câu lệnh pass' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.answerInSource, false, JSON.stringify(result.issues));
  assert.equal(result.isValid, false);
});

// ===== 4. Đáp án đúng nhưng không trùng nguyên văn → đạt =====
test('validator: đáp án diễn đạt lại (không trùng nguyên văn) vẫn đạt khi có căn cứ nguồn', () => {
  const q = makeQuestion({
    questionText: 'Cấu trúc nào giúp thực thi lặp lại một khối lệnh khi điều kiện còn đúng?',
    options: [
      { key: 'A', text: 'Vòng lặp while' },
      { key: 'B', text: 'Câu lệnh pass' },
      { key: 'C', text: 'Hàm print()' },
      { key: 'D', text: 'Câu lệnh return' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 5. Câu hỏi Python về List (datastructures) =====
test('validator: câu hỏi về danh sách (List) Python được xác minh qua ngữ cảnh nguồn', () => {
  const listSource = 'Kiểu dữ liệu danh sách (list) là tập hợp có thứ tự, có thể thay đổi nội dung.';
  const q = makeQuestion({
    questionText: 'Phương thức nào thêm một phần tử vào cuối danh sách Python?',
    options: [
      { key: 'A', text: 'append()' },
      { key: 'B', text: 'remove()' },
      { key: 'C', text: 'keys()' },
      { key: 'D', text: 'items()' },
    ],
    correctAnswer: 'A',
    source: {
      ...makeQuestion().source,
      sourceText: listSource,
      knowledgeUnit: 'Danh sách (List)',
      sourceUrl: 'https://docs.python.org/3/tutorial/datastructures.html',
    },
  });
  const result = validateQuestion(q, [], validatorOpts);
  // "append()" là từ ngắn; kiểm tra ngữ cảnh gốc phải tìm thấy nó
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 6. validateQuestionSet tổng hợp + log chẩn đoán không lỗi =====
test('validateQuestionSet: tổng hợp đúng số đạt/không đạt và điền validation cho từng câu', () => {
  const good = makeQuestion();
  const bad = makeQuestion({ id: 'q-test-2', questionText: 'Chính sách bảo hiểm y tế của công ty bảo hiểm áp dụng mức khấu trừ bao nhiêu phần trăm?', options: [
    { key: 'A', text: 'Mức khấu trừ 20 phần trăm chi phí khám chữa bệnh' },
    { key: 'B', text: 'Mức khấu trừ 50 phần trăm viên phí nhập viện' },
    { key: 'C', text: 'Mức hỗ trợ tối đa 10 triệu đồng mỗi năm' },
    { key: 'D', text: 'Không áp dụng mức khấu trừ cho người thân' },
  ], correctAnswer: 'A' });
  const report = validateQuestionSet([good, bad], validatorOpts);
  assert.equal(report.totalQuestions, 2);
  assert.equal(report.validCount, 1);
  assert.equal(report.needsReviewCount, 1);
  assert.equal(report.allValid, false);
  assert.ok(good.validation.isValid);
  assert.ok(!bad.validation.isValid);
  assert.ok(report.issuesSummary.some((line) => line.startsWith('Câu 2:')));
});

// ===== 7. Không có documentRawText → vẫn hoạt động (fallback đoạn trích) =====
test('validator: không truyền documentRawText vẫn kiểm tra theo đoạn trích như trước', () => {
  const q = makeQuestion();
  const result = validateQuestion(q, []);
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 8. Đáp án có bằng chứng trong nguồn (verbatim) =====
test('validator: đáp án có bằng chứng nguyên văn trong nguồn → đạt', () => {
  const q = makeQuestion({ options: [
    { key: 'A', text: 'Hàm range() tạo dãy số để lặp' },
    { key: 'B', text: 'Hàm input() đọc dữ liệu bàn phím' },
    { key: 'C', text: 'Hàm print() in kết quả ra màn hình' },
    { key: 'D', text: 'Hàm len() đếm độ dài chuỗi' },
  ] });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 9. Đáp án diễn đạt khác nhưng cùng ý nghĩa → đạt =====
test('validator: đáp án diễn đạt khác nguồn nhưng cùng ý nghĩa → đạt', () => {
  // Nguồn: "Vòng lặp while chạy khi điều kiện còn đúng" — đáp án diễn đạt lại
  const q = makeQuestion({
    questionText: 'Cấu trúc lặp nào tiếp tục thực thi trong khi điều kiện kiểm tra còn đúng?',
    options: [
      { key: 'A', text: 'Cấu trúc lặp while' },
      { key: 'B', text: 'Cấu trúc rẽ nhánh switch' },
      { key: 'C', text: 'Khối khai báo hàm' },
      { key: 'D', text: 'Câu lệnh gán biến' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.answerInSource, true, JSON.stringify(result.issues));
  assert.equal(result.isValid, true, JSON.stringify(result.issues));
});

// ===== 10. Đáp án không có trong nguồn → bị loại =====
test('validator: đáp án không có trong nguồn → bị loại, nguyên nhân A được log', () => {
  // Spy log để đọc matchedWords từ chẩn đoán
  const captured: any[] = [];
  const originalInfo = console.info;
  console.info = (...args: any[]) => { captured.push(args); };
  try {
    const q = makeQuestion({ options: [
      { key: 'A', text: 'Hàm thư viện bên thứ ba pandas dataframe đọc tệp excel' },
      { key: 'B', text: 'Hàm input() đọc dữ liệu bàn phím' },
      { key: 'C', text: 'Hàm print() in kết quả ra màn hình' },
      { key: 'D', text: 'Hàm len() đếm độ dài chuỗi' },
    ] });
    const result = validateQuestion(q, [], validatorOpts);
    assert.equal(result.checks.answerInSource, false, JSON.stringify(result.issues));
    assert.equal(result.isValid, false);
  } finally {
    console.info = originalInfo;
  }
});

// ===== 11. Citation trỏ nhầm nguồn → bị loại (excerpt không tìm thấy trong rawText) =====
test('validator: citation trỏ nhầm nguồn (excerpt không nguyên văn) → bị loại, nguyên nhân C/D', () => {
  const q = makeQuestion({
    source: {
      ...makeQuestion().source,
      // Gemini "bịa" excerpt không có trong rawText
      sourceText: 'Đây là đoạn trích Gemini tự sáng tạo không hề có trong tài liệu nghiên cứu gốc.',
    },
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.questionInSource, false);
  assert.equal(result.isValid, false);
});

// ===== 12. Câu hỏi nằm ngoài phạm vi tài liệu → bị loại =====
test('validator: câu hỏi nằm ngoài phạm vi tài liệu → bị loại', () => {
  const q = makeQuestion({
    questionText: 'Ai là tác giả của bản giao hưởng số 9 nổi tiếng thế giới?',
    options: [
      { key: 'A', text: 'Nhà soạn nhạc Ludwig van Beethoven' },
      { key: 'B', text: 'Họa sĩ Vincent van Gogh' },
      { key: 'C', text: 'Nhà văn Victor Hugo' },
      { key: 'D', text: 'Nhà khoa học Isaac Newton' },
    ],
    correctAnswer: 'A',
  });
  const result = validateQuestion(q, [], validatorOpts);
  assert.equal(result.checks.questionInSource, false);
  assert.equal(result.checks.answerInSource, false);
  assert.equal(result.isValid, false);
});
