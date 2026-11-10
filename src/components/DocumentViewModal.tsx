import React from 'react';
import { SampleDocument, DocumentSource } from '../types';

interface DocumentViewModalProps {
  document: SampleDocument | DocumentSource | null;
  isOpen: boolean;
  onClose: () => void;
  onPrint: (doc: SampleDocument | DocumentSource) => void;
  onGenerateQuiz: (doc: SampleDocument | DocumentSource) => void;
}

export const DocumentViewModal: React.FC<DocumentViewModalProps> = ({
  document: doc,
  isOpen,
  onClose,
  onPrint,
  onGenerateQuiz,
}) => {
  if (!isOpen || !doc) return null;

  const title = doc.title || doc.fileName;
  const content = 'rawText' in doc ? doc.rawText : doc.content || '';
  const chapters = doc.chapters || [];
  const knowledgeUnits = doc.knowledgeUnits || [];
  const fileType = ('fileType' in doc ? doc.fileType : doc.fileName.split('.').pop() || 'pdf').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">description</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                  {fileType}
                </span>
                <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                  {title}
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                Tập tin: {doc.fileName} • {doc.fileSize} • {doc.pageCount} trang • {chapters.length} chương • {knowledgeUnits.length} đơn vị kiến thức
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block">Định dạng</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">{fileType}</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block">Trang ước tính</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">{doc.pageCount} trang</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block">Số chương mục</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">{chapters.length} chương</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold block">Trọng tâm AI</span>
              <span className="text-sm font-bold text-indigo-700 mt-0.5 block">{knowledgeUnits.length} đơn vị</span>
            </div>
          </div>

          {/* Chapters Outline */}
          {chapters.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-indigo-600">account_tree</span>
                Cấu trúc chương mục đã trích xuất
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {chapters.map((chap, idx) => (
                  <div key={`${chap.id || 'chap'}-${idx}`} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <div className="font-bold text-slate-900">{chap.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Trang {chap.pageStart} – {chap.pageEnd} ({chap.sections.length} mục con)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Text View */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">article</span>
                Nội dung toàn văn đã làm sạch Unicode
              </h3>
              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                Chuẩn UTF-8 NFC • 100% tiếng Việt
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 text-xs sm:text-sm font-serif leading-relaxed text-slate-800 max-h-96 overflow-y-auto whitespace-pre-wrap selection:bg-indigo-100">
              {content}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onClose();
                onPrint(doc);
              }}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              In tài liệu
            </button>
            <button
              onClick={() => {
                onClose();
                onGenerateQuiz(doc);
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Tạo đề thi từ tài liệu này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
