import React, { useState, useEffect } from 'react';
import { Question, DocumentSource } from '../types';
import { generatePracticeQuestionsApi } from '../services/api';

interface PracticeModalProps {
  knowledgeUnitName: string;
  sourceText?: string;
  chapter?: string;
  section?: string;
  page?: number;
  document: DocumentSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PracticeModal: React.FC<PracticeModalProps> = ({
  knowledgeUnitName,
  sourceText,
  chapter,
  section,
  page,
  document,
  isOpen,
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && knowledgeUnitName) {
      loadPracticeQuestions();
    }
  }, [isOpen, knowledgeUnitName]);

  const loadPracticeQuestions = async () => {
    setIsLoading(true);
    setSelectedAnswers({});
    setShowExplanation(false);
    setIsCompleted(false);
    setCurrentIndex(0);

    try {
      const docPayload: any = document || {
        id: 'doc-default',
        title: 'Tài liệu học tập',
        fileName: 'TaiLieu.pdf',
        fileType: 'pdf',
        fileSize: '2.0 MB',
        pageCount: 50,
        status: 'READY',
        rawText: sourceText || '',
        chapters: [],
        chunks: [],
        knowledgeUnits: [
          {
            id: 'ku-1',
            documentId: 'doc-default',
            chapter: chapter || 'Chương trọng tâm',
            section: section || 'Mục liên quan',
            name: knowledgeUnitName,
            type: 'concept',
            description: sourceText || '',
            importance: 'core',
            sourceChunkId: 'chunk-1',
            sourceText: sourceText || '',
            pageNumber: page || 1,
          },
        ],
      };

      const res = await generatePracticeQuestionsApi({
        document: docPayload,
        knowledgeUnitName,
        count: 3,
      });

      setQuestions(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const totalCorrect = questions.filter((q) => selectedAnswers[q.id] === q.correctAnswer).length;

  const handleSelectOption = (key: 'A' | 'B' | 'C' | 'D') => {
    if (showExplanation) return;
    setSelectedAnswers({ ...selectedAnswers, [currentQ.id]: key });
    setShowExplanation(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowExplanation(Boolean(selectedAnswers[questions[currentIndex + 1]?.id]));
    } else {
      setIsCompleted(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">school</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-200/80 text-emerald-900">
                  Flow học lại kiến thức
                </span>
                {page && <span className="text-xs text-slate-500">Trang {page}</span>}
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Ôn tập trọng điểm: {knowledgeUnitName}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Source Text Context Banner */}
          {sourceText && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5 font-serif">
              <span className="font-bold font-sans uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                Trích đoạn giáo trình gốc ({chapter || 'Tài liệu'} {section ? `• ${section}` : ''}):
              </span>
              <p className="italic leading-relaxed">"{sourceText}"</p>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-[36px] animate-spin text-emerald-600 mb-2">
                auto_awesome
              </span>
              <p className="font-medium text-sm text-slate-700">
                AI đang biên soạn 3 câu hỏi luyện tập chuyên sâu cho đơn vị kiến thức này...
              </p>
            </div>
          ) : isCompleted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <span className="material-symbols-outlined text-[36px]">task_alt</span>
              </div>
              <div>
                <h4 className="font-bold text-xl text-slate-900">
                  Hoàn thành phiên luyện tập củng cố!
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Bạn đã trả lời đúng <span className="font-bold text-emerald-700">{totalCorrect}</span> trên{' '}
                  <span className="font-bold">{questions.length}</span> câu hỏi luyện tập.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-xs"
                >
                  Xong, quay lại bài thi
                </button>
              </div>
            </div>
          ) : currentQ ? (
            <div className="space-y-4">
              {/* Progress counter */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Câu {currentIndex + 1} / {questions.length}</span>
                <span className="text-emerald-700 uppercase tracking-wider font-bold">
                  {currentQ.difficulty === 'easy' ? 'Nhận biết' : currentQ.difficulty === 'medium' ? 'Thông hiểu' : 'Vận dụng'}
                </span>
              </div>

              {/* Question */}
              <p className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                {currentQ.questionText}
              </p>

              {/* Options */}
              <div className="space-y-2">
                {currentQ.options.map((opt) => {
                  const isSelected = selectedAnswers[currentQ.id] === opt.key;
                  const isCorrect = opt.key === currentQ.correctAnswer;

                  let optClass = 'border-slate-200 bg-white hover:border-slate-300 text-slate-800';
                  if (showExplanation) {
                    if (isCorrect) {
                      optClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-medium';
                    } else if (isSelected && !isCorrect) {
                      optClass = 'border-red-400 bg-red-50 text-red-950';
                    } else {
                      optClass = 'border-slate-200 bg-slate-50/50 text-slate-400';
                    }
                  } else if (isSelected) {
                    optClass = 'border-emerald-600 bg-emerald-50 text-emerald-950 font-medium';
                  }

                  return (
                    <div
                      key={opt.key}
                      onClick={() => handleSelectOption(opt.key)}
                      className={`p-3 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all flex items-start gap-2.5 ${optClass}`}
                    >
                      <span className="font-bold w-5 shrink-0">{opt.key}.</span>
                      <span>{opt.text}</span>
                    </div>
                  );
                })}
              </div>

              {/* Explanation Reveal */}
              {showExplanation && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 animate-in fade-in">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">info</span>
                    <span>Giải thích chi tiết:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{currentQ.explanation}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!isLoading && !isCompleted && currentQ && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
            >
              Đóng
            </button>
            <button
              onClick={handleNext}
              disabled={!selectedAnswers[currentQ.id]}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition-colors"
            >
              <span>{currentIndex === questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
