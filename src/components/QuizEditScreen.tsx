import React, { useState } from 'react';
import { QuizSet, Question, DifficultyLevel, DocumentSource } from '../types';
import { validateQuestion, validateQuestionSet } from '../../server/questionValidator';
import { regenerateQuestionApi } from '../services/api';

interface QuizEditScreenProps {
  quizSet: QuizSet;
  onSaveQuiz: (updatedQuiz: QuizSet) => void;
  onCancel: () => void;
}

export const QuizEditScreen: React.FC<QuizEditScreenProps> = ({
  quizSet,
  onSaveQuiz,
  onCancel,
}) => {
  const [questions, setQuestions] = useState<Question[]>(quizSet.questions);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [hasSavedToast, setHasSavedToast] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);

  const activeQuestion = questions[activeIdx] || questions[0];
  const activeValidation = activeQuestion ? validateQuestion(activeQuestion, questions) : null;

  const handleUpdateActiveField = (field: keyof Question, value: any) => {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === activeIdx ? { ...q, [field]: value, qualityDecision: undefined } : q
      )
    );
  };

  const handleUpdateOption = (key: 'A' | 'B' | 'C' | 'D', text: string) => {
    if (!activeQuestion) return;
    const updatedOpts = activeQuestion.options.map((opt) =>
      opt.key === key ? { ...opt, text } : opt
    );
    handleUpdateActiveField('options', updatedOpts);
  };

  const handleAddNewQuestion = () => {
    const newQ: Question = {
      id: `q-custom-${Date.now()}`,
      questionNumber: questions.length + 1,
      questionText: 'Nhập nội dung câu hỏi mới vào đây...',
      options: [
        { key: 'A', text: 'Phương án A' },
        { key: 'B', text: 'Phương án B' },
        { key: 'C', text: 'Phương án C' },
        { key: 'D', text: 'Phương án D' },
      ],
      correctAnswer: 'A',
      explanation: 'Giải thích tại sao đáp án A đúng...',
      difficulty: 'medium',
      topic: 'Kiến thức chung',
      source: {
        documentId: quizSet.documentId || 'doc-manual',
        documentName: quizSet.documentName || 'Tài liệu học tập',
        chapter: quizSet.questions[0]?.source?.chapter || 'Chương 1',
        section: quizSet.questions[0]?.source?.section || 'Mục 1.1',
        page: quizSet.questions[0]?.source?.page || 1,
        sourceChunkId: 'chunk-manual',
        sourceText: 'Nội dung câu hỏi do giảng viên tự biên soạn bổ sung vào đề thi.',
        knowledgeUnit: 'Biên soạn thủ công',
        generationReason: 'Bổ sung theo yêu cầu khảo thí của giảng viên.',
      },
      validation: {
        isValid: true,
        status: 'VALID',
        checks: {
          hasFourOptions: true,
          hasSingleCorrect: true,
          answerInSource: true,
          explanationMatchesSource: true,
          hasSourceMapping: true,
          hasReason: true,
          noDuplicateOptions: true,
        },
        issues: [],
      },
    };

    setQuestions((prev) => [...prev, newQ]);
    setActiveIdx(questions.length);
  };

  const handleDeleteActiveQuestion = () => {
    if (questions.length <= 1) return;
    const newQuestions = questions.filter((_, idx) => idx !== activeIdx);
    setQuestions(newQuestions);
    setActiveIdx((prev) => Math.max(0, prev - 1));
  };

  const handleAcceptActiveQuestion = () => {
    if (!activeQuestion || !activeValidation) return;
    setQuestions((prev) => prev.map((question, idx) => idx === activeIdx
      ? { ...question, validation: activeValidation, qualityDecision: 'ACCEPTED' }
      : question));
  };

  const handleRegenerateActiveQuestion = async () => {
    if (!activeQuestion) return;
    setIsRegenerating(true);
    setRegenerationError(null);

    const fileName = quizSet.documentName || activeQuestion.source.documentName;
    const document: DocumentSource = {
      id: quizSet.documentId || activeQuestion.source.documentId,
      title: fileName,
      fileName,
      fileType: fileName.toLowerCase().endsWith('.docx')
        ? 'docx'
        : fileName.toLowerCase().endsWith('.txt') ? 'txt' : 'pdf',
      fileSize: '',
      pageCount: Math.max(1, ...questions.map((question) => question.source.page || 1)),
      status: 'READY',
      rawText: quizSet.rawDocumentText || questions.map((question) => question.source.sourceText).join('\n'),
      chapters: quizSet.chapters || [],
      chunks: [],
      knowledgeUnits: quizSet.knowledgeUnits || [],
    };

    try {
      const regenerated = await regenerateQuestionApi({
        document,
        knowledgeUnitName: activeQuestion.source.knowledgeUnit,
        questionNumber: activeQuestion.questionNumber,
        difficulty: activeQuestion.difficulty,
      });
      const replacedQuestions = questions.map((question, idx) => idx === activeIdx ? regenerated : question);
      regenerated.validation = validateQuestion(
        regenerated,
        replacedQuestions.filter((question) => question.id !== regenerated.id)
      );
      regenerated.qualityDecision = undefined;
      setQuestions(replacedQuestions);
    } catch (error) {
      setRegenerationError(error instanceof Error ? error.message : 'Không thể tạo lại câu hỏi.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSaveAll = () => {
    const validatedQuestions = questions.map((question) => ({ ...question }));
    validateQuestionSet(validatedQuestions);
    const updated: QuizSet = {
      ...quizSet,
      totalQuestions: validatedQuestions.length,
      questions: validatedQuestions,
    };
    onSaveQuiz(updated);
    setHasSavedToast(true);
    setTimeout(() => setHasSavedToast(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e2e4e8]">
        <div>
          <button
            onClick={onCancel}
            id="btn-edit-back"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#464555] hover:text-[#3525cd] transition-colors mb-2"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Quay lại bộ câu hỏi</span>
          </button>
          <h1 className="font-display text-2xl font-extrabold text-[#191c1e]">
            Biên tập & Chỉnh sửa câu hỏi
          </h1>
          <p className="text-xs text-[#777587] mt-0.5">
            Tùy chỉnh nội dung câu hỏi, hoán đổi đáp án hoặc bổ sung câu hỏi tự soạn.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasSavedToast && (
            <span className="text-xs text-[#006c49] font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Đã lưu thành công!
            </span>
          )}

          <button
            onClick={handleSaveAll}
            id="btn-save-quiz-edits"
            className="px-5 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Lưu tất cả thay đổi</span>
          </button>
        </div>
      </div>

      {/* Question Index Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setActiveIdx(idx)}
            id={`btn-select-edit-q-${idx + 1}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
              idx === activeIdx
                ? 'bg-[#3525cd] text-white shadow-xs'
                : 'bg-white text-[#464555] border border-[#e2e4e8] hover:bg-[#f2f4f6]'
            }`}
          >
            <span>Câu {idx + 1}</span>
            <span className="text-[10px] opacity-75">({q.correctAnswer})</span>
          </button>
        ))}

        <button
          onClick={handleAddNewQuestion}
          id="btn-add-new-q"
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#d1fae5] text-[#065f46] hover:bg-[#a7f3d0] transition-colors shrink-0 flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Thêm câu mới</span>
        </button>
      </div>

      {activeQuestion && activeValidation && (
        <section aria-labelledby="question-quality-title" className="rounded-xl border border-[#d7e2df] bg-[#f3f8f5] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-[#006c49]">fact_check</span>
                <h2 id="question-quality-title" className="font-bold text-[#191c1e]">AI Quality Check</h2>
                {activeQuestion.qualityDecision === 'ACCEPTED' && (
                  <span className="text-[11px] font-bold text-[#006c49]">ĐÃ CHẤP NHẬN</span>
                )}
              </div>
              <p className="text-xs text-[#59645f] mt-1">Đối chiếu cấu trúc và từ khóa nguồn; điểm số là tín hiệu hỗ trợ, không thay thế duyệt nội dung.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="font-display text-3xl font-extrabold text-[#006c49]">{activeValidation.qualityScore ?? 0}%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#59645f]">Điểm chất lượng</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAcceptActiveQuestion}
                  disabled={activeQuestion.qualityDecision === 'ACCEPTED'}
                  className="px-3 py-2 rounded-lg bg-[#006c49] hover:bg-[#00583c] disabled:bg-[#d7e2df] disabled:text-[#59645f] text-white text-xs font-bold transition-colors"
                >
                  {activeQuestion.qualityDecision === 'ACCEPTED' ? 'Đã chấp nhận' : 'Chấp nhận'}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateActiveQuestion}
                  disabled={isRegenerating}
                  className="px-3 py-2 rounded-lg border border-[#a9b8b2] bg-white hover:bg-[#e8f0ec] disabled:opacity-60 text-[#33423b] text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isRegenerating ? 'animate-spin' : ''}`}>{isRegenerating ? 'progress_activity' : 'autorenew'}</span>
                  {isRegenerating ? 'Đang tạo lại' : 'Tạo lại'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2.5">
            {[
              ['Có đúng 4 phương án', activeValidation.checks.hasFourOptions],
              ['Có 1 đáp án đúng', activeValidation.checks.hasSingleCorrect],
              ['Đáp án có căn cứ trong nguồn', activeValidation.checks.answerInSource],
              ['Giải thích phù hợp nguồn', activeValidation.checks.explanationMatchesSource],
              ['Không trùng câu hỏi', activeValidation.checks.noDuplicateQuestion ?? false],
              ['Các phương án đủ khác nhau', activeValidation.checks.optionsNotSimilar ?? false],
              ['Câu hỏi bám nội dung tài liệu', activeValidation.checks.questionInSource ?? false],
              ['Có mapping nguồn', activeValidation.checks.hasSourceMapping],
              ['Có lý do sư phạm', activeValidation.checks.hasReason],
            ].map(([label, passed]) => (
              <div key={String(label)} className={`flex items-center gap-2 text-xs font-medium ${passed ? 'text-[#245e45]' : 'text-[#9a4c12]'}`}>
                <span className="material-symbols-outlined text-[17px]">{passed ? 'check_circle' : 'warning'}</span>
                <span>{String(label)}</span>
              </div>
            ))}
          </div>

          {activeValidation.issues && activeValidation.issues.length > 0 && (
            <ul className="border-t border-[#d7e2df] pt-3 space-y-1" aria-label="Các vấn đề cần xem lại">
              {activeValidation.issues.map((issue) => <li key={issue} className="text-xs text-[#8a4b18]">{issue}</li>)}
            </ul>
          )}
          {regenerationError && <p role="alert" className="text-xs font-semibold text-[#ba1a1a]">{regenerationError}</p>}
        </section>
      )}

      {/* Main Edit Form Card */}
      {activeQuestion && (
        <div className="bg-white rounded-2xl border border-[#e2e4e8] p-6 sm:p-8 shadow-xs space-y-6">
          {/* Question Top Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e4e8]">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md bg-[#3525cd]/10 text-[#3525cd] font-bold text-xs font-mono">
                Câu {activeIdx + 1} / {questions.length}
              </span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#777587]">Độ khó:</label>
                <select
                  value={activeQuestion.difficulty}
                  onChange={(e) => handleUpdateActiveField('difficulty', e.target.value as DifficultyLevel)}
                  id="select-edit-diff"
                  className="py-1 px-2.5 text-xs font-semibold bg-[#f2f4f6] border border-[#e2e4e8] rounded-lg text-[#191c1e]"
                >
                  <option value="easy">Dễ (Nhận biết)</option>
                  <option value="medium">Trung bình (Thông hiểu)</option>
                  <option value="hard">Khó (Vận dụng)</option>
                </select>
              </div>
            </div>

            {questions.length > 1 && (
              <button
                onClick={handleDeleteActiveQuestion}
                id="btn-delete-active-q"
                className="text-xs font-semibold text-[#ba1a1a] hover:bg-[#fee2e2] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Xóa câu này</span>
              </button>
            )}
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#464555] uppercase tracking-wider block">
              Nội dung câu hỏi:
            </label>
            <textarea
              value={activeQuestion.questionText}
              onChange={(e) => handleUpdateActiveField('questionText', e.target.value)}
              rows={3}
              id="edit-question-text"
              className="w-full p-3 text-sm font-medium text-[#191c1e] bg-[#f7f9fb] border border-[#e2e4e8] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#3525cd] focus:bg-white transition-all"
            />
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#464555] uppercase tracking-wider block">
              Chủ đề / Chuyên đề:
            </label>
            <input
              type="text"
              value={activeQuestion.topic || ''}
              onChange={(e) => handleUpdateActiveField('topic', e.target.value)}
              placeholder="Ví dụ: Cơ chế nhân đôi ADN, Quy luật phân ly..."
              id="edit-question-topic"
              className="w-full py-2 px-3 text-xs bg-[#f7f9fb] border border-[#e2e4e8] rounded-lg text-[#191c1e] focus:outline-hidden focus:ring-1 focus:ring-[#3525cd]"
            />
          </div>

          {/* 4 Options */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#464555] uppercase tracking-wider block">
              Các phương án trả lời (chọn nút tròn để chỉ định đáp án đúng):
            </label>

            <div className="space-y-2.5">
              {activeQuestion.options.map((opt) => {
                const isCorrect = activeQuestion.correctAnswer === opt.key;

                return (
                  <div
                    key={opt.key}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      isCorrect
                        ? 'border-[#006c49] bg-[#d1fae5]/20'
                        : 'border-[#e2e4e8] bg-white'
                    }`}
                  >
                    {/* Correct answer radio */}
                    <button
                      type="button"
                      onClick={() => handleUpdateActiveField('correctAnswer', opt.key)}
                      id={`btn-set-correct-${opt.key}`}
                      className={`w-6 h-6 rounded-md font-bold text-xs flex items-center justify-center shrink-0 transition-all ${
                        isCorrect
                          ? 'bg-[#006c49] text-white shadow-xs'
                          : 'bg-[#f2f4f6] text-[#777587] hover:bg-[#3525cd] hover:text-white'
                      }`}
                      title={`Đặt ${opt.key} làm đáp án đúng`}
                    >
                      {opt.key}
                    </button>

                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleUpdateOption(opt.key, e.target.value)}
                      id={`edit-opt-input-${opt.key}`}
                      className="flex-1 text-sm bg-transparent border-0 focus:outline-hidden text-[#191c1e]"
                    />

                    {isCorrect ? (
                      <span className="text-xs font-bold text-[#006c49] shrink-0 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Đáp án đúng
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateActiveField('correctAnswer', opt.key)}
                        className="text-xs text-[#777587] hover:text-[#006c49] shrink-0"
                      >
                        Chọn làm đáp án đúng
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#464555] uppercase tracking-wider block">
              Lời giải thích chi tiết:
            </label>
            <textarea
              value={activeQuestion.explanation}
              onChange={(e) => handleUpdateActiveField('explanation', e.target.value)}
              rows={3}
              id="edit-question-explanation"
              className="w-full p-3 text-sm text-[#191c1e] bg-[#f7f9fb] border border-[#e2e4e8] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#3525cd] focus:bg-white transition-all"
            />
          </div>

          {/* Source Quote */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#464555] uppercase tracking-wider block">
              Dẫn chứng trích từ tài liệu:
            </label>
            <input
              type="text"
              value={activeQuestion.sourceQuote || ''}
              onChange={(e) => handleUpdateActiveField('sourceQuote', e.target.value)}
              placeholder="Trích dẫn đoạn văn trong tài liệu chứng minh cho câu trả lời..."
              id="edit-question-quote"
              className="w-full py-2 px-3 text-xs bg-[#f7f9fb] border border-[#e2e4e8] rounded-lg text-[#191c1e] focus:outline-hidden focus:ring-1 focus:ring-[#3525cd]"
            />
          </div>

          {/* Bottom Save Bar */}
          <div className="pt-4 border-t border-[#e2e4e8] flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-[#464555] hover:text-[#191c1e]"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleSaveAll}
              className="px-6 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>Lưu câu hỏi này</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
