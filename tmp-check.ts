import { filterAttempts } from './src/utils/libraryUtils';
import type { QuizAttempt, QuizSet, Question } from './src/types';

function makeQuestion(id: string, topic: string, correct: 'A' | 'B' | 'C' | 'D' = 'A'): Question {
  return {
    id, questionNumber: 1, questionText: `Q ${id} ${topic}`,
    options: [
      { key: 'A', text: 'A' }, { key: 'B', text: 'B' }, { key: 'C', text: 'C' }, { key: 'D', text: 'D' },
    ], correctAnswer: correct, explanation: 'x', difficulty: 'medium', topic,
    source: { documentId: 'd', documentName: 'f', chapter: 'c', section: 's', page: 1, sourceText: 'st', knowledgeUnit: 'k', generationReason: 'r' },
  } as any;
}
function makeQuiz(id: string, title: string, documentName: string, questions: Question[]): QuizSet {
  return {
    id, title, documentId: 'doc-1', documentName, createdAt: new Date().toISOString(),
    totalQuestions: questions.length, recommendedMinutes: 10, difficulty: 'medium',
    questionType: 'multiple_choice', quizStyle: 'standard', questions
  } as any;
}
function makeAttempt(id: string, quiz: QuizSet, completedAt: string, answers: Record<string, string>): QuizAttempt {
  const values = Object.values(answers);
  const correct = quiz.questions.filter(q => answers[q.id] === q.correctAnswer).length;
  const total = quiz.questions.length;
  return {
    id, quizId: quiz.id, quizTitle: quiz.title, completedAt, timeSpentSeconds: 300,
    answers: answers as any, flaggedQuestions: [], score: Math.round((correct / total) * 100) / 10,
    percentage: Math.round((correct / total) * 100), correctCount: correct,
    wrongCount: values.filter((sel, idx) => quiz.questions[idx] && quiz.questions[idx].correctAnswer !== sel).length,
    unansweredCount: total - values.length, totalQuestions: total, categoryBreakdown: [],
    difficultyBreakdown: [], quizSnapshot: quiz
  } as any;
}

const qAlg1 = makeQuestion('q1', 'Đại số');
const qAlg2 = makeQuestion('q2', 'Đại số');
const qGeo = makeQuestion('q3', 'Hình học', 'B');
const quizA = makeQuiz('quiz-a', 'Đề Đại số A', 'Toán 12.pdf', [qAlg1, qAlg2, qGeo]);
const quizB = makeQuiz('quiz-b', 'Đề ôn B', 'Toán 12.pdf', [qAlg1, makeQuestion('q4', 'Xác suất', 'C')]);

const today = new Date();
const attempt1 = makeAttempt('att-1', quizA, new Date(today.getTime() - 3600_000).toISOString(), { q1: 'B', q2: 'A', q3: 'A' });
const attempt2 = makeAttempt('att-2', quizA, new Date(today.getFullYear(), today.getMonth(), today.getDate() > 15 ? 15 : Math.max(1, today.getDate() - 1), 12, 0, 0).toISOString(), { q1: 'C', q2: 'A', q3: 'A' });
const attempt3 = makeAttempt('att-3', quizA, new Date(today.getTime() - 10 * 86400_000).toISOString(), { q1: 'D', q2: 'A', q3: 'B' });
const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
const attempt4 = makeAttempt('att-4', quizB, twoMonthsAgo.toISOString(), { q1: 'B', q4: 'A' });
const attempt5 = makeAttempt('att-5', quizB, new Date(today.getTime() - 7200_000).toISOString(), { q1: 'A', q4: 'C' });

const allAttempts = [attempt1, attempt2, attempt3, attempt4, attempt5];
console.log('att2 =', attempt2.completedAt, new Date(attempt2.completedAt).toString());
console.log('att4 =', attempt4.completedAt, new Date(attempt4.completedAt).toString());
const r = filterAttempts(allAttempts, [quizA, quizB], { search: '', dateRange: 'this_month' });
console.log('this_month ids:', r.map(a => a.id).join(','));
