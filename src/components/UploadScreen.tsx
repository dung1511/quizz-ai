import React, { useState, useRef, useEffect } from 'react';
import {
  DifficultyLevel,
  QuestionType,
  QuizStyle,
  SampleDocument,
  QuizSet,
  DocumentChapter,
  KnowledgeUnit,
  DocumentSource,
} from '../types';
import { SAMPLE_DOCUMENTS, RECENT_QUIZZES_LIST } from '../data/sampleData';
import { ExamMatrixModal } from './ExamMatrixModal';
import { buildExamMatrix } from '../utils/matrixUtils';
import { extractDocumentApi, processDocumentApi } from '../services/api';

interface UploadScreenProps {
  onStartGenerate: (config: {
    content: string;
    documentTitle: string;
    quizTitle?: string;
    numQuestions: number;
    difficulty: DifficultyLevel;
    questionType: QuestionType;
    quizStyle: QuizStyle;
    scopeChapterId?: string;
    strictSourceOnly: boolean;
    mode?: 'document' | 'web';
    prompt?: string;
    topic?: string;
  }) => void;
  onSelectRecentQuiz: (quiz: QuizSet) => void;
  onRegisterDocument?: (doc: DocumentSource | SampleDocument) => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onStartGenerate,
  onSelectRecentQuiz,
  onRegisterDocument,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'text'>('upload');
  const [generationMode, setGenerationMode] = useState<'document' | 'web'>('document');
  const [uploadedFile, setUploadedFile] = useState<{
    id?: string;
    name: string;
    size: string;
    content: string;
    chapters: DocumentChapter[];
    knowledgeUnits: KnowledgeUnit[];
    pageCount?: number;
    fileType?: 'pdf' | 'docx' | 'txt';
  }>({
    name: '',
    size: '',
    content: '',
    chapters: [],
    knowledgeUnits: [],
  });

  const [pastedText, setPastedText] = useState<string>('');
  const [pastedQuizTitle, setPastedQuizTitle] = useState<string>('Đề thi từ văn bản tự dán');
  const [aiQuizTitle, setAiQuizTitle] = useState<string>('');
  const [aiRequest, setAiRequest] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [quizStyle, setQuizStyle] = useState<QuizStyle>('standard');
  const [scopeChapterId, setScopeChapterId] = useState<string>('all');
  const [strictSourceOnly, setStrictSourceOnly] = useState<boolean>(true);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionSuccess, setExtractionSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for binary corruption in pasted text
  const isPastedBinary =
    pastedText.startsWith('PK') ||
    pastedText.includes('[Content_Types].xml') ||
    pastedText.includes('word/document.xml');

