import React from 'react';
import { QuizAttempt, QuizSet } from '../types';

interface QuizResultScreenProps {
  attempt: QuizAttempt;
  quizSet: QuizSet;
  onViewDetailedReview: () => void;
  onRetakeQuiz: () => void;
  onBackToHome: () => void;
  onCreateQuizFromMistakes?: () => void;
}

export const QuizResultScreen: React.FC<QuizResultScreenProps> = ({
  attempt,
  quizSet,
  onViewDetailedReview,
  onRetakeQuiz,
  onBackToHome,
  onCreateQuizFromMistakes,
}) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} phút ${s.toString().padStart(2, '0')} giây`;
  };

  const getRankBadge = (percentage: number) => {
    if (percentage >= 90) {
      return {
        label: 'Xuất sắc!',
        desc: 'Bạn đã làm chủ hoàn toàn các kiến thức trong tài liệu này.',
        color: 'from-[#006c49] to-[#047857]',
        badgeBg: 'bg-[#d1fae5]',
        textColor: 'text-[#065f46]',
      };
    }
    if (percentage >= 70) {
      return {
        label: 'Khá tốt!',
        desc: 'Nắm vững phần lớn kiến thức cốt lõi, chỉ cần ôn lại một số câu vận dụng.',
        color: 'from-[#3525cd] to-[#4f46e5]',
        badgeBg: 'bg-[#e2dfff]',
        textColor: 'text-[#3323cc]',
      };
    }
    if (percentage >= 50) {
      return {
        label: 'Đạt yêu cầu',
        desc: 'Đã nắm được các khái niệm cơ bản nhưng còn nhầm lẫn ở các câu phân tích.',
        color: 'from-[#b45309] to-[#d97706]',
        badgeBg: 'bg-[#fef3c7]',
        textColor: 'text-[#92400e]',
      };
    }
    return {
      label: 'Cần cố gắng thêm',
      desc: 'Nên đọc lại tài liệu lý thuyết và làm lại bài kiểm tra để củng cố.',
      color: 'from-[#ba1a1a] to-[#dc2626]',
      badgeBg: 'bg-[#fee2e2]',
      textColor: 'text-[#991b1b]',
    };
  };

  const rank = getRankBadge(attempt.percentage);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Congratulatory Hero Card */}
      <div className="bg-white rounded-3xl border border-[#e2e4e8] p-6 sm:p-10 shadow-sm text-center space-y-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-b from-[#3525cd]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#f2f4f6] text-[#464555]">
          <span className="material-symbols-outlined text-[16px] text-[#3525cd]">verified</span>
          <span>Báo cáo kết quả bài kiểm tra</span>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#191c1e]">
            {rank.label}
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] max-w-lg mx-auto">
            {rank.desc}
          </p>
        </div>

        {/* Score Circle / Badge */}
        <div className="flex flex-col items-center justify-center my-4">
          <div className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-[#f2f4f6] to-white border-4 border-[#3525cd]/20 flex flex-col items-center justify-center shadow-lg shadow-[#3525cd]/10">
            <span className="font-display text-4xl sm:text-5xl font-black text-[#3525cd] tracking-tight">
              {attempt.score}
            </span>
            <span className="text-xs font-bold text-[#777587] mt-0.5">Thang điểm 10</span>
          </div>

          <div className="mt-3">
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${rank.badgeBg} ${rank.textColor} border border-current/20`}>
              Tỉ lệ chính xác: {attempt.percentage}% ({attempt.correctCount}/{attempt.totalQuestions} câu đúng)
            </span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#e2e4e8]">
          <div className="p-3.5 rounded-2xl bg-[#f7f9fb] border border-[#e2e4e8]/80 text-left">
            <span className="text-[11px] font-semibold text-[#777587] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              Thời gian làm
            </span>
            <p className="font-display text-base sm:text-lg font-bold text-[#191c1e] mt-1">
              {formatTime(attempt.timeSpentSeconds)}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#d1fae5]/30 border border-[#6cf8bb]/50 text-left">
            <span className="text-[11px] font-semibold text-[#065f46] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Số câu đúng
            </span>
            <p className="font-display text-base sm:text-lg font-bold text-[#006c49] mt-1">
              {attempt.correctCount} câu
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#fee2e2]/30 border border-[#ba1a1a]/20 text-left">
            <span className="text-[11px] font-semibold text-[#991b1b] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">cancel</span>
              Số câu sai
            </span>
            <p className="font-display text-base sm:text-lg font-bold text-[#ba1a1a] mt-1">
              {attempt.wrongCount} câu
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#f7f9fb] border border-[#e2e4e8]/80 text-left">
            <span className="text-[11px] font-semibold text-[#777587] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>
              Đã đánh dấu cờ
            </span>
            <p className="font-display text-base sm:text-lg font-bold text-[#191c1e] mt-1">
              {attempt.flaggedQuestions.length} câu
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-2xl border border-[#e2e4e8] p-6 shadow-xs space-y-4">
          <h3 className="font-display text-base font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[20px]">category</span>
            Phân tích theo chủ đề kiến thức
          </h3>

          <div className="space-y-3.5">
            {attempt.categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#191c1e]">{cat.category}</span>
                  <span className="text-[#777587]">
                    {cat.correct}/{cat.total} đúng ({cat.accuracy}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-[#f2f4f6] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat.accuracy >= 80
                        ? 'bg-[#006c49]'
                        : cat.accuracy >= 50
                        ? 'bg-[#3525cd]'
                        : 'bg-[#ba1a1a]'
                    }`}
                    style={{ width: `${cat.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Breakdown */}
        <div className="bg-white rounded-2xl border border-[#e2e4e8] p-6 shadow-xs space-y-4">
          <h3 className="font-display text-base font-bold text-[#191c1e] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49] text-[20px]">speed</span>
            Phân tích theo cấp độ tư duy
          </h3>

          <div className="space-y-3.5">
            {attempt.difficultyBreakdown.map((diff, idx) => {
              const acc = diff.total > 0 ? Math.round((diff.correct / diff.total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#191c1e]">{diff.label}</span>
                    <span className="text-[#777587]">
                      {diff.correct}/{diff.total} đúng ({acc}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#f2f4f6] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        diff.difficulty === 'easy'
                          ? 'bg-[#006c49]'
                          : diff.difficulty === 'medium'
                          ? 'bg-[#3525cd]'
                          : 'bg-[#b45309]'
                      }`}
                      style={{ width: `${acc}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          onClick={onViewDetailedReview}
          id="btn-view-detailed-review"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white font-bold text-sm shadow-md shadow-[#3525cd]/25 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">fact_check</span>
          <span>Xem đáp án & lời giải chi tiết</span>
        </button>

        <button
          onClick={onRetakeQuiz}
          id="btn-retake-quiz"
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-[#e2e4e8] hover:border-[#3525cd] bg-white hover:bg-[#f7f9fb] font-semibold text-sm text-[#191c1e] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          <span>Làm lại đề thi</span>
        </button>

        <button
          onClick={onBackToHome}
          id="btn-result-back-home"
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-[#e2e4e8] hover:bg-[#f7f9fb] font-semibold text-sm text-[#464555] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          <span>Trang chủ</span>
        </button>
      </div>
    </div>
  );
};
