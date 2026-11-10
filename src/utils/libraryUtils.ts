/**
 * Nghiệp vụ cho trang Kho học tập: lọc lịch sử làm bài, thống kê, phân trang,
 * nhóm câu sai theo bộ đề và phân tích chủ đề điểm yếu.
 *
 * Nguyên tắc:
 * - Dữ liệu đầu vào là dữ liệu thật của người dùng (allAttempts/allQuizzes từ workspace).
 * - Lọc thời gian dựa trên Date object, so sánh ranh giới ngày theo múi giờ cục bộ
 *   (không so sánh chuỗi ISO tùy tiện).
 * - Mỗi bản ghi lịch sử là MỘT lần làm bài riêng — không gộp nhiều lần làm cùng bộ đề.
 */
import { Question, QuizAttempt, QuizSet } from '../types';

// ===== Lọc thời gian =====

export type DateRangeKey = 'all' | 'today' | 'last7' | 'this_month' | 'month_year' | 'custom';

export interface AttemptFilters {
  search: string;
  dateRange: DateRangeKey;
  /** Chỉ dùng khi dateRange === 'month_year' */
  month?: number; // 1-12
  year?: number;
  /** Chỉ dùng khi dateRange === 'custom' (ISO strings; so sánh theo ngày cục bộ) */
  from?: string;
  to?: string;
  quizId?: string;
  documentName?: string;
}

export interface DayBoundary {
  startMs: number;
  endMs: number;
}