  const handleUploadFileAsync = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(extension || '')) {
      setExtractionError('Chỉ hỗ trợ tệp PDF, Word DOCX hoặc TXT.');
      return;
    }
    if (file.size === 0) {
      setExtractionError('Tệp tải lên đang rỗng.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setExtractionError('Tệp vượt quá giới hạn 50 MB. Vui lòng tải tệp nhỏ hơn.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractionSuccess(null);

    try {
      // 1. Trích xuất text an toàn qua parser chuyên dụng (mammoth cho DOCX, pdf-parse cho PDF)
      const extraction = await extractDocumentApi(file);

      if (extraction.extractionStatus === 'failed' || !extraction.text.trim()) {
        throw new Error(
          extraction.errorMessage ||
            'Không thể trích xuất văn bản từ tệp này. Nếu là tài liệu scan, vui lòng chuyển qua OCR.'
        );
      }
      if (extraction.text.trim().length < 100) {
        throw new Error(`Tài liệu chỉ trích xuất được ${extraction.text.trim().length} ký tự. Cần ít nhất 100 ký tự văn bản để tạo câu hỏi có căn cứ.`);
      }

      // 2. Phân tích cấu trúc tài liệu, chương mục và đơn vị kiến thức
      const processed = await processDocumentApi(
        extraction.text,
        file.name,
        extraction.fileType,
        `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      );

      const newDoc = {
        id: processed.id || `doc-${Date.now()}`,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        content: extraction.text,
        chapters:
          processed.chapters && processed.chapters.length > 0
            ? processed.chapters
            : [],
        knowledgeUnits:
          processed.knowledgeUnits && processed.knowledgeUnits.length > 0
            ? processed.knowledgeUnits
            : [],
        pageCount: extraction.pageCount || 1,
        fileType: extraction.fileType,
      };

      setUploadedFile(newDoc);
      setExtractionSuccess(
        `Đã giải mã thành công tệp ${file.name.endsWith('.docx') ? 'Word DOCX' : file.name.endsWith('.pdf') ? 'PDF' : 'TXT'} (${extraction.pageCount} trang, ${extraction.text.length.toLocaleString('vi-VN')} ký tự chuẩn tiếng Việt UTF-8).`
      );

      // Register with Library
      if (onRegisterDocument) {
        onRegisterDocument({
          id: newDoc.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          fileType: extraction.fileType,
          fileSize: newDoc.size,
          pageCount: extraction.pageCount,
          status: 'READY',
          rawText: extraction.text,
          chapters: newDoc.chapters,
          chunks: processed.chunks || [],
          knowledgeUnits: newDoc.knowledgeUnits,
        });
      }
    } catch (err: any) {
      console.error('File extraction failed:', err);
      setExtractionError(
        err.message ||
          'Không thể trích xuất văn bản từ tệp. Vui lòng kiểm tra định dạng hoặc thử dán trực tiếp nội dung văn bản.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUploadFileAsync(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleUploadFileAsync(file);
  };

  const handleSelectSample = (sample: SampleDocument) => {
    setExtractionError(null);
    setExtractionSuccess(null);
    setUploadedFile({
      name: sample.fileName,
      size: sample.fileSize,
      content: sample.content,
      chapters: sample.chapters,
      knowledgeUnits: sample.knowledgeUnits,
      pageCount: sample.pageCount,
      fileType: 'pdf',
    });
    setActiveTab('upload');
  };

  const handleStart = () => {
    if (generationMode === 'document') {
      if (activeTab === 'text' && isPastedBinary) {
        setExtractionError(
          'Văn bản dán chứa mã nhị phân PK / [Content_Types].xml. Vui lòng không sử dụng mã nhị phân để tạo đề.'
        );
        return;
      }

      if (activeTab === 'text' && !pastedText.trim()) {
        setExtractionError('Vui lòng dán nội dung tài liệu trước khi tạo đề. Hệ thống không tự thay bằng tài liệu mẫu.');
        return;
      }
      if (activeTab === 'upload' && !uploadedFile.content.trim()) {
        setExtractionError('Vui lòng tải tài liệu hoặc chọn một tài liệu mẫu trước khi tạo đề.');
        return;
      }

      const contentToUse =
        activeTab === 'upload'
          ? uploadedFile.content
          : pastedText;

      const docName =
        activeTab === 'upload'
          ? uploadedFile.name
          : 'Văn bản đã dán';

      onStartGenerate({
        content: contentToUse,
        documentTitle: docName,
        quizTitle: activeTab === 'text' ? pastedQuizTitle.trim() || 'Đề thi từ văn bản tự dán' : undefined,
        numQuestions,
        difficulty,
        questionType,
        quizStyle,
        scopeChapterId: scopeChapterId === 'all' ? undefined : scopeChapterId,
        strictSourceOnly,
        mode: 'document',
        prompt: aiRequest || 'Tạo đề theo nội dung tài liệu.',
      });
      return;
    }

    const requirements = aiRequest.trim();
    if (!requirements) {
      setExtractionError('Vui lòng nhập chủ đề và yêu cầu cần nghiên cứu trước khi tạo đề.');
      return;
    }
    const requestedTitle = aiQuizTitle.trim();

    onStartGenerate({
      content: requirements,
      documentTitle: requestedTitle || 'Đề AI nghiên cứu chủ đề',
      quizTitle: requestedTitle || undefined,
      numQuestions,
      difficulty,
      questionType,
      quizStyle,
      scopeChapterId: scopeChapterId === 'all' ? undefined : scopeChapterId,
      strictSourceOnly,
      mode: 'web',
      prompt: requirements,
    });
  };

  const currentChapters = React.useMemo(() => {
    const raw = uploadedFile.chapters;
    const seen = new Set<string>();
    const result: DocumentChapter[] = [];
    for (const c of raw) {
      const key = `${c.chapterNumber || ''}-${c.title.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }
    return result.length > 0 ? result : raw;
  }, [uploadedFile.chapters]);

  const currentMatrix = buildExamMatrix(currentChapters, numQuestions, difficulty);

  return (
    <div className="upload-screen max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
      {/* Hero Section */}
      <div className="upload-intro text-center space-y-3.5 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold tracking-wide">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span>Khảo thí AI: trích dẫn nguồn và đối chiếu nội dung</span>
        </div>

        <h1 className="upload-title font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          ✨ TẠO BỘ CÂU HỎI BẰNG AI
        </h1>

        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Bạn có thể cung cấp nội dung hoặc chỉ cần nói cho AI biết bạn muốn học gì.
        </p>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="text-indigo-600 material-symbols-outlined text-[16px]">account_tree</span>
            Phân tích Chương & Mục tự động
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="text-emerald-600 material-symbols-outlined text-[16px]">grid_on</span>
            Ma trận đặc tả đề thi chuẩn
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="text-amber-600 material-symbols-outlined text-[16px]">menu_book</span>
            Truy xuất nguồn trang & dòng văn bản
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="text-blue-600 material-symbols-outlined text-[16px]">print</span>
            Xuất đề thi giấy chuẩn Đại học (PDF/DOCX)
          </span>
        </div>
      </div>

      {/* Main Input Container Card */}
      <div className="upload-panel bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Chế độ</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:max-w-xl">
              <button
                type="button"
                onClick={() => setGenerationMode('document')}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  generationMode === 'document'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                ○ Từ nội dung tôi cung cấp
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('web')}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                  generationMode === 'web'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                ○ AI nghiên cứu chủ đề
              </button>
            </div>
          </div>
        </div>

        {/* Extraction Error Banner */}
        {extractionError && (
          <div role="alert" className="mx-6 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{generationMode === 'web' ? 'Yêu cầu nghiên cứu chưa hợp lệ' : 'Lỗi giải mã hoặc trích xuất tài liệu'}</span>
            </div>
            <p className="pl-6">{extractionError}</p>
          </div>
        )}

        {/* Extraction Success Banner */}
        {extractionSuccess && (
          <div className="mx-6 mt-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span>{extractionSuccess}</span>
          </div>
        )}

        {/* Input Content Area */}
        <div className="p-6 sm:p-8 space-y-6">
          {generationMode === 'web' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="ai-quiz-title">Tên bộ đề</label>
                <input
                  id="ai-quiz-title"
                  type="text"
                  value={aiQuizTitle}
                  onChange={(e) => setAiQuizTitle(e.target.value)}
                  maxLength={160}
                  placeholder="Ví dụ: Sinh học 12 – Di truyền học"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="ai-research-requirements">Nội dung và yêu cầu tạo đề</label>
                <textarea
                  id="ai-research-requirements"
                  value={aiRequest}
                  onChange={(e) => setAiRequest(e.target.value)}
                  placeholder="Ví dụ: Sinh học 12, phần di truyền học. Tập trung vào ADN, ARN, nhân đôi ADN, phiên mã và dịch mã. Phù hợp học sinh lớp 12, ưu tiên nhận biết và thông hiểu. Tạo 20 câu, mỗi câu 4 đáp án và có giải thích."
                  rows={7}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
                />
              </div>
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isExtracting && fileInputRef.current?.click()}
                id="file-dropzone"
                className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 relative ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/40 scale-[0.99]'
                    : isExtracting
                    ? 'border-indigo-400 bg-indigo-50/30 cursor-wait'
                    : uploadedFile.content
                    ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-600'
                    : 'border-slate-300 hover:border-indigo-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain"
                  className="hidden"
                  id="hidden-file-input"
                  disabled={isExtracting}
                />

                {isExtracting ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[32px] animate-spin">
                        refresh
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-slate-900">
                    {generationMode === 'web' && (
                      <p className="text-[11px] leading-relaxed text-slate-500">
                        Nếu nội dung yêu cầu có ghi số câu, số đó được ưu tiên. Bộ chọn này dùng khi yêu cầu không nêu số lượng.
                      </p>
                    )}
                        Đang giải mã và trích xuất nội dung...
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Sử dụng parser DOCX (mammoth) / PDF (pdf-parse) để trích xuất văn bản Unicode, không xử lý chuỗi nhị phân thô.
                      </p>
                    </div>
                  </div>
                ) : uploadedFile.content ? (
                  <div className="flex flex-col items-center gap-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[28px]">description</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          {uploadedFile.fileType || 'PDF'}
                        </span>
                        <h4 className="font-bold text-base text-slate-900">{uploadedFile.name}</h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dung lượng: {uploadedFile.size} • {uploadedFile.pageCount || 1} trang • Đã nhận diện{' '}
                        {uploadedFile.chapters.length} chương & {uploadedFile.knowledgeUnits.length} đơn vị kiến thức
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">sync</span>
                      Chọn tài liệu khác từ máy tính
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                      <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm sm:text-base text-slate-900">
                        Kéo thả file PDF, DOCX, TXT vào đây hoặc <span className="text-indigo-600 underline">duyệt từ máy</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Hỗ trợ giáo trình, slide bài giảng, đề cương ôn tập (Tự động giải mã nhị phân DOCX & PDF)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sample Documents Quick Click */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">school</span>
                  Tài liệu mẫu thực tế (Test Cases 1 & 2):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_DOCUMENTS.map((sample) => (
                    <div
                      key={sample.id}
                      onClick={() => handleSelectSample(sample)}
                      id={`sample-doc-${sample.id}`}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                        uploadedFile.name === sample.fileName
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700">
                          {sample.category}
                        </span>
                        <span className="text-[11px] text-slate-400">{sample.fileSize}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {sample.fileName}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                        {sample.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="pasted-content-mode space-y-4">
              <label className="pasted-title-field">
                <span>Tên đề thi</span>
                <input
                  id="pasted-quiz-title"
                  type="text"
                  value={pastedQuizTitle}
                  onChange={(e) => setPastedQuizTitle(e.target.value)}
                  placeholder="Nhập tên đề thi của bạn"
                  maxLength={160}
                />
              </label>

              {isPastedBinary && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                    warning
                  </span>
                  <div>
                    <strong>Cảnh báo chuỗi nhị phân:</strong> Văn bản bạn dán có chứa tiền tố nhị phân{' '}
                    <code>PK.../[Content_Types].xml</code> của file DOCX nén. Vui lòng chuyển sang tab{' '}
                    <strong>"Tải tài liệu học tập"</strong> để hệ thống tự động giải nén qua Mammoth, hoặc chỉ dán nội dung chữ thuần túy.
                  </div>
                </div>
              )}

              <div className="pasted-content-grid">
                <section className="pasted-editor-column">
                  <div className="pasted-editor-heading">
                    <label htmlFor="pasted-content-textarea">Nội dung tài liệu / Giáo trình / Đề cương</label>
                    <button
                      type="button"
                      onClick={() => {
                        setPastedText(SAMPLE_DOCUMENTS[0].content);
                        setExtractionError(null);
                      }}
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span className="material-symbols-outlined text-[14px]">format_quote</span>
                      Dùng nội dung mẫu
                    </button>
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Dán nội dung giáo trình, chương sách hoặc tài liệu học tập vào đây..."
                    rows={12}
                    id="pasted-content-textarea"
                    className={`w-full p-4 text-xs sm:text-sm text-slate-900 bg-slate-50 border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all resize-y leading-relaxed font-mono ${
                      isPastedBinary ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                    }`}
                  />
                  <div className="pasted-editor-meta">
                    <span>{pastedText.length.toLocaleString('vi-VN')} ký tự</span>
                    <span>Chuẩn hóa Unicode tiếng Việt tự động</span>
                  </div>
                </section>

                <aside className="pasted-preview" aria-live="polite">
                  <div className="pasted-preview-heading">
                    <span className="pasted-preview-icon material-symbols-outlined" aria-hidden="true">visibility</span>
                    <div>
                      <h3>Xem trước nội dung làm đề</h3>
                      <p>AI sẽ dùng phần văn bản này làm nguồn tạo câu hỏi</p>
                    </div>
                  </div>
                  <div className={`pasted-preview-content ${pastedText.trim() ? '' : 'is-empty'}`}>
                    {pastedText.trim() || 'Nội dung bạn dán sẽ hiển thị tại đây để kiểm tra trước khi tạo đề.'}
                  </div>
                  <div className="pasted-preview-footer">
                    {pastedText.trim() ? `${pastedText.trim().split(/\s+/).length.toLocaleString('vi-VN')} từ` : 'Chưa có nội dung'}
                  </div>
                </aside>
              </div>
            </div>
          )}

          {generationMode === 'document' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">account_tree</span>
                  Cấu trúc chương mục & Đơn vị kiến thức phát hiện trong tài liệu:
                </span>
                <button
                  type="button"
                  onClick={() => setIsMatrixModalOpen(true)}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">grid_view</span>
                  Xem ma trận đặc tả đề thi
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {currentChapters.map((chap, idx) => (
                  <div
                    key={`${chap.id || 'chap'}-${idx}`}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 text-[11px]">Chương {idx + 1}</span>
                      <span className="text-[10px] text-slate-400">Trang {chap.pageStart} - {chap.pageEnd}</span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-xs line-clamp-1">{chap.title}</h5>
                    <div className="space-y-0.5 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                      {chap.sections.map((sec, sIdx) => (
                        <div key={`${sec.id || 'sec'}-${sIdx}`} className="truncate flex items-center gap-1">
                          <span className="text-slate-400">•</span>
                          <span>{sec.sectionNumber} {sec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generator Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* Number of Questions */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Số lượng câu hỏi</span>
                <span className="text-indigo-600 font-extrabold">{numQuestions} câu</span>
              </label>
              <div className="flex items-center gap-2">
                {[5, 10, 20, 30].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumQuestions(num)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      numQuestions === num
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              {generationMode === 'web' && (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Nếu nội dung yêu cầu có ghi số câu, số đó được ưu tiên. Bộ chọn này dùng khi yêu cầu không nêu số lượng.
                </p>
              )}
            </div>

            {/* Difficulty */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Mức độ phân hóa
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="medium">Tổng hợp (Nhận biết - Thông hiểu - Vận dụng)</option>
                <option value="easy">Nhận biết & Thông hiểu (Cơ bản)</option>
                <option value="hard">Vận dụng & Vận dụng cao (Nâng cao)</option>
              </select>
            </div>

            {/* Scope / Chapters */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Phạm vi kiến thức
              </label>
              <select
                value={scopeChapterId}
                onChange={(e) => setScopeChapterId(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="all">Toàn bộ tài liệu (Theo ma trận)</option>
                {currentChapters.map((chap, idx) => (
                  <option key={`${chap.id || 'chap'}-${idx}`} value={chap.id}>
                    Chỉ {chap.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Strict Source Guarantee */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Chế độ kiểm định nguồn
              </label>
              <label className="flex items-center gap-2 p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={strictSourceOnly}
                  onChange={(e) => setStrictSourceOnly(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[11px] font-bold text-emerald-900 leading-tight">
                  Chống bịa đặt (Chỉ sinh từ nguồn tài liệu gốc)
                </span>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">lock_reset</span>
              <span>{generationMode === 'web' ? 'Nguồn web được lưu để đối chiếu từng câu hỏi' : 'Câu hỏi kèm trích dẫn từ tài liệu đã chọn'}</span>
            </div>

            <button
              onClick={handleStart}
              disabled={
                generationMode === 'document' && (isExtracting || (activeTab === 'text' && isPastedBinary))
              }
              id="btn-start-generating"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              <span>{generationMode === 'web' ? 'AI nghiên cứu và tạo đề' : 'Bắt đầu AI phân tích & Tạo đề thi'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Matrix Modal */}
      <ExamMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        matrix={currentMatrix}
        totalQuestions={numQuestions}
      />
    </div>
  );
};
