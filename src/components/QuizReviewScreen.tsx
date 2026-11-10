import React, { useState } from 'react';
import { QuizAttempt, QuizSet, Question } from '../types';
import { SourceViewerModal } from './SourceViewerModal';
import { PracticeModal } from './PracticeModal';

interface QuizReviewScreenProps {
  attempt: QuizAttempt;
  quizSet: QuizSet;
  onBackToResult: () => void;
  onRetakeQuiz: () => void;
}

export const QuizReviewScreen: React.FC<QuizReviewScreenProps> = ({
  attempt,
  quizSet,
  onBackToResult,
  onRetakeQuiz,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'wrong' | 'flagged'>('all');
  const [selectedSourceQuestion, setSelectedSourceQuestion] = useState<Question | null>(null);
  const [practiceKU, setPracticeKU] = useState<{
    name: string;
    sourceText: string;
    chapter: string;
    section: string;
    page: number;
  } | null>(null);

  const filteredQuestions = quizSet.questions.filter((q) => {
    const userAnswer = attempt.answers[q.id];
    const isCorrect = userAnswer === q.correctAnswer;
    const isFlagged = attempt.flaggedQuestions.includes(q.id);

    if (filterType === 'correct') return isCorrect;
    if (filterType === 'wrong') return !isCorrect;
    if (filterType === 'flagged') return isFlagged;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={onBackToResult}
            id="btn-back-to-result"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors mb-2"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Quay lại bảng kết quả thi</span>
          </button>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            Tra cứu lời giải chi tiết & Minh chứng nguồn gốc
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Điểm số: <span className="font-bold text-indigo-700">{attempt.score}/10</span> ({attempt.correctCount}/{attempt.totalQuestions} câu đúng)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRetakeQuiz}
            id="btn-review-retake"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">replay</span>
            <span>Làm lại bài thi</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterType === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả ({quizSet.questions.length})
        </button>
        <button
          onClick={() => setFilterType('correct')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            filterType === 'correct'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">check</span>
          Câu đúng ({attempt.correctCount})
        </button>
        <button
          onClick={() => setFilterType('wrong')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            filterType === 'wrong'
              ? 'bg-red-600 text-white shadow-xs'
              : 'bg-red-50 text-red-800 hover:bg-red-100'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
          Câu sai ({attempt.wrongCount})
        </button>
        <button
          onClick={() => setFilterType('flagged')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            filterType === 'flagged'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">bookmark</span>
          Đã gắn cờ ({attempt.flaggedQuestions.length})
        </button>
      </div>

      {/* Review Cards */}
      <div className="space-y-6">
        {filteredQuestions.map((q, idx) => {
          const userAnswer = attempt.answers[q.id];
          const isCorrect = userAnswer === q.correctAnswer;
          const isFlagged = attempt.flaggedQuestions.includes(q.id);

          return (
            <div
              key={q.id}
              id={`review-question-card-${q.id}`}
              className={`bg-white rounded-2xl border p-6 shadow-2xs space-y-5 transition-all ${
                isCorrect ? 'border-emerald-300' : 'border-red-300'
              }`}
            >
              {/* Card Meta Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                    Câu {idx + 1}
                  </span>
                  {isCorrect ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      Chính xác
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                      Chưa đúng
                    </span>
                  )}

                  {/* Chapter & Page */}
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                    {q.source.chapter} • Trang {q.source.page}
                  </span>

                  {isFlagged && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">bookmark</span>
                      Đã gắn cờ
                    </span>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedSourceQuestion(q)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">travel_explore</span>
                    <span>Truy xuất nguồn</span>
                  </button>

                  {!isCorrect && (
                    <button
                      onClick={() =>
                        setPracticeKU({
                          name: q.source.knowledgeUnit,
                          sourceText: q.source.sourceText,
                          chapter: q.source.chapter,
                          section: q.source.section,
                          page: q.source.page,
                        })
                      }
                      className="px-3 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[15px]">school</span>
                      <span>Học lại & Luyện 3 câu</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-snug">
                {q.questionText}
              </h3>

              {/* 4 Options */}
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const isUserPick = userAnswer === opt.key;
                  const isTargetAnswer = q.correctAnswer === opt.key;

                  let borderClass = 'border-slate-200 bg-slate-50/70 text-slate-700';
                  if (isTargetAnswer) {
                    borderClass = 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-semibold';
                  } else if (isUserPick && !isCorrect) {
                    borderClass = 'border-red-500 bg-red-50/50 text-red-950 font-medium line-through';
                  }

                  return (
                    <div
                      key={opt.key}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-start justify-between gap-3 ${borderClass}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                            isTargetAnswer
                              ? 'bg-emerald-600 text-white'
                              : isUserPick
                              ? 'bg-red-600 text-white'
                              : 'bg-white text-slate-500 border border-slate-200'
                          }`}
                        >
                          {opt.key}
                        </span>
                        <span className="leading-relaxed">{opt.text}</span>
                      </div>

                      <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold">
                        {isTargetAnswer && (
                          <span className="text-emerald-700 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            Đáp án đúng
                          </span>
                        )}
                        {isUserPick && !isCorrect && (
                          <span className="text-red-700 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                            Bạn đã chọn
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Explanation Container */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                  <span>Giải thích chi tiết (Đáp án {q.correctAnswer}):</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm">
                  {q.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <SourceViewerModal
        question={selectedSourceQuestion}
        isOpen={Boolean(selectedSourceQuestion)}
        onClose={() => setSelectedSourceQuestion(null)}
      />

      {practiceKU && (
        <PracticeModal
          knowledgeUnitName={practiceKU.name}
          sourceText={practiceKU.sourceText}
          chapter={practiceKU.chapter}
          section={practiceKU.section}
          page={practiceKU.page}
          document={null}
          isOpen={Boolean(practiceKU)}
          onClose={() => setPracticeKU(null)}
        />
      )}
    </div>
  );
};
