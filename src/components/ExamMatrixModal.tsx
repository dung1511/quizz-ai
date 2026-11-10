import React from 'react';
import { ExamMatrix, DocumentChapter } from '../types';

interface ExamMatrixModalProps {
  matrix?: ExamMatrix;
  chapters?: DocumentChapter[];
  isOpen: boolean;
  onClose: () => void;
}

export const ExamMatrixModal: React.FC<ExamMatrixModalProps> = ({
  matrix,
  chapters,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !matrix) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">grid_view</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Ma trận đề thi (Question Blueprint)
              </h3>
              <p className="text-xs text-slate-500">
                Phân bổ câu hỏi theo từng chương mục và mức độ tư duy nhận thức
              </p>
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
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng số câu</span>
              <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                {matrix.grandTotal}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block">Dễ (Nhận biết)</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-0.5 block">
                {matrix.totalEasy} ({Math.round((matrix.totalEasy / matrix.grandTotal) * 100)}%)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
              <span className="text-[11px] font-bold text-blue-800 uppercase block">TB (Thông hiểu)</span>
              <span className="text-xl font-extrabold text-blue-700 mt-0.5 block">
                {matrix.totalMedium} ({Math.round((matrix.totalMedium / matrix.grandTotal) * 100)}%)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-center">
              <span className="text-[11px] font-bold text-purple-800 uppercase block">Khó (Vận dụng)</span>
              <span className="text-xl font-extrabold text-purple-700 mt-0.5 block">
                {matrix.totalHard} ({Math.round((matrix.totalHard / matrix.grandTotal) * 100)}%)
              </span>
            </div>
          </div>

          {/* Detailed Matrix Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Chương / Đơn vị kiến thức</th>
                  <th className="p-3 text-center text-emerald-800">Nhận biết (Dễ)</th>
                  <th className="p-3 text-center text-blue-800">Thông hiểu (TB)</th>
                  <th className="p-3 text-center text-purple-800">Vận dụng (Khó)</th>
                  <th className="p-3 text-center text-slate-900">Tổng cộng</th>
                  <th className="p-3 text-center">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.chapterDistributions.map((row, idx) => {
                  const percent = Math.round((row.total / matrix.grandTotal) * 100);
                  return (
                    <tr key={`${row.chapterId || 'dist'}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        {row.chapterTitle}
                      </td>
                      <td className="p-3 text-center font-medium text-emerald-700 bg-emerald-50/20">
                        {row.easy}
                      </td>
                      <td className="p-3 text-center font-medium text-blue-700 bg-blue-50/20">
                        {row.medium}
                      </td>
                      <td className="p-3 text-center font-medium text-purple-700 bg-purple-50/20">
                        {row.hard}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900">
                        {row.total}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-mono">
                        {percent}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td className="p-3 text-slate-900 uppercase">Tổng cộng toàn bài</td>
                  <td className="p-3 text-center text-emerald-700">{matrix.totalEasy}</td>
                  <td className="p-3 text-center text-blue-700">{matrix.totalMedium}</td>
                  <td className="p-3 text-center text-purple-700">{matrix.totalHard}</td>
                  <td className="p-3 text-center text-indigo-700 text-sm">{matrix.grandTotal}</td>
                  <td className="p-3 text-center text-slate-700">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Principle Note */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              Nguyên tắc phân bổ câu hỏi
            </span>
            <p className="text-xs text-amber-800 leading-relaxed">
              Ma trận đặc tả bảo đảm tất cả các chương mục trọng tâm đều có câu hỏi tương ứng,
              không có câu hỏi ngoài tài liệu và cân bằng mức độ phân loại học sinh chuẩn khảo thí.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
