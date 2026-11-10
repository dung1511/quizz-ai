import React, { useState } from 'react';
import { SAMPLE_DOCUMENTS } from '../data/sampleData';
import { SampleDocument } from '../types';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (doc: SampleDocument) => void;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
}) => {
  const [activeDoc, setActiveDoc] = useState<SampleDocument>(SAMPLE_DOCUMENTS[0]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#e2e4e8] shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e2e4e8]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#e2dfff] text-[#3525cd] flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">menu_book</span>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#191c1e]">
                Thư viện tài liệu học tập mẫu
              </h3>
              <p className="text-xs text-[#777587]">
                Chọn một tài liệu mẫu chuẩn hóa để trải nghiệm năng lực tạo đề thi của QuizAI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#777587] hover:text-[#191c1e] rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Document Selector Pills */}
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_DOCUMENTS.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setActiveDoc(doc)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                activeDoc.id === doc.id
                  ? 'border-[#3525cd] bg-[#3525cd]/5 shadow-xs'
                  : 'border-[#e2e4e8] hover:border-[#c7c4d8]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3525cd] block">
                {doc.category}
              </span>
              <span className="text-xs font-semibold text-[#191c1e] line-clamp-1 mt-0.5">
                {doc.title}
              </span>
            </button>
          ))}
        </div>

        {/* Active Document Preview */}
        <div className="flex-1 overflow-y-auto bg-[#f7f9fb] border border-[#e2e4e8] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#777587] pb-2 border-b border-[#e2e4e8]">
            <span className="font-semibold text-[#191c1e]">{activeDoc.fileName}</span>
            <span>Kích thước: {activeDoc.fileSize}</span>
          </div>
          <pre className="text-xs text-[#464555] font-sans whitespace-pre-wrap leading-relaxed">
            {activeDoc.content}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#464555] hover:text-[#191c1e]"
          >
            Đóng
          </button>
          <button
            onClick={() => {
              onSelectSample(activeDoc);
              onClose();
            }}
            className="px-6 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#291cb0] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Sử dụng tài liệu này để tạo đề</span>
          </button>
        </div>
      </div>
    </div>
  );
};
