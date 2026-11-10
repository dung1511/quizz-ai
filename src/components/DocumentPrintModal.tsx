import React, { useState, useEffect } from 'react';
import { SampleDocument, DocumentSource } from '../types';
import { printDocumentApi } from '../services/api';

interface DocumentPrintModalProps {
  document: SampleDocument | DocumentSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({
  document: doc,
  isOpen,
  onClose,
}) => {
  const [printHtml, setPrintHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && doc) {
      loadPrintPreview();
    }
  }, [isOpen, doc]);

  const loadPrintPreview = async () => {
    if (!doc) return;
    setIsLoading(true);
    try {
      const html = await printDocumentApi(doc, new Date().toLocaleDateString('vi-VN'));
      setPrintHtml(html);
    } catch (err) {
      console.error('Failed to load document print preview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !doc) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TaiLieuIn_${doc.fileName.replace(/\.[^/.]+$/, '')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const title = doc.title || doc.fileName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">print</span>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                Xem trước trang in tài liệu
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-md sm:max-w-xl">
                {title} • Định dạng A4 chuyên nghiệp, ẩn toàn bộ thanh công cụ & sidebar
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Preview Frame */}
        <div className="flex-1 bg-slate-100 p-4 sm:p-6 overflow-y-auto flex justify-center">
          <div className="w-full max-w-2xl bg-white shadow-md border border-slate-300 rounded-xs min-h-full overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center h-full">
                <span className="material-symbols-outlined text-[36px] animate-spin text-blue-600 mb-2">
                  refresh
                </span>
                <span>Đang định dạng bản in tài liệu...</span>
              </div>
            ) : (
              <iframe
                title="Document Print Preview"
                srcDoc={printHtml}
                className="w-full flex-1 min-h-[600px] border-none"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>Chỉ in tiêu đề, thông tin và nội dung tài liệu chuẩn tiếng Việt có dấu</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Tải trang in HTML
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              In ngay (PDF / Máy in)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
