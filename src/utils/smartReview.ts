import { Question, QuizAttempt, QuizSet } from '../types';

export interface MissedQuestion {
  question: Question;
  quiz: QuizSet;
  missCount: number;
  lastMissedAt: string;
}

export interface WeakTopic {
  topic: string;
  incorrect: number;
  answered: number;
  accuracy: number;
}

function quizForAttempt(attempt: QuizAttempt, quizzes: QuizSet[]): QuizSet | undefined {
  return attempt.quizSnapshot || quizzes.find((quiz) => quiz.id === attempt.quizId);
}

export function analyzeReviewHistory(attempts: QuizAttempt[], quizzes: QuizSet[]) {
  const missed = new Map<string, MissedQuestion>();
  const topics = new Map<string, { incorrect: number; answered: number }>();

  for (const attempt of attempts) {
    const quiz = quizForAttempt(attempt, quizzes);
    const answers = (attempt as QuizAttempt & { answers?: QuizAttempt['answers'] }).answers;
    if (!quiz || !answers || typeof answers !== 'object') continue;

    for (const question of quiz.questions || []) {
      const selected = answers[question.id];
      if (!selected) continue; // Old summary-only attempts and unanswered questions cannot identify an error.

      const topic = question.topic?.trim() || 'Chưa phân loại';
      const topicStats = topics.get(topic) || { incorrect: 0, answered: 0 };
      topicStats.answered += 1;
      const isCorrect = selected === question.correctAnswer;
      if (!isCorrect) {
        topicStats.incorrect += 1;
        const key = `${attempt.quizId}:${question.id}`;
        const existing = missed.get(key);
        const missedAt = attempt.completedAt;
        missed.set(key, {
          question,
          quiz,
          missCount: (existing?.missCount || 0) + 1,
          lastMissedAt: !existing || Date.parse(missedAt) > Date.parse(existing.lastMissedAt)
            ? missedAt
            : existing.lastMissedAt,
        });
      }
      topics.set(topic, topicStats);
    }
  }

  const missedQuestions = [...missed.values()].sort((a, b) =>
    b.missCount - a.missCount || Date.parse(b.lastMissedAt) - Date.parse(a.lastMissedAt)
  );
  const weakTopics = [...topics.entries()]
    .filter(([, stats]) => stats.incorrect > 0)
    .map(([topic, stats]): WeakTopic => ({
      topic,
      incorrect: stats.incorrect,
      answered: stats.answered,
      accuracy: Math.round(((stats.answered - stats.incorrect) / stats.answered) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);

  return { missedQuestions, weakTopics };
}

export function createReviewQuiz(
  title: string,
  questions: Question[],
  sourceQuizzes: QuizSet[],
): QuizSet | null {
  const unique = new Map<string, Question>();
  for (const question of questions) {
    const hasFourAnswers = Array.isArray(question.options) && question.options.length === 4 &&
      new Set(question.options.map((option) => option.key)).size === 4 &&
      ['A', 'B', 'C', 'D'].every((key) => question.options.some((option) => option.key === key && option.text?.trim()));
    if (hasFourAnswers && ['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
      unique.set(question.id, question);
    }
  }
  const selected = [...unique.values()].map((question, index) => ({ ...question, questionNumber: index + 1 }));
  if (selected.length === 0) return null;

  const source = sourceQuizzes[0];
  return {
    id: `review-${Date.now()}`,
    title,
    documentId: source?.documentId,
    documentName: 'Câu hỏi có sẵn trong bộ đề của bạn',
    createdAt: new Date().toISOString(),
    totalQuestions: selected.length,
    recommendedMinutes: Math.max(3, Math.round(selected.length * 1.5)),
    difficulty: 'all',
    questionType: 'multiple_choice',
    quizStyle: 'review',
    questions: selected,
  };
}
