import React, { useState, useEffect } from 'react';
import { QuizSet, QuizAttempt } from '../types';

interface QuizTakingScreenProps {
  quizSet: QuizSet;
  onSubmitQuiz: (attempt: QuizAttempt) => void;
  onExitQuiz: () => void;
}

export const QuizTakingScreen: React.FC<QuizTakingScreenProps> = ({
  quizSet,
  onSubmitQuiz,
  onExitQuiz,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(quizSet.recommendedMinutes * 60);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [startTime] = useState<number>(Date.now());

  const currentQuestion = quizSet.questions[currentIndex];
  const totalQuestions = quizSet.questions.length;

  // Countdown timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Keyboard shortcut listener for A, B, C, D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        return;
      }
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        handleSelectOption(key as 'A' | 'B' | 'C' | 'D');
      } else if (e.key === 'ArrowRight' && currentIndex < totalQuestions - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion]);

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: key,
    }));
  };

  const handleToggleFlag = (id: string) => {
    setFlagged((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFinish = (forced: boolean = false) => {
    setShowSubmitModal(false);

    let correctCount = 0;
    const categoryStats: Record<string, { correct: number; total: number }> = {};
    const diffStats: Record<string, { correct: number; total: number }> = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 },
    };

    quizSet.questions.forEach((q) => {
      const topic = q.topic || 'Kiến thức chung';
      if (!categoryStats[topic]) {
        categoryStats[topic] = { correct: 0, total: 0 };
      }
      categoryStats[topic].total += 1;

      const diff = q.difficulty || 'medium';
      if (!diffStats[diff]) {
        diffStats[diff] = { correct: 0, total: 0 };
      }
      diffStats[diff].total += 1;

      const userAnswer = answers[q.id];
      if (userAnswer === q.correctAnswer) {
        correctCount += 1;
        categoryStats[topic].correct += 1;
        diffStats[diff].correct += 1;
      }
    });

    const total = quizSet.questions.length;
    const score = Number(((correctCount / total) * 10).toFixed(1));
    const percentage = Math.round((correctCount / total) * 100);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    const flaggedList = Object.keys(flagged).filter((k) => flagged[k]);

    const attempt: QuizAttempt = {
      id: `attempt-${Date.now()}`,
      quizId: quizSet.id,
      quizTitle: quizSet.title,
      completedAt: new Date().toISOString(),
      timeSpentSeconds: timeSpent,
      answers,
      flaggedQuestions: flaggedList,
      score,
      percentage,
      correctCount,
      wrongCount: total - correctCount - (total - Object.keys(answers).length),
      unansweredCount: total - Object.keys(answers).length,
      totalQuestions: total,
      categoryBreakdown: Object.keys(categoryStats).map((cat) => ({
        category: cat,
        correct: categoryStats[cat].correct,
        total: categoryStats[cat].total,
        accuracy: Math.round((categoryStats[cat].correct / categoryStats[cat].total) * 100),
      })),
      difficultyBreakdown: [
        { difficulty: 'easy', label: 'Dễ (Nhận biết)', correct: diffStats.easy.correct, total: diffStats.easy.total },
        { difficulty: 'medium', label: 'Trung bình (Thông hiểu)', correct: diffStats.medium.correct, total: diffStats.medium.total },
        { difficulty: 'hard', label: 'Khó (Vận dụng)', correct: diffStats.hard.correct, total: diffStats.hard.total },
      ],
    };

    onSubmitQuiz(attempt);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <div className="min-h-[calc(100vh-8rem)] pb-16">
      {/* Sticky Exam Progress Bar */}
      <div className="bg-white border-b border-[#e2e4e8] sticky top-24 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: Progress info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onExitQuiz}
              id="btn-quit-exam"
              className="p-1.5 text-[#777587] hover:text-[#ba1a1a] rounded-lg transition-colors"
              title="Thoát bài thi"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            <div>
              <div className="text-xs font-semibold text-[#191c1e] flex items-center gap-2">
                <span>Câu {currentIndex + 1} / {totalQuestions}</span>
                <span className="text-[#777587]">• Đã làm: {answeredCount}/{totalQuestions}</span>
              </div>
              {/* Mini progress bar */}
              <div className="w-32 sm:w-48 h-1.5 bg-[#e6e8ea] rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#3525cd] rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Center: Timer */}
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                timeRemaining < 120
                  ? 'bg-[#fee2e2] text-[#ba1a1a] animate-pulse'
                  : 'bg-[#f2f4f6] text-[#191c1e]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">schedule</span>
              <span>{formatTimer(timeRemaining)}</span>
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              id="btn-pause-timer"
              className="p-1 text-[#777587] hover:text-[#191c1e] transition-colors"
              title={isPaused ? 'Tiếp tục làm bài' : 'Tạm dừng thời gian'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
            </button>
          </div>

          {/* Right: Submit Button */}
          <div>
            <button
              onClick={() => setShowSubmitModal(true)}
              id="btn-submit-exam-top"
              className="px-4 py-1.5 text-xs sm:text-sm font-bold bg-[#3525cd] hover:bg-[#291cb0] text-white rounded-lg shadow-xs transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">done_all</span>
              <span>Nộp bài</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Active Question */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-[#e2e4e8] p-6 sm:p-8 shadow-xs space-y-6">
            {/* Question Top Meta */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e4e8]">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-[#3525cd]/10 text-[#3525cd] font-bold text-xs">
                  Câu hỏi {currentIndex + 1}
                </span>
                {currentQuestion.topic && (
                  <span className="text-xs font-medium text-[#777587]">
                    Chuyên đề: {currentQuestion.topic}
                  </span>
                )}
              </div>

              {/* Flag button */}
              <button
                onClick={() => handleToggleFlag(currentQuestion.id)}
                id="btn-toggle-flag"
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  flagged[currentQuestion.id]
                    ? 'bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]'
                    : 'text-[#777587] hover:bg-[#f2f4f6] hover:text-[#191c1e]'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${flagged[currentQuestion.id] ? 'fill' : ''}`}>
                  bookmark
                </span>
                <span>{flagged[currentQuestion.id] ? 'Đã đánh dấu cờ' : 'Đánh dấu xem lại'}</span>
              </button>
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#191c1e] leading-relaxed">
                {currentQuestion.questionText}
              </h2>
              <p className="text-xs text-[#777587]">
                Chọn 1 trong 4 phương án bên dưới (hoặc dùng phím tắt A, B, C, D):
              </p>
            </div>

            {/* 4 Interactive Option Cards */}
            <div className="space-y-3 pt-2">
              {currentQuestion.options.map((opt) => {
                const isSelected = answers[currentQuestion.id] === opt.key;

                return (
                  <div
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    id={`option-${opt.key}`}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-4 select-none ${
                      isSelected
                        ? 'border-[#3525cd] bg-[#3525cd]/5 shadow-xs'
                        : 'border-[#e2e4e8] hover:border-[#c7c4d8] bg-white hover:bg-[#f7f9fb]'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                        isSelected
                          ? 'bg-[#3525cd] text-white'
                          : 'bg-[#f2f4f6] text-[#464555] border border-[#e2e4e8]'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <div className="flex-1 text-sm sm:text-base text-[#191c1e] pt-0.5 leading-relaxed">
                      {opt.text}
                    </div>
                    <div className="mt-1 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#3525cd] bg-[#3525cd]' : 'border-[#c7c4d8]'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Question Controls */}
            <div className="pt-6 border-t border-[#e2e4e8] flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                id="btn-prev-question"
                className="px-4 py-2 rounded-xl border border-[#e2e4e8] text-xs sm:text-sm font-semibold text-[#464555] hover:bg-[#f7f9fb] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Câu trước</span>
              </button>

              {isLastQuestion ? (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  id="btn-submit-exam-bottom"
                  className="px-6 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#3525cd]/25 transition-all flex items-center gap-1.5"
                >
                  <span>Nộp bài kiểm tra</span>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </button>
              ) : (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  id="btn-next-question"
                  className="px-5 py-2 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>Câu tiếp theo</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette Grid */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-[#e2e4e8] p-5 shadow-xs space-y-4 sticky top-40">
            <h3 className="font-display font-bold text-sm text-[#191c1e] flex items-center justify-between">
              <span>Bảng câu hỏi ({totalQuestions})</span>
              <span className="text-xs text-[#777587] font-normal">{answeredCount}/{totalQuestions} đã làm</span>
            </h3>

            {/* Grid of question number buttons */}
            <div className="grid grid-cols-5 gap-2">
              {quizSet.questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = idx === currentIndex;
                const isFlagged = !!flagged[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    id={`palette-btn-${idx + 1}`}
                    className={`relative h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                      isCurrent
                        ? 'ring-2 ring-[#3525cd] ring-offset-2'
                        : ''
                    } ${
                      isAnswered
                        ? 'bg-[#3525cd] text-white'
                        : 'bg-[#f7f9fb] text-[#464555] border border-[#e2e4e8] hover:bg-[#e6e8ea]'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f59e0b] rounded-full ring-2 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-[#e2e4e8] space-y-1.5 text-[11px] text-[#777587]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#3525cd]" />
                <span>Đã trả lời ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#f7f9fb] border border-[#e2e4e8]" />
                <span>Chưa trả lời ({totalQuestions - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <span>Đã đánh dấu xem lại ({Object.values(flagged).filter(Boolean).length})</span>
              </div>
            </div>

            {/* Quick Submit */}
            <div className="pt-2">
              <button
                onClick={() => setShowSubmitModal(true)}
                id="btn-sidebar-submit"
                className="w-full py-2.5 rounded-xl border-2 border-[#3525cd] text-[#3525cd] hover:bg-[#3525cd] hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Nộp bài thi</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#e2e4e8] shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-[#e2dfff]/60 text-[#3525cd] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">assignment_turned_in</span>
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-display text-lg font-bold text-[#191c1e]">
                Xác nhận nộp bài thi?
              </h3>
              <p className="text-xs text-[#777587]">
                Bạn đã trả lời <span className="font-bold text-[#3525cd]">{answeredCount}</span> trên tổng số{' '}
                <span className="font-bold text-[#191c1e]">{totalQuestions}</span> câu hỏi.
              </p>
            </div>

            {totalQuestions - answeredCount > 0 && (
              <div className="p-3 rounded-xl bg-[#fee2e2]/60 border border-[#ba1a1a]/20 text-[#ba1a1a] text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Còn {totalQuestions - answeredCount} câu chưa điền đáp án!</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                id="btn-cancel-submit"
                className="flex-1 py-2.5 rounded-xl border border-[#e2e4e8] hover:bg-[#f7f9fb] text-xs font-semibold text-[#464555] transition-colors"
              >
                Tiếp tục làm bài
              </button>
              <button
                onClick={() => handleFinish(false)}
                id="btn-confirm-submit"
                className="flex-1 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs font-bold shadow-md shadow-[#3525cd]/25 transition-all"
              >
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