/** Ranh giới ngày bắt đầu 00:00 và kết thúc 23:59.999 theo múi giờ cục bộ. */
export function localDayRange(date: Date): DayBoundary {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export function isSameLocalDay(value: Date, reference: Date): boolean {
  const a = localDayRange(value);
  const b = localDayRange(reference);
  return a.startMs === b.startMs;
}

function attemptTime(attempt: QuizAttempt): number {
  const parsed = Date.parse(attempt.completedAt || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Kiểm tra một lần làm bài có nằm trong khoảng lọc thời gian.
 * - today: cùng ngày cục bộ với hiện tại.
 * - last7: 7 ngày tính lùi (bao gồm hôm nay) — ranh giới 00:00 của (hôm nay - 6 ngày).
 * - this_month: cùng tháng/năm cục bộ.
 * - month_year: tháng/năm do người dùng chọn.
 * - custom: ngày bắt đầu–kết thúc (mỗi mốc áp cả hai đầu, theo ngày cục bộ).
 */
export function isAttemptInDateRange(attempt: QuizAttempt, filters: AttemptFilters, now: Date = new Date()): boolean {
  const time = attemptTime(attempt);
  if (time === 0) return false;

  switch (filters.dateRange) {
    case 'all':
      return true;
    case 'today':
      return isSameLocalDay(new Date(time), now);
    case 'last7': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
      return time >= start;
    }
    case 'this_month': {
      const d = new Date(time);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    case 'month_year': {
      if (!filters.month || !filters.year) return false;
      const d = new Date(time);
      return d.getFullYear() === filters.year && d.getMonth() === filters.month - 1;
    }
    case 'custom': {
      if (!filters.from && !filters.to) return true;
      if (filters.from) {
        const fromMs = localDayRange(new Date(filters.from)).startMs;
        if (Number.isNaN(fromMs) || time < fromMs) return false;
      }
      if (filters.to) {
        const toMs = localDayRange(new Date(filters.to)).endMs;
        if (Number.isNaN(toMs) || time > toMs) return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/** Danh sách các lựa chọn tháng/năm có sẵn trong dữ liệu lịch sử (mới nhất trước). */
export function availablePeriods(attempts: QuizAttempt[]): Array<{ year: number; month: number; label: string }> {
  const seen = new Map<string, { year: number; month: number; label: string; time: number }>();
  for (const attempt of attempts) {
    const time = attemptTime(attempt);
    if (time === 0) continue;
    const d = new Date(time);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(d);
    const existing = seen.get(key);
    if (!existing || time > existing.time) seen.set(key, { year: d.getFullYear(), month: d.getMonth() + 1, label, time });
  }
  return [...seen.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

// ===== Lọc & thống kê lịch sử làm bài =====

export function filterAttempts(
  attempts: QuizAttempt[],
  quizzes: QuizSet[],
  filters: AttemptFilters
): QuizAttempt[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const term = filters.search.trim().toLowerCase();

  return attempts
    .filter((attempt) => {
      if (filters.quizId && attempt.quizId !== filters.quizId) return false;
      if (filters.documentName) {
        const quiz = quizById.get(attempt.quizId);
        if (!quiz || quiz.documentName !== filters.documentName) return false;
      }
      if (term) {
        const quiz = quizById.get(attempt.quizId);
        const haystacks = [
          attempt.quizTitle || '',
          quiz?.title || '',
          quiz?.documentName || '',
        ];
        if (!haystacks.some((value) => value.toLowerCase().includes(term))) return false;
      }
      return isAttemptInDateRange(attempt, filters);
    })
    .sort((a, b) => attemptTime(b) - attemptTime(a)); // Mới nhất trước
}

export interface AttemptStats {
  totalAttempts: number;
  averageScore: number | null;
  averageAccuracy: number | null;
  totalWrong: number;
  totalCorrect: number;
}

export function computeAttemptStats(filtered: QuizAttempt[]): AttemptStats {
  if (filtered.length === 0) {
    return { totalAttempts: 0, averageScore: null, averageAccuracy: null, totalWrong: 0, totalCorrect: 0 };
  }
  const scored = filtered.filter((attempt) => typeof attempt.score === 'number' && !Number.isNaN(attempt.score));
  const totalQuestions = filtered.reduce((sum, attempt) => sum + (attempt.totalQuestions || 0), 0);
  const totalCorrect = filtered.reduce((sum, attempt) => sum + (attempt.correctCount || 0), 0);
  return {
    totalAttempts: filtered.length,
    averageScore: scored.length ? scored.reduce((sum, a) => sum + a.score, 0) / scored.length : null,
    averageAccuracy: totalQuestions ? (totalCorrect / totalQuestions) * 100 : null,
    totalWrong: filtered.reduce((sum, attempt) => sum + (attempt.wrongCount || Math.max(0, (attempt.totalQuestions || 0) - (attempt.correctCount || 0))), 0),
    totalCorrect,
  };
}

// ===== Phân trang =====

export const ATTEMPTS_PAGE_SIZE = 15;

export function paginateAttempts(all: QuizAttempt[], page: number, pageSize: number = ATTEMPTS_PAGE_SIZE): QuizAttempt[] {
  const start = (page - 1) * pageSize;
  return all.slice(start, start + pageSize);
}

export function totalPagesFor(total: number, pageSize: number = ATTEMPTS_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// ===== Số liệu hỗ trợ chọn bộ lọc =====

export function availableQuizOptions(attempts: QuizAttempt[], quizzes: QuizSet[]): Array<{ id: string; title: string; documentName: string; attemptCount: number }> {
  const counts = new Map<string, number>();
  for (const attempt of attempts) counts.set(attempt.quizId, (counts.get(attempt.quizId) || 0) + 1);
  return [...counts.entries()]
    .map(([id, attemptCount]) => {
      const quiz = quizzes.find((q) => q.id === id);
      return {
        id,
        title: quiz?.title || attempts.find((a) => a.quizId === id)?.quizTitle || id,
        documentName: quiz?.documentName || '',
        attemptCount,
      };
    })
    .sort((a, b) => b.attemptCount - a.attemptCount);
}

export function availableDocumentNames(attempts: QuizAttempt[], quizzes: QuizSet[]): string[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  return [...new Set(
    attempts
      .map((attempt) => quizById.get(attempt.quizId)?.documentName)
      .filter((name): name is string => Boolean(name))
  )].sort((a, b) => a.localeCompare(b, 'vi'));
}

// ===== Nhóm câu sai theo bộ đề (Chế độ A: Luyện lại câu sai theo bộ đề) =====

export interface WrongQuestionEntry {
  question: Question;
  /** Các lần làm mà câu này bị sai (mỗi phần tử là một lần làm riêng). */
  attempts: Array<{ attemptId: string; completedAt: string; selectedAnswer: string }>;
  missCount: number;
  lastMissedAt: string;
}

export interface QuizWrongGroup {
  quizId: string;
  quizTitle: string;
  documentName: string;
  attemptCount: number;
  /** Tổng số lượt trả lời sai (một câu sai nhiều lần được đếm từng lần). */
  wrongAnswerCount: number;
  /** Số câu sai duy nhất (một câu sai ở nhiều lần làm chỉ đếm một lần). */
  uniqueWrongQuestions: number;
  entries: WrongQuestionEntry[];
}

/**
 * Gộp câu sai theo bộ đề, giữ liên kết về từng lần làm bài nguồn.
 * Một câu sai ở nhiều lần làm được gộp thành 1 entry với danh sách các lần làm,
 * tránh lặp vô hạn khi luyện lại.
 */
export function groupWrongAnswersByQuiz(
  attempts: QuizAttempt[],
  quizzes: QuizSet[]
): QuizWrongGroup[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const groups = new Map<string, {
    quiz: QuizSet | undefined;
    title: string;
    entries: Map<string, WrongQuestionEntry>;
    attemptCount: number;
    wrongAnswerCount: number;
  }>();

  for (const attempt of attempts) {
    const quiz = attempt.quizSnapshot || quizById.get(attempt.quizId);
    if (!quiz) continue;

    let group = groups.get(attempt.quizId);
    if (!group) {
      group = { quiz, title: attempt.quizTitle || quiz.title, entries: new Map(), attemptCount: 0, wrongAnswerCount: 0 };
      groups.set(attempt.quizId, group);
    }
    group.attemptCount += 1;

    const answers = attempt.answers || {};
    for (const question of quiz.questions || []) {
      const selected = answers[question.id];
      if (!selected) continue; // câu bỏ trống không xác định được "sai" từ lựa chọn
      const isCorrect = selected === question.correctAnswer;
      if (isCorrect) continue;

      group.wrongAnswerCount += 1;
      const entry = group.entries.get(question.id) || { question, attempts: [], missCount: 0, lastMissedAt: '' };
      entry.attempts.push({ attemptId: attempt.id, completedAt: attempt.completedAt, selectedAnswer: selected });
      entry.missCount += 1;
      if (!entry.lastMissedAt || Date.parse(attempt.completedAt) > Date.parse(entry.lastMissedAt)) {
        entry.lastMissedAt = attempt.completedAt;
      }
      group.entries.set(question.id, entry);
    }
  }

  return [...groups.entries()]
    .map(([quizId, group]): QuizWrongGroup => ({
      quizId,
      quizTitle: group.title,
      documentName: group.quiz?.documentName || '',
      attemptCount: group.attemptCount,
      wrongAnswerCount: group.wrongAnswerCount,
      uniqueWrongQuestions: group.entries.size,
      entries: [...group.entries.values()].sort(
        (a, b) => b.missCount - a.missCount || Date.parse(b.lastMissedAt) - Date.parse(a.lastMissedAt)
      ),
    }))
    .filter((group) => group.wrongAnswerCount > 0)
    .sort((a, b) => b.wrongAnswerCount - a.wrongAnswerCount || b.attemptCount - a.attemptCount);
}

// ===== Phân tích chủ đề điểm yếu (Chế độ B) =====

export interface TopicWeakness {
  topic: string;
  answered: number;
  incorrect: number;
  accuracy: number;
  /** Số lần làm bài riêng có câu sai thuộc chủ đề này. */
  attemptsWithWrong: number;
}

/** Số lần làm bài tối thiểu trước khi một chủ đề được coi là có dữ liệu đủ tin cậy. */
export const MIN_ATTEMPTS_FOR_TOPIC_SIGNAL = 1;

/**
 * Nhóm câu trả lời sai theo chủ đề (question.topic). Chủ đề lấy từ question.topic
 * của dữ liệu thật; nếu không có → "Chưa phân loại" (không tự bịa).
 * Chỉ tính chủ đề có tỷ lệ sai vượt ngưỡng hoặc nhiều lần sai để tránh đánh giá
 * điểm yếu chỉ từ một câu hỏi đơn lẻ.
 */
export function analyzeTopicWeaknesses(attempts: QuizAttempt[], quizzes: QuizSet[]): TopicWeakness[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const stats = new Map<string, { answered: number; incorrect: number; attemptsWithWrong: Set<string> }>();

  for (const attempt of attempts) {
    const quiz = attempt.quizSnapshot || quizById.get(attempt.quizId);
    if (!quiz) continue;
    const answers = attempt.answers || {};
    for (const question of quiz.questions || []) {
      const selected = answers[question.id];
      if (!selected) continue;
      const topic = question.topic?.trim() || 'Chưa phân loại';
      const entry = stats.get(topic) || { answered: 0, incorrect: 0, attemptsWithWrong: new Set<string>() };
      entry.answered += 1;
      if (selected !== question.correctAnswer) {
        entry.incorrect += 1;
        entry.attemptsWithWrong.add(attempt.id);
      }
      stats.set(topic, entry);
    }
  }

  return [...stats.entries()]
    .map(([topic, entry]): TopicWeakness => ({
      topic,
      answered: entry.answered,
      incorrect: entry.incorrect,
      accuracy: entry.answered ? Math.round(((entry.answered - entry.incorrect) / entry.answered) * 100) : 100,
      attemptsWithWrong: entry.attemptsWithWrong.size,
    }))
    .sort((a, b) => {
      // Ưu tiên: tỷ lệ đúng thấp hơn trước; nếu gần bằng thì ưu tiên chủ đề có nhiều dữ liệu hơn.
      const aSignal = a.accuracy < 50 ? 1 : 0;
      const bSignal = b.accuracy < 50 ? 1 : 0;
      if (aSignal !== bSignal) return bSignal - aSignal;
      return a.accuracy - b.accuracy || b.answered - a.answered;
    });
}

/**
 * Chủ đề thực sự cần củng cố: tỷ lệ đúng < 70% và có ≥ 2 câu trả lời
 * (tránh kết luận điểm yếu chỉ từ một câu hỏi đơn lẻ).
 */
export function significantWeakTopics(weaknesses: TopicWeakness[]): TopicWeakness[] {
  return weaknesses.filter((topic) => topic.answered >= 2 && topic.accuracy < 70);
}

/** Tập câu hỏi của một chủ đề (từ các bộ đề có dữ liệu thật) để bắt đầu luyện tập. */
export function questionsForTopic(topic: string, attempts: QuizAttempt[], quizzes: QuizSet[]): Question[] {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const seen = new Map<string, Question>();
  for (const attempt of attempts) {
    const quiz = attempt.quizSnapshot || quizById.get(attempt.quizId);
    for (const question of quiz?.questions || []) {
      const qTopic = question.topic?.trim() || 'Chưa phân loại';
      if (qTopic === topic && !seen.has(question.id)) seen.set(question.id, question);
    }
  }
  for (const quiz of quizzes) {
    for (const question of quiz.questions || []) {
      const qTopic = question.topic?.trim() || 'Chưa phân loại';
      if (qTopic === topic && !seen.has(question.id)) seen.set(question.id, question);
    }
  }
  return [...seen.values()];
}
