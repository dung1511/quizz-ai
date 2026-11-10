/**
 * Test cho src/utils/libraryUtils.ts — chạy bằng: npx tsx src/utils/__tests__/libraryUtils.test.ts
 * Không dùng framework; không dùng dữ liệu mẫu production — mọi fixture chỉ nằm trong test.
 */
import { QuizAttempt, QuizSet, Question } from '../../types';
import {
  filterAttempts,
  computeAttemptStats,
  paginateAttempts,
  totalPagesFor,
  isAttemptInDateRange,
  availablePeriods,
  availableQuizOptions,
  availableDocumentNames,
  groupWrongAnswersByQuiz,
  analyzeTopicWeaknesses,
  significantWeakTopics,
  questionsForTopic,
  ATTEMPTS_PAGE_SIZE,
} from '../libraryUtils';

let passed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  ✔ ${name}`); }
  else { failures.push(name); console.error(`  ✘ ${name}`); }
}

async function testCase(name: string, fn: () => void) {
  console.log(name);
  try { fn(); }
  catch (error) { failures.push(`${name} (${error})`); console.error(`  ✘ threw: ${error}`); }
}

// ===== Fixtures (chỉ dùng trong test) =====
function makeQuestion(id: string, topic: string, correct: 'A' | 'B' | 'C' | 'D' = 'A'): Question {
  return {
    id,
    questionNumber: 1,
    questionText: `Câu hỏi ${id} về ${topic}`,
    options: [
      { key: 'A', text: 'Đáp án A' },
      { key: 'B', text: 'Đáp án B' },
      { key: 'C', text: 'Đáp án C' },
      { key: 'D', text: 'Đáp án D' },
    ],
    correctAnswer: correct,
    explanation: 'Giải thích.',
    difficulty: 'medium',
    topic,
    source: {
      documentId: 'doc-1', documentName: 'Tài liệu A', chapter: 'Chương 1', section: '1.1',
      page: 1, sourceChunkId: 'c1', sourceText: 'Nội dung nguồn.', knowledgeUnit: topic, generationReason: 'Lý do cụ thể.',
    },
    validation: { isValid: true, status: 'VALID', checks: {
      hasFourOptions: true, hasSingleCorrect: true, answerInSource: true, explanationMatchesSource: true,
      hasSourceMapping: true, hasReason: true, noDuplicateOptions: true,
    } },
  };
}

function makeQuiz(id: string, title: string, documentName: string, questions: Question[]): QuizSet {
  return {
    id, title, documentId: 'doc-1', documentName,
    createdAt: new Date().toISOString(),
    totalQuestions: questions.length, recommendedMinutes: 10,
    difficulty: 'medium', questionType: 'multiple_choice', quizStyle: 'standard',
    questions,
  };
}

function makeAttempt(id: string, quiz: QuizSet, completedAt: string, answers: Record<string, string>): QuizAttempt {
  const values = Object.values(answers);
  const correct = quiz.questions.filter((q) => answers[q.id] === q.correctAnswer).length;
  const total = quiz.questions.length;
  return {
    id, quizId: quiz.id, quizTitle: quiz.title, completedAt, timeSpentSeconds: 300,
    answers: answers as QuizAttempt['answers'], flaggedQuestions: [],
    score: Math.round((correct / total) * 100) / 10,
    percentage: Math.round((correct / total) * 100),
    correctCount: correct,
    wrongCount: values.filter((sel, idx) => quiz.questions[idx] && quiz.questions[idx].correctAnswer !== sel).length,
    unansweredCount: total - values.length,
    totalQuestions: total, categoryBreakdown: [], difficultyBreakdown: [],
    quizSnapshot: quiz,
  };
}

// Bộ đề A: 3 câu (2 câu topic "Đại số", 1 câu topic "Hình học")
const qAlg1 = makeQuestion('q1', 'Đại số');
const qAlg2 = makeQuestion('q2', 'Đại số');
const qGeo = makeQuestion('q3', 'Hình học', 'B');
const quizA = makeQuiz('quiz-a', 'Đề Đại số A', 'Toán 12.pdf', [qAlg1, qAlg2, qGeo]);

// Bộ đề B: 1 câu trùng qAlg1 (test câu sai lặp qua nhiều bộ đề)
const quizB = makeQuiz('quiz-b', 'Đề ôn B', 'Toán 12.pdf', [qAlg1, makeQuestion('q4', 'Xác suất', 'C')]);

// Lần làm 1: hôm nay (dùng ngày hiện tại) — sai q1, đúng q2, sai q3
const today = new Date();
const attempt1 = makeAttempt('att-1', quizA, new Date(today.getTime() - 3600_000).toISOString(), { q1: 'B', q2: 'A', q3: 'A' });
// Lần làm 2: trong cùng tháng hiện tại (ngày 15 hoặc hôm qua nếu đầu tháng) — sai q1, q3
const attempt2 = makeAttempt('att-2', quizA, new Date(today.getFullYear(), today.getMonth(), today.getDate() > 15 ? 15 : Math.max(1, today.getDate() - 1), 12, 0, 0).toISOString(), { q1: 'C', q2: 'A', q3: 'A' });
// Lần làm 3: 10 ngày trước (ngoài last7) — làm lại quizA, sai q1
const attempt3 = makeAttempt('att-3', quizA, new Date(today.getTime() - 10 * 86400_000).toISOString(), { q1: 'D', q2: 'A', q3: 'B' });
// Lần làm 4: 2 tháng trước (luôn là ngày 1 để chắc chắn khác tháng hiện tại) — quizB sai q1, q4
const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
const attempt4 = makeAttempt('att-4', quizB, twoMonthsAgo.toISOString(), { q1: 'B', q4: 'A' });
// Lần làm 5: hôm nay — quizB, làm đúng hết
const attempt5 = makeAttempt('att-5', quizB, new Date(today.getTime() - 7200_000).toISOString(), { q1: 'A', q4: 'C' });

const quizzes = [quizA, quizB];
const allAttempts = [attempt1, attempt2, attempt3, attempt4, attempt5]; // thứ tự lộn xộn để test sort

// ===== Lọc thời gian =====
await testCase('Lọc ngày: today chỉ lấy các lần làm trong ngày cục bộ hiện tại', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'today' });
  assert(result.length === 2, `today = ${result.length} (kỳ vọng 2)`);
  assert(result.every((a) => ['att-1', 'att-5'].includes(a.id)), 'đúng 2 bản ghi att-1, att-5');
});

await testCase('Lọc ngày: last7 bao gồm hôm nay + 6 ngày lùi, loại 10 ngày và 2 tháng', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'last7' });
  assert(result.length === 3, `last7 = ${result.length} (kỳ vọng 3)`);
  assert(result.every((a) => ['att-1', 'att-2', 'att-5'].includes(a.id)), 'đúng att-1, att-2, att-5');
});

await testCase('Lọc ngày: this_month loại bản ghi 2 tháng trước', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'this_month' });
  // att-1, att-5 hôm nay + att-2 trong tháng; att-3 và att-4 ngoài tháng (att-3 có thể
  // rơi vào tháng trước nếu hôm nay là đầu tháng).
  const inMonthIds = result.map((a) => a.id);
  assert(inMonthIds.length >= 3 && inMonthIds.length <= 4, `this_month = ${inMonthIds.length} (kỳ vọng 3–4)`);
  assert(result.every((a) => a.id !== 'att-3' || new Date(attempt3.completedAt).getMonth() === today.getMonth()), 'att-3 chỉ được tính khi cùng tháng hiện tại');
  assert(!result.some((a) => a.id === 'att-4'), 'att-4 (2 tháng trước) bị loại');
});

await testCase('Lọc ngày: month_year lọc đúng tháng/năm do người dùng chọn', () => {
  const d = new Date(attempt4.completedAt);
  const result = filterAttempts(allAttempts, quizzes, {
    search: '', dateRange: 'month_year', month: d.getMonth() + 1, year: d.getFullYear(),
  });
  assert(result.length === 1 && result[0].id === 'att-4', 'chỉ att-4 thuộc tháng đã chọn');
});

await testCase('Lọc ngày: custom from–to theo ranh giới ngày cục bộ', () => {
  const from = new Date(today.getTime() - 4 * 86400_000);
  const result = filterAttempts(allAttempts, quizzes, {
    search: '', dateRange: 'custom', from: from.toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10),
  });
  assert(result.length === 3, `custom = ${result.length} (kỳ vọng 3)`);
  assert(!result.some((a) => a.id === 'att-3' || a.id === 'att-4'), 'loại att-3 (10 ngày) và att-4 (2 tháng)');
});

await testCase('Sắp xếp: mặc định lần làm mới nhất trước', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all' });
  const times = result.map((a) => Date.parse(a.completedAt));
  assert(result[0].id === 'att-1' || result[0].id === 'att-5', 'bản ghi đầu tiên là hôm nay');
  assert(times.every((t, i) => i === 0 || times[i - 1] >= t), 'thứ tự giảm dần theo thời gian');
});

await testCase('Mỗi lần làm bài là một bản ghi riêng (cùng bộ đề nhiều lần không bị gộp)', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all', quizId: 'quiz-a' });
  assert(result.length === 3, `quiz-a có ${result.length} lần làm riêng (kỳ vọng 3)`);
});

await testCase('Lọc theo từ khóa tên bộ đề và theo quizId', () => {
  const bySearch = filterAttempts(allAttempts, quizzes, { search: 'Đề ôn', dateRange: 'all' });
  assert(bySearch.length === 2, `search "Đề ôn" = ${bySearch.length}`);
  const byQuiz = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all', quizId: 'quiz-b' });
  assert(byQuiz.length === 2, 'lọc theo quizId = 2');
});

await testCase('Lọc theo tài liệu (documentName)', () => {
  const result = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all', documentName: 'Toán 12.pdf' });
  assert(result.length === 5, 'tất cả đều từ Toán 12.pdf');
  const none = filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all', documentName: 'Không tồn tại.pdf' });
  assert(none.length === 0, 'tài liệu không tồn tại → 0');
});

await testCase('availablePeriods trả danh sách tháng/năm có trong dữ liệu', () => {
  const periods = availablePeriods(allAttempts);
  assert(periods.length >= 2, `có ${periods.length} kỳ (kỳ vọng ≥ 2)`);
  assert(periods[0].year >= periods[periods.length - 1].year, 'kỳ mới nhất đứng trước');
});

await testCase('availableQuizOptions và availableDocumentNames từ dữ liệu thật', () => {
  const quizOptions = availableQuizOptions(allAttempts, quizzes);
  assert(quizOptions.find((o) => o.id === 'quiz-a')?.attemptCount === 3, 'quiz-a có 3 lượt');
  const docs = availableDocumentNames(allAttempts, quizzes);
  assert(docs.includes('Toán 12.pdf'), 'có Toán 12.pdf');
});

// ===== Thống kê =====
await testCase('Thống kê cập nhật theo tập kết quả đã lọc', () => {
  const statsAll = computeAttemptStats(filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'all' }));
  assert(statsAll.totalAttempts === 5, `tổng lượt = ${statsAll.totalAttempts}`);
  assert(statsAll.averageScore !== null && statsAll.averageScore > 0 && statsAll.averageScore <= 10, 'điểm TB hợp lệ');
  const statsToday = computeAttemptStats(filterAttempts(allAttempts, quizzes, { search: '', dateRange: 'today' }));
  assert(statsToday.totalAttempts === 2, 'thống kê today = 2 lượt (khác all)');
});

// ===== Phân trang =====
await testCase('Phân trang: trả đúng số trang và trang rỗng khi vượt phạm vi', () => {
  const many: QuizAttempt[] = Array.from({ length: 37 }, (_, i) => ({
    ...attempt1, id: `p-${i}`, completedAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
  assert(totalPagesFor(37) === 3, '37 bản ghi → 3 trang');
  assert(paginateAttempts(many, 3).length === 7, 'trang 3 có 7 bản ghi');
  assert(paginateAttempts(many, 4).length === 0, 'trang 4 rỗng');
  assert(paginateAttempts(many, 1).length === ATTEMPTS_PAGE_SIZE, 'trang 1 đủ pageSize');
});

// ===== Nhóm câu sai theo bộ đề =====
await testCase('Nhóm câu sai theo bộ đề: giữ liên kết từng lần làm, không lặp vô hạn', () => {
  const groups = groupWrongAnswersByQuiz(allAttempts, quizzes);
  const groupA = groups.find((g) => g.quizId === 'quiz-a');
  assert(Boolean(groupA), 'có nhóm quiz-a');
  if (!groupA) return;
  assert(groupA.attemptCount === 3, `quiz-a có ${groupA.attemptCount} lượt làm`);
  // q1 sai 3 lần (att-1,2,3), q3 sai 2 lần (att-1,2)
  assert(groupA.wrongAnswerCount === 5, `tổng lượt sai = ${groupA.wrongAnswerCount} (kỳ vọng 5)`);
  assert(groupA.uniqueWrongQuestions === 2, `câu sai duy nhất = ${groupA.uniqueWrongQuestions} (kỳ vọng 2)`);
  const q1Entry = groupA.entries.find((e) => e.question.id === 'q1');
  assert(q1Entry?.missCount === 3, 'q1 sai 3 lần');
  assert(q1Entry?.attempts.length === 3 && q1Entry.attempts.every((a) => a.attemptId), 'q1 giữ liên kết 3 lần làm nguồn');
  // quizB: q1 sai 1 lần (att-4), q4 sai 1 lần → nhưng att-5 làm đúng hết
  const groupB = groups.find((g) => g.quizId === 'quiz-b');
  assert(groupB?.wrongAnswerCount === 2, `quiz-b có ${groupB?.wrongAnswerCount} lượt sai`);
});

await testCase('Không lặp câu: luyện lại câu sai của một bộ đề trả câu duy nhất', () => {
  const groups = groupWrongAnswersByQuiz(allAttempts, quizzes);
  const groupA = groups.find((g) => g.quizId === 'quiz-a')!;
  const ids = groupA.entries.map((e) => e.question.id);
  assert(new Set(ids).size === ids.length, 'các câu trong nhóm không lặp');
  assert(ids.length === groupA.uniqueWrongQuestions, 'số câu = uniqueWrongQuestions');
});

// ===== Phân tích chủ đề điểm yếu =====
await testCase('Phân tích điểm yếu: nhóm theo topic từ dữ liệu thật, có tỷ lệ và số lần sai', () => {
  const weaknesses = analyzeTopicWeaknesses(allAttempts, quizzes);
  const algebra = weaknesses.find((w) => w.topic === 'Đại số');
  assert(Boolean(algebra), 'có nhóm Đại số');
  if (!algebra) return;
  // q1: sai ở att-1, att-2, att-3, att-4 (4 lần); q2: đúng 4 lần → answered 8, incorrect 4
  assert(algebra.answered === 8, `Đại số answered = ${algebra.answered} (kỳ vọng 8)`);
  assert(algebra.incorrect === 4, `Đại số incorrect = ${algebra.incorrect} (kỳ vọng 4)`);
  assert(algebra.accuracy === 50, `Đại số accuracy = ${algebra.accuracy}% (kỳ vọng 50%)`);
});

await testCase('Chủ đề không có topic trong dữ liệu → "Chưa phân loại", không tự bịa', () => {
  const qNoTopic = makeQuestion('q-no-topic', ''); // topic rỗng
  const quizNoTopic = makeQuiz('quiz-c', 'Đề C', 'Lịch sử.pdf', [qNoTopic]);
  const attemptNoTopic = makeAttempt('att-6', quizNoTopic, new Date().toISOString(), { 'q-no-topic': 'B' });
  const weaknesses = analyzeTopicWeaknesses([attemptNoTopic], [quizNoTopic]);
  assert(weaknesses.some((w) => w.topic === 'Chưa phân loại'), 'rơi vào nhóm Chưa phân loại');
  assert(weaknesses.every((w) => w.topic === 'Chưa phân loại'), 'không tự tạo tên chủ đề khác');
});

await testCase('significantWeakTopics bỏ qua chủ đề chỉ có 1 câu trả lời', () => {
  const weaknesses = analyzeTopicWeaknesses(allAttempts, quizzes);
  const significant = significantWeakTopics(weaknesses);
  assert(significant.every((t) => t.answered >= 2), 'mọi chủ đề điểm yếu có ≥ 2 câu trả lời');
  const geometry = weaknesses.find((w) => w.topic === 'Hình học');
  // Hình học: answered 3 (att-1,2 sai, att-3 đúng) → có trong weak nếu accuracy < 70
  if (geometry && geometry.answered < 2) {
    assert(!significant.includes(geometry), 'chủ đề 1 câu không bị coi là điểm yếu');
  }
});

await testCase('questionsForTopic trả câu hỏi có thật trong hệ thống cho chủ đề chọn luyện', () => {
  const questions = questionsForTopic('Đại số', allAttempts, quizzes);
  assert(questions.length === 2, `Đại số có ${questions.length} câu (kỳ vọng 2)`);
  assert(questions.every((q) => q.options.length === 4), 'câu hỏi có đủ 4 phương án');
});

// ===== isAttemptInDateRange trực tiếp =====
await testCase('Bản ghi không parse được thời gian bị loại khỏi mọi lọc thời gian', () => {
  const bad = { ...attempt1, completedAt: 'không phải ngày' };
  assert(!isAttemptInDateRange(bad, { search: '', dateRange: 'today' }), 'ngày sai → false');
});

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
