import React, { useState, useEffect } from 'react';
import { QuizSet, ExamPaperConfig } from '../types';
import { exportExamApi, exportExamDocxApi } from '../services/api';

interface ExportPaperModalProps {
  quizSet: QuizSet;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportPaperModal: React.FC<ExportPaperModalProps> = ({
  quizSet,
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<ExamPaperConfig>({
    schoolName: 'TRƯỜNG ĐẠI HỌC CÔNG NGHỆ',
    facultyName: 'KHOA CÔNG NGHỆ THÔNG TIN',
    subjectName: quizSet.title,
    examName: 'ĐỀ THI KẾT THÚC HỌC PHẦN',
    examCode: '001',
    durationMinutes: quizSet.recommendedMinutes || 60,
    candidateNamePlaceholder: 'Họ và tên thí sinh',
    candidateIdPlaceholder: 'Mã số sinh viên',
    exportMode: 'exam_only',
    fontSize: 'md',
    columns: 1,
  });

  const [formatType, setFormatType] = useState<'pdf' | 'docx'>('pdf');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  useEffect(() => {
    if (isOpen) {
      updatePreview(config);
    }
  }, [isOpen, config, quizSet]);

  const updatePreview = async (cfg: ExamPaperConfig) => {
    setIsLoading(true);
    try {
      const html = await exportExamApi(quizSet, cfg);
      setPreviewHtml(html);
    } catch (e) {
      console.error('Failed to update exam preview:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Print Exam Paper
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  // Export Button Handler
  const handleExport = async () => {
    if (formatType === 'docx') {
      setIsExportingDocx(true);
      try {
        await exportExamDocxApi(quizSet, config);
      } catch (err: any) {
        alert(err.message || 'Lỗi khi tạo tệp Word DOCX');
      } finally {
        setIsExportingDocx(false);
      }
    } else {
      // Export as HTML/PDF print file
      const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DeThi_${config.examCode || '001'}_${quizSet.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                XUẤT ĐỀ THI
              </h2>
              <p className="text-xs text-slate-500">
                Xuất đề thi giấy chuẩn mẫu khảo thí • Hỗ trợ in trực tiếp và tải file Word DOCX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'config'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cấu hình đề thi
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Xem trước trang in ({quizSet.questions.length} câu)
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left / Options Panel */}
          <div
            className={`w-full md:w-84 lg:w-96 p-5 border-r border-slate-200 overflow-y-auto space-y-4 text-xs bg-slate-50/50 ${
              activeTab === 'preview' ? 'hidden md:block' : 'block'
            }`}
          >
            {/* 1. Loại xuất */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Loại xuất
              </h4>
              <div className="space-y-1.5">
                {[
                  {
                    id: 'exam_only',
                    label: 'Đề thi',
                    desc: 'Chỉ gồm câu hỏi và các phương án A, B, C, D (Không có đáp án/lời giải)',
                  },
                  {
                    id: 'exam_with_answers',
                    label: 'Đề thi + đáp án',
                    desc: 'Kèm bảng đáp án tổng hợp (1. A, 2. B, 3. C...) ở trang cuối',
                  },
                  {
                    id: 'exam_with_explanations',
                    label: 'Đề thi + đáp án + giải thích',
                    desc: 'Kèm bảng đáp án và giải thích chi tiết vì sao đúng/sai',
                  },
                  {
                    id: 'full_with_source',
                    label: 'Đề thi + đáp án + nguồn câu hỏi',
                    desc: 'Bản giảng viên: đầy đủ đáp án, lời giải, trang sách, căn cứ sư phạm & trích đoạn',
                  },
                ].map((mode) => (
                  <label
                    key={mode.id}
                    className={`block p-2.5 rounded-xl border cursor-pointer transition-all ${
                      config.exportMode === mode.id
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="exportMode"
                        checked={config.exportMode === mode.id}
                        onChange={() => setConfig({ ...config, exportMode: mode.id as any })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs">{mode.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 pl-5 font-normal">
                      {mode.desc}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Định dạng */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Định dạng xuất
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                    formatType === 'pdf'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="formatType"
                    checked={formatType === 'pdf'}
                    onChange={() => setFormatType('pdf')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="block font-bold">PDF / In A4</span>
                    <span className="text-[10px] text-slate-500 font-normal">Xem & In ngay</span>
                  </div>
                </label>

                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                    formatType === 'docx'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold'
                      : 'border-slate-200 bg-white hover:bg-slate-100/60 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="formatType"
                    checked={formatType === 'docx'}
                    onChange={() => setFormatType('docx')}
                    className="text-indigo-600"
                  />
                  <div>
                    <span className="block font-bold">DOCX (Word)</span>
                    <span className="text-[10px] text-slate-500 font-normal">Mở bằng MS Word</span>
                  </div>
                </label>
              </div>
            </div>

            {/* 3. Các tùy chọn thông tin đề thi */}
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                Các tùy chọn đề thi
              </h4>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Tên trường:</label>
                <input
                  type="text"
                  value={config.schoolName}
                  onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                  placeholder="TRƯỜNG ĐẠI HỌC CÔNG NGHỆ"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Khoa:</label>
                <input
                  type="text"
                  value={config.facultyName}
                  onChange={(e) => setConfig({ ...config, facultyName: e.target.value })}
                  placeholder="KHOA CÔNG NGHỆ THÔNG TIN"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Môn học:</label>
                <input
                  type="text"
                  value={config.subjectName}
                  onChange={(e) => setConfig({ ...config, subjectName: e.target.value })}
                  placeholder="CƠ SỞ DỮ LIỆU"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-slate-600 font-medium block mb-1">Tên kỳ thi:</label>
                <input
                  type="text"
                  value={config.examName}
                  onChange={(e) => setConfig({ ...config, examName: e.target.value })}
                  placeholder="ĐỀ KIỂM TRA CUỐI KỲ"
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-600 font-medium block mb-1">Thời gian:</label>
                  <input
                    type="number"
                    value={config.durationMinutes}
                    onChange={(e) =>
                      setConfig({ ...config, durationMinutes: Number(e.target.value) || 60 })
                    }
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-medium block mb-1">Số câu:</label>
                  <input
                    type="text"
                    disabled
                    value={`${quizSet.questions.length} câu`}
                    className="w-full p-2 bg-slate-100 border border-slate-300 rounded-lg text-xs text-slate-500 font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-slate-600 font-medium block mb-1">Mã đề:</label>
                  <input
                    type="text"
                    value={config.examCode}
                    onChange={(e) => setConfig({ ...config, examCode: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right / Preview Window */}
          <div className="flex-1 bg-slate-200/80 p-4 sm:p-6 overflow-y-auto flex justify-center">
            <div className="w-full max-w-3xl bg-white shadow-lg rounded-sm min-h-full border border-slate-300 overflow-hidden flex flex-col">
              {isLoading ? (
                <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                  <span className="material-symbols-outlined text-[36px] animate-spin text-indigo-600 mb-2">
                    refresh
                  </span>
                  <span>Đang định dạng trang in đề thi theo chuẩn khảo thí...</span>
                </div>
              ) : (
                <iframe
                  title="Exam Paper Live Preview"
                  srcDoc={previewHtml}
                  className="w-full flex-1 min-h-[680px] border-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Hủy
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              🖨 In đề ngay
            </button>

            <button
              onClick={handleExport}
              disabled={isExportingDocx}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              {isExportingDocx ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    refresh
                  </span>
                  <span>Đang tạo file DOCX...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    {formatType === 'docx' ? 'article' : 'download'}
                  </span>
                  <span>Xuất đề ({formatType.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
