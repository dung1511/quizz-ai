import React from 'react';
import { Question } from '../types';

interface SourceViewerModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
  onReportQuestion?: (questionId: string, reason: string) => void;
}

export const SourceViewerModal: React.FC<SourceViewerModalProps> = ({
  question,
  isOpen,
  onClose,
  onReportQuestion,
}) => {
  const [reportReason, setReportReason] = React.useState('');
  const [showReportForm, setShowReportForm] = React.useState(false);
  const [reportSubmitted, setReportSubmitted] = React.useState(false);

  if (!isOpen || !question) return null;

  const { source, validation } = question;
  const validationChecks = [
    ['Đúng 4 phương án', validation?.checks.hasFourOptions],
    ['Duy nhất 1 đáp án', validation?.checks.hasSingleCorrect],
    ['Đáp án có căn cứ trong nguồn', validation?.checks.answerInSource],
    ['Đủ thông tin truy xuất nguồn', validation?.checks.hasSourceMapping],
    ['Không trùng câu hỏi', validation?.checks.noDuplicateQuestion],
    ['Câu hỏi phù hợp đoạn trích', validation?.checks.questionInSource],
  ] as const;

  const handleSendReport = () => {
    if (!reportReason.trim()) return;
    if (onReportQuestion) {
      onReportQuestion(question.id, reportReason);
    }
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportForm(false);
      setReportSubmitted(false);
      setReportReason('');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
              Q{question.questionNumber}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">
                Truy xuất nguồn gốc kiến thức & Căn cứ sư phạm
              </h3>
              <p className="text-xs text-slate-500">
                Tài liệu: <span className="font-semibold text-slate-700">{source.documentName}</span> • Trang {source.page}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-xs font-medium text-indigo-700 underline hover:text-indigo-900"
            >
              Mở nguồn tham khảo: {source.sourceUrl}
            </a>
          )}

          {/* Question Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Câu hỏi đang xét:
            </span>
            <p className="font-semibold text-slate-900 leading-snug">
              {question.questionText}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                Đáp án đúng: {question.correctAnswer}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                Độ khó: {question.difficulty === 'easy' ? 'Dễ' : question.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
              </span>
            </div>
          </div>

          {/* Location in Document (Chapter & Section) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                Chương (Chapter)
              </span>
              <p className="font-semibold text-indigo-950 text-xs sm:text-sm">
                {source.chapter}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/40">
              <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                Mục / Đơn vị kiến thức
              </span>
              <p className="font-semibold text-indigo-950 text-xs sm:text-sm">
                {source.section} • <span className="text-indigo-700 underline font-bold">{source.knowledgeUnit}</span>
              </p>
            </div>
          </div>

          {/* Exact Source Passage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-indigo-600">menu_book</span>
                Đoạn trích nguyên văn từ tài liệu (Trang {source.page})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Bản ghi gốc</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-950 font-serif leading-relaxed text-[13.5px] italic relative">
              <div className="absolute top-2 right-2 text-amber-300">
                <span className="material-symbols-outlined text-[28px]">format_quote</span>
              </div>
              "{source.sourceText}"
            </div>
          </div>

          {/* Pedagogical Generation Reason */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-950 space-y-1.5">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-blue-600">psychology</span>
              Căn cứ sư phạm & Lý do AI tạo câu hỏi:
            </span>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
              {source.generationReason}
            </p>
          </div>

          {/* Quality Validator Checks */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Trạng thái kiểm định chất lượng (Validator):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {validationChecks.map(([label, passed]) => (
                <div key={label} className={`flex items-center gap-1.5 ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>
                  <span className="material-symbols-outlined text-[16px]">{passed ? 'check_circle' : 'error'}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* User Report Section */}
          <div className="pt-2 border-t border-slate-100">
            {!showReportForm ? (
              <button
                onClick={() => setShowReportForm(true)}
                className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">flag</span>
                <span>Báo lỗi câu hỏi (nếu thông tin lệch nguồn hoặc đáp án có nghi vấn)</span>
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-red-50/60 rounded-xl border border-red-200 text-xs">
                {reportSubmitted ? (
                  <p className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Đã ghi nhận phản hồi kiểm định của bạn!
                  </p>
                ) : (
                  <>
                    <label className="font-semibold text-red-900 block">
                      Mô tả vấn đề với câu hỏi này:
                    </label>
                    <textarea
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Ví dụ: Đoạn trích ở trang 42 không đề cập đến chi tiết này, hoặc đáp án C cũng có thể đúng..."
                      rows={2}
                      className="w-full p-2 bg-white border border-red-200 rounded-lg text-xs focus:ring-1 focus:ring-red-500 outline-hidden"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowReportForm(false)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSendReport}
                        className="px-3 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                      >
                        Gửi báo cáo
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-indigo-600">menu_book</span>
            Trích dẫn nguồn được lưu cùng câu hỏi để đối chiếu
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
