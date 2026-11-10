import React, { useState } from 'react';
import { QuizSet, Question, DifficultyLevel } from '../types';
import { SourceViewerModal } from './SourceViewerModal';
import { ExportPaperModal } from './ExportPaperModal';
import { ExamMatrixModal } from './ExamMatrixModal';
import { PracticeModal } from './PracticeModal';

interface QuizDetailScreenProps {
  quizSet: QuizSet;
  onStartQuiz: () => void;
  onEditQuestions: () => void;
  onBackToUpload: () => void;
  onDeleteQuestion?: (questionId: string) => void;
}

export const QuizDetailScreen: React.FC<QuizDetailScreenProps> = ({
  quizSet,
  onStartQuiz,
  onEditQuestions,
  onBackToUpload,
}) => {
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterChapter, setFilterChapter] = useState<string>('all');
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Modals state
  const [selectedSourceQuestion, setSelectedSourceQuestion] = useState<Question | null>(null);
  const [isExportPaperOpen, setIsExportPaperOpen] = useState<boolean>(false);
  const [isMatrixOpen, setIsMatrixOpen] = useState<boolean>(false);
  const [practiceKU, setPracticeKU] = useState<{
    name: string;
    sourceText: string;
    chapter: string;
    section: string;
    page: number;
  } | null>(null);

  const toggleExplanation = (id: string) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredQuestions = quizSet.questions.filter((q) => {
    if (filterDifficulty !== 'all' && q.difficulty !== filterDifficulty) return false;
    if (filterChapter !== 'all' && q.source.chapter !== filterChapter) return false;
    return true;
  });

  const countEasy = quizSet.questions.filter((q) => q.difficulty === 'easy').length;
  const countMed = quizSet.questions.filter((q) => q.difficulty === 'medium').length;
  const countHard = quizSet.questions.filter((q) => q.difficulty === 'hard').length;
  const questionsWithSource = quizSet.questions.filter((q) =>
    Boolean(q.source?.documentName && q.source.sourceText?.trim())
  ).length;

  const uniqueChapters = Array.from(new Set(quizSet.questions.map((q) => q.source.chapter)));

  const handleCopyQuestions = () => {
    const text = quizSet.questions
      .map(
        (q, i) =>
          `Câu ${i + 1}: ${q.questionText}\n` +
          q.options.map((opt) => `${opt.key}. ${opt.text}`).join('\n') +
          `\nĐáp án đúng: ${q.correctAnswer}\nGiải thích: ${q.explanation}\nNguồn: ${q.source.chapter} - ${q.source.section} (Trang ${q.source.page})\n`
      )
      .join('\n---\n\n');

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const getDifficultyBadge = (diff: DifficultyLevel | 'easy' | 'medium' | 'hard') => {
    switch (diff) {
      case 'easy':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300/60">
            Dễ (Nhận biết)
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300/60">
            Trung bình (Thông hiểu)
          </span>
        );
      case 'hard':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300/60">
            Khó (Vận dụng)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Đa dạng
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBackToUpload}
          id="btn-back-to-upload"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Quay lại trang tải tài liệu</span>
        </button>

        {copiedNotification && (
          <div className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-medium flex items-center gap-1 shadow-sm">
            <span className="material-symbols-outlined text-[14px]">done</span>
            Đã sao chép nội dung câu hỏi vào clipboard!
          </div>
        )}
      </div>

      {/* Hero Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                Đề thi trắc nghiệm AI
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">menu_book</span>
                Có trích dẫn nguồn: {questionsWithSource}/{quizSet.questions.length}
              </span>
              <span className="text-xs text-slate-400">Tạo lúc: {quizSet.createdAt}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {quizSet.title}
            </h1>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <span className="material-symbols-outlined text-indigo-600 text-[16px]">quiz</span>
                {quizSet.questions.length} câu hỏi
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">timer</span>
                Thời gian: {quizSet.recommendedMinutes} phút
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-amber-600 text-[16px]">description</span>
                Tài liệu: {quizSet.documentName}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* View Matrix Modal Button */}
            {quizSet.matrix && (
              <button
                onClick={() => setIsMatrixOpen(true)}
                id="btn-open-matrix"
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-600 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
                title="Xem ma trận đặc tả đề thi"
              >
                <span className="material-symbols-outlined text-[18px] text-indigo-600">grid_view</span>
                <span>Ma trận đề</span>
              </button>
            )}

            {/* Export Paper Modal Button */}
            <button
              onClick={() => setIsExportPaperOpen(true)}
              id="btn-open-export-paper"
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-600 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
              title="Xuất đề thi giấy chuẩn khảo thí"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">print</span>
              <span>Xuất đề giấy</span>
            </button>

            <button
              onClick={onEditQuestions}
              id="btn-edit-quiz-mode"
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-600 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
              <span>Chỉnh sửa</span>
            </button>

            <button
              onClick={handleCopyQuestions}
              id="btn-copy-quiz"
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-indigo-600 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all flex items-center gap-1.5 shadow-2xs"
              title="Sao chép toàn bộ văn bản đề thi"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              <span>Sao chép</span>
            </button>

            <button
              onClick={onStartQuiz}
              id="btn-start-exam-primary"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-95 text-white text-xs sm:text-sm font-bold shadow-sm shadow-indigo-600/20 hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">play_arrow</span>
              <span>Làm bài thi online</span>
            </button>
          </div>
        </div>

        {/* Filter & Chapter Selection Bar */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold mr-1">Lọc độ khó:</span>
            <button
              onClick={() => setFilterDifficulty('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterDifficulty === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tất cả ({quizSet.questions.length})
            </button>
            <button
              onClick={() => setFilterDifficulty('easy')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterDifficulty === 'easy'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Dễ ({countEasy})
            </button>
            <button
              onClick={() => setFilterDifficulty('medium')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterDifficulty === 'medium'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              Trung bình ({countMed})
            </button>
            <button
              onClick={() => setFilterDifficulty('hard')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterDifficulty === 'hard'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
              }`}
            >
              Khó ({countHard})
            </button>
          </div>

          {/* Chapter Filter */}
          {uniqueChapters.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-medium">Chương:</span>
              <select
                value={filterChapter}
                onChange={(e) => setFilterChapter(e.target.value)}
                className="py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium"
              >
                <option value="all">Tất cả các chương</option>
                {uniqueChapters.map((ch, idx) => (
                  <option key={idx} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Question Cards List */}
      <div className="space-y-4">
        {filteredQuestions.map((question, index) => {
          const isExpanded = !!expandedExplanations[question.id];

          return (
            <div
              key={question.id}
              id={`question-preview-card-${question.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs hover:border-slate-300 transition-all space-y-4"
            >
              {/* Card Header: Number + Badges + Source Details */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center font-mono">
                    {index + 1}
                  </span>
                  {getDifficultyBadge(question.difficulty)}

                  {/* Chapter & Page Badge */}
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-amber-700">menu_book</span>
                    {question.source.chapter} • Trang {question.source.page}
                  </span>

                  {/* Knowledge Unit Pill */}
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                    {question.source.knowledgeUnit}
                  </span>

                  {/* Illustration badge */}
                  {question.illustration?.needsImage && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-800 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">image</span>
                      Hình minh họa
                    </span>
                  )}
                </div>

                {/* Right side actions: Traceability source inspection */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedSourceQuestion(question)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 transition-colors flex items-center gap-1"
                    title="Xem trích đoạn tài liệu & căn cứ AI tạo câu hỏi này"
                  >
                    <span className="material-symbols-outlined text-[15px]">travel_explore</span>
                    <span>Truy xuất nguồn</span>
                  </button>

                  <button
                    onClick={() =>
                      setPracticeKU({
                        name: question.source.knowledgeUnit,
                        sourceText: question.source.sourceText,
                        chapter: question.source.chapter,
                        section: question.source.section,
                        page: question.source.page,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition-colors flex items-center gap-1"
                    title="Luyện tập 3 câu hỏi cho đơn vị kiến thức này"
                  >
                    <span className="material-symbols-outlined text-[15px]">school</span>
                    <span className="hidden sm:inline">Ôn tập chuyên đề</span>
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-snug">
                {question.questionText}
              </h3>

              {/* Illustration prompt banner if exists */}
              {question.illustration?.needsImage && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-600 shrink-0">image</span>
                  <span><strong>Mô tả hình vẽ đi kèm:</strong> {question.illustration.prompt}</span>
                </div>
              )}

              {/* 4 Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {question.options.map((opt) => {
                  const isCorrect = opt.key === question.correctAnswer;

                  return (
                    <div
                      key={opt.key}
                      className={`p-3.5 rounded-xl border transition-all text-xs sm:text-sm flex items-start gap-3 ${
                        isCorrect
                          ? 'border-emerald-600 bg-emerald-50/40 font-semibold text-emerald-950'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-500 border border-slate-200'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="leading-relaxed flex-1">{opt.text}</span>
                      {isCorrect && (
                        <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0">
                          check_circle
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Toggle Explanation Accordion */}
              {isExpanded ? (
                <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-800">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
                      <span>Giải thích chi tiết (Đáp án đúng: {question.correctAnswer}):</span>
                    </div>
                    <button
                      onClick={() => toggleExplanation(question.id)}
                      className="text-slate-400 hover:text-slate-600 font-normal"
                    >
                      Thu gọn
                    </button>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-sm">
                    {question.explanation}
                  </p>
                </div>
              ) : (
                <div className="pt-1 flex items-center justify-between">
                  <button
                    onClick={() => toggleExplanation(question.id)}
                    className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">help_outline</span>
                    Xem lời giải thích đáp án
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Căn cứ: {question.source.section}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bottom Quick Exam CTA */}
      <div className="sticky bottom-4 z-20 flex justify-center">
        <button
          onClick={onStartQuiz}
          id="btn-sticky-start-quiz"
          className="px-8 py-3.5 rounded-full bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-xl flex items-center gap-2 hover:scale-105 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px] text-emerald-400">play_circle</span>
          <span>Bắt đầu thi thử trắc nghiệm ({quizSet.questions.length} câu)</span>
        </button>
      </div>

      {/* Modals */}
      <SourceViewerModal
        question={selectedSourceQuestion}
        isOpen={Boolean(selectedSourceQuestion)}
        onClose={() => setSelectedSourceQuestion(null)}
      />

      <ExportPaperModal
        quizSet={quizSet}
        isOpen={isExportPaperOpen}
        onClose={() => setIsExportPaperOpen(false)}
      />

      {quizSet.matrix && (
        <ExamMatrixModal
          matrix={quizSet.matrix}
          chapters={quizSet.chapters}
          isOpen={isMatrixOpen}
          onClose={() => setIsMatrixOpen(false)}
        />
      )}

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
