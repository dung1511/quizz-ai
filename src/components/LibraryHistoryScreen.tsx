import React, { useState, useMemo } from 'react';
import { QuizSet, QuizAttempt, SampleDocument, DocumentSource, Question } from '../types';
import { DocumentPrintModal } from './DocumentPrintModal';
import { DocumentViewModal } from './DocumentViewModal';
import { ExportPaperModal } from './ExportPaperModal';
import { createReviewQuiz } from '../utils/smartReview';
import {
  AttemptFilters, DateRangeKey,
  filterAttempts, computeAttemptStats, paginateAttempts, totalPagesFor,
  availablePeriods, availableQuizOptions, availableDocumentNames,
  groupWrongAnswersByQuiz, analyzeTopicWeaknesses, significantWeakTopics, questionsForTopic,
  QuizWrongGroup, ATTEMPTS_PAGE_SIZE,
} from '../utils/libraryUtils';

interface LibraryHistoryScreenProps {
  documents?: (SampleDocument | DocumentSource)[];
  quizList: QuizSet[];
  attemptsHistory: QuizAttempt[];
  onSelectQuiz: (quiz: QuizSet) => void;
  onRetakeQuiz: (quiz: QuizSet) => void;
  onSelectAttempt: (attempt: QuizAttempt) => void;
  onStartReview: (quiz: QuizSet) => void;
  onCreateNew: () => void;
  onDeleteDocument?: (id: string) => void;
  onDeleteQuiz?: (id: string) => void;
  onSelectDocumentForQuiz?: (doc: SampleDocument | DocumentSource) => void;
}

export const LibraryHistoryScreen: React.FC<LibraryHistoryScreenProps> = ({
  documents = [],
  quizList,
  attemptsHistory,
  onSelectQuiz,
  onRetakeQuiz,
  onSelectAttempt,
  onStartReview,
  onCreateNew,
  onDeleteDocument,
  onDeleteQuiz,
  onSelectDocumentForQuiz,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'documents' | 'quizzes' | 'history' | 'review'>('documents');

  // ===== Bộ lọc Lịch sử làm bài =====
  const [historyFilters, setHistoryFilters] = useState<AttemptFilters>({ search: '', dateRange: 'all' });
  const [historyPage, setHistoryPage] = useState(1);

  // ===== Ôn tập: chế độ A/B/C =====
  const [reviewMode, setReviewMode] = useState<'overview' | 'quiz-wrong' | 'weak-topics' | 'topic-practice'>('overview');
  const [selectedWrongGroup, setSelectedWrongGroup] = useState<QuizWrongGroup | null>(null);
  const [selectedPracticeQuestions, setSelectedPracticeQuestions] = useState<Set<string>>(new Set());
  const [selectedWeakTopic, setSelectedWeakTopic] = useState<string | null>(null);

  // Modals state
  const [selectedDocForPrint, setSelectedDocForPrint] = useState<SampleDocument | DocumentSource | null>(null);
  const [selectedDocForView, setSelectedDocForView] = useState<SampleDocument | DocumentSource | null>(null);
  const [selectedQuizForExport, setSelectedQuizForExport] = useState<QuizSet | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');

  // ===== Dữ liệu đã lọc cho tab Lịch sử làm bài (tính từ dữ liệu thật) =====
  const filteredAttempts = useMemo(
    () => filterAttempts(attemptsHistory, quizList, { ...historyFilters, search: historyFilters.search || searchTerm }),
    [attemptsHistory, quizList, historyFilters, searchTerm]
  );
  const attemptStats = useMemo(() => computeAttemptStats(filteredAttempts), [filteredAttempts]);
  const historyTotalPages = totalPagesFor(filteredAttempts.length);
  const pagedAttempts = useMemo(
    () => paginateAttempts(filteredAttempts, Math.min(historyPage, historyTotalPages)),
    [filteredAttempts, historyPage, historyTotalPages]
  );
  const periodOptions = useMemo(() => availablePeriods(attemptsHistory), [attemptsHistory]);
  const quizFilterOptions = useMemo(() => availableQuizOptions(attemptsHistory, quizList), [attemptsHistory, quizList]);
  const documentFilterOptions = useMemo(() => availableDocumentNames(attemptsHistory, quizList), [attemptsHistory, quizList]);

  // ===== Dữ liệu Ôn tập (từ dữ liệu thật) =====
  const wrongGroups = useMemo(() => groupWrongAnswersByQuiz(attemptsHistory, quizList), [attemptsHistory, quizList]);
  const totalUniqueWrong = useMemo(
    () => new Set(wrongGroups.flatMap((group) => group.entries.map((entry) => entry.question.id))).size,
    [wrongGroups]
  );
  const topicWeaknesses = useMemo(() => analyzeTopicWeaknesses(attemptsHistory, quizList), [attemptsHistory, quizList]);
  const significantTopics = useMemo(() => significantWeakTopics(topicWeaknesses), [topicWeaknesses]);
  const selectedGroupDetail = useMemo(
    () => (selectedWrongGroup ? wrongGroups.find((g) => g.quizId === selectedWrongGroup.quizId) ?? null : null),
    [selectedWrongGroup, wrongGroups]
  );
  const selectedTopicQuestions = useMemo(
    () => (selectedWeakTopic ? questionsForTopic(selectedWeakTopic, attemptsHistory, quizList) : []),
    [selectedWeakTopic, attemptsHistory, quizList]
  );

  const updateHistoryFilters = (patch: Partial<AttemptFilters>) => {
    setHistoryFilters((prev) => ({ ...prev, ...patch }));
    setHistoryPage(1); // đổi bộ lọc → quay về trang 1
  };

  const clearHistoryFilters = () => {
    setHistoryFilters({ search: '', dateRange: 'all' });
    setSearchTerm('');
    setHistoryPage(1);
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const term = searchTerm.toLowerCase();
    const title = (doc.title || doc.fileName).toLowerCase();
    return title.includes(term) || doc.fileName.toLowerCase().includes(term);
  });

  // Filter quizzes
  const filteredQuizzes = quizList.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      q.title.toLowerCase().includes(term) ||
      q.documentName.toLowerCase().includes(term) ||
      q.questions.some((item) => item.questionText.toLowerCase().includes(term))
    );
  });

  const totalQuestions = quizList.reduce((acc, curr) => acc + curr.questions.length, 0);
  const latestAttempt = [...attemptsHistory].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];

  // ===== Hành động Ôn tập =====

  /** Chế độ A: luyện tất cả câu sai của một bộ đề (câu duy nhất, không lặp). */
  const startQuizWrongReview = (group: QuizWrongGroup, onlyIds?: Set<string>) => {
    const questions = group.entries
      .filter((entry) => !onlyIds || onlyIds.has(entry.question.id))
      .map((entry) => entry.question);
    const review = createReviewQuiz(`Luyện lại câu sai – ${group.quizTitle}`, questions, quizList);
    if (review) {
      onStartReview(review);
    } else {
      setReviewMessage('Không đủ câu sai có đủ bốn lựa chọn và đáp án hợp lệ để tạo bài ôn.');
    }
  };

  /** Chế độ B: luyện các câu thuộc chủ đề điểm yếu đã chọn. */
  const startWeakTopicReview = (topic: string) => {
    const questions = questionsForTopic(topic, attemptsHistory, quizList);
    if (questions.length === 0) {
      setReviewMessage('Chưa có câu hỏi đủ điều kiện cho chủ đề này.');
      return;
    }
    const review = createReviewQuiz(`Củng cố chủ đề – ${topic}`, questions, quizList);
    if (review) onStartReview(review);
    else setReviewMessage('Không tìm thấy câu hỏi đủ bốn lựa chọn và đáp án hợp lệ cho chủ đề này.');
  };

  /** Chế độ C: luyện tập theo bộ đề/tài liệu đã chọn (chỉ dùng câu hỏi có thật). */
  const startTopicPractice = (questions: Question[], title: string) => {
    const review = createReviewQuiz(title, questions, quizList);
    if (review) onStartReview(review);
    else setReviewMessage('Không có câu hỏi hợp lệ để tạo bài luyện.');
  };
  const avgScore =
    attemptsHistory.length > 0
      ? (
          attemptsHistory.reduce((acc, curr) => acc + curr.score, 0) /
          attemptsHistory.length
        ).toFixed(1)
      : '-';

  const handleDownloadDoc = (doc: SampleDocument | DocumentSource) => {
    const content = 'rawText' in doc ? doc.rawText : doc.content || '';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_Unicode.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Banner & Stats */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700">
              Kho học tập của tôi
            </span>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Kho học tập của tôi
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Quản lý tài liệu gốc, in tài liệu không kèm giao diện hệ thống, và theo dõi các bộ đề thi trắc nghiệm.
            </p>
          </div>

          <button
            onClick={onCreateNew}
            id="btn-lib-create-new"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Tải lên tài liệu mới</span>
          </button>
        </div>

        {/* 4 Metric Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-blue-600">article</span>
              Tài liệu của tôi
            </span>
            <p className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {documents.length} tài liệu
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-indigo-600">library_books</span>
              Số bộ đề của tôi
            </span>
            <p className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {quizList.length} bộ đề
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-600">history_edu</span>
              Lượt làm bài
            </span>
            <p className="font-display text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {attemptsHistory.length} lượt
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
            <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">grade</span>
              Điểm trung bình
            </span>
            <p className="font-display text-lg sm:text-xl font-bold text-emerald-700 mt-1">
              {avgScore} / 10
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('documents')}
            id="tab-lib-documents"
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'documents'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Tài liệu của tôi ({documents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            id="tab-lib-quizzes"
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'quizzes'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            <span>Bộ đề của tôi ({quizList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            id="tab-lib-history"
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            <span>Lịch sử làm bài ({attemptsHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('review')}
            id="tab-lib-review"
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'review' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <span className="material-symbols-outlined text-[16px]">psychology</span>
            <span>Ôn tập & Củng cố</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder={
              activeTab === 'documents'
                ? 'Tìm tên tài liệu, môn học...'
                : activeTab === 'quizzes'
                ? 'Tìm kiếm theo tên đề, câu hỏi...'
                : activeTab === 'review' ? 'Tìm câu sai hoặc chủ đề...' : 'Tìm kiếm lịch sử thi...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-600 transition-colors shadow-2xs"
          />
        </div>
      </div>

      {/* TAB 1: KHO TÀI LIỆU HỌC TẬP */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh sách tài liệu đã trích xuất sạch Unicode ({filteredDocuments.length})
            </h2>
            <span className="text-xs text-slate-500">
              Tất cả tài liệu hỗ trợ xem trước, tải xuống và in chuẩn mẫu A4
            </span>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <span className="material-symbols-outlined text-[48px] text-slate-300">
                folder_off
              </span>
              <p className="text-sm font-semibold text-slate-700">Chưa có tài liệu nào phù hợp</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700"
              >
                Tải lên tài liệu ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc, idx) => {
                const title = doc.title || doc.fileName;
                const fileType = (
                  'fileType' in doc ? doc.fileType : doc.fileName.split('.').pop() || 'pdf'
                ).toUpperCase();
                const chaptersCount = doc.chapters?.length || 0;
                const kuCount = doc.knowledgeUnits?.length || 0;

                return (
                  <div
                    key={`${doc.id || 'doc'}-${idx}`}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            fileType === 'PDF'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : fileType === 'DOCX'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {fileType}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Đã xử lý sạch
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                          {title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          Tập tin: {doc.fileName}
                        </p>
                      </div>

                      {/* Metadata grid */}
                      <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl text-center text-slate-600 text-[11px] border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Dung lượng</span>
                          <span className="font-semibold text-slate-800">{doc.fileSize}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Số trang</span>
                          <span className="font-semibold text-slate-800">{doc.pageCount} tr</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Chương</span>
                          <span className="font-semibold text-indigo-700">{chaptersCount} c.mục</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-indigo-600">
                          psychology
                        </span>
                        <span>{kuCount} đơn vị kiến thức AI đã nhận diện</span>
                      </div>
                    </div>

                    {/* Action buttons requested: [Xem] [Tải xuống] [In tài liệu] [Xóa] */}
                    <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => setSelectedDocForView(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          title="Xem nội dung chi tiết và cấu trúc chương mục"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Xem</span>
                        </button>

                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                          title="Tải văn bản sạch Unicode UTF-8"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          <span>Tải về</span>
                        </button>

                        <button
                          onClick={() => setSelectedDocForPrint(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors border border-blue-200/80"
                          title="In tài liệu học tập (chỉ in nội dung, ẩn sidebar & UI)"
                        >
                          <span className="material-symbols-outlined text-[16px]">print</span>
                          <span>In tài liệu</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onSelectDocumentForQuiz && (
                          <button
                            onClick={() => onSelectDocumentForQuiz(doc)}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                            <span>Tạo đề thi</span>
                          </button>
                        )}

                        {onDeleteDocument && (
                          <button
                            onClick={() => onDeleteDocument(doc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Xóa tài liệu khỏi kho"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: KHO BỘ ĐỀ THI */}
      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh sách bộ đề thi đã tạo ({filteredQuizzes.length})
            </h2>
            <span className="text-xs text-slate-500">
              Có thể thi trực tuyến hoặc xuất đề giấy in ấn kèm đáp án và căn cứ sư phạm
            </span>
          </div>

          {filteredQuizzes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <span className="material-symbols-outlined text-[48px] text-slate-300">
                quiz
              </span>
              <p className="text-sm font-semibold text-slate-700">Chưa có bộ đề nào</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700"
              >
                Tạo bộ đề mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuizzes.map((quiz, idx) => (
                <div
                  key={`${quiz.id || 'quiz'}-${idx}`}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {quiz.totalQuestions} câu trắc nghiệm
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug">
                        {quiz.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        Nguồn: {quiz.documentName}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                        ⏱ {quiz.recommendedMinutes} phút
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium">
                        📊 Mức độ: {quiz.difficulty === 'all' ? 'Tổng hợp' : quiz.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200/60">
                        ✓ 100% Gắn nguồn
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Đã thi {attemptsHistory.filter((attempt) => attempt.quizId === quiz.id).length} lần
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Đã thi {attemptsHistory.filter((attempt) => attempt.quizId === quiz.id).length} lần</span>
                      {(() => {
                        const group = wrongGroups.find((g) => g.quizId === quiz.id);
                        return group ? (
                          <span className="text-rose-600 font-semibold">{group.uniqueWrongQuestions} câu sai</span>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectQuiz(quiz)}
                        className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        <span>Xem & Thi</span>
                      </button>

                      <button
                        onClick={() => setSelectedQuizForExport(quiz)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
                        title="Xuất đề thi giấy chuẩn khảo thí hoặc tải file Word .docx"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        <span>In / Xuất</span>
                      </button>
                      <button
                        onClick={() => onRetakeQuiz(quiz)}
                        className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1"
                        title="Thi lại toàn bộ đề"
                      >
                        <span className="material-symbols-outlined text-[16px]">replay</span>
                        <span>Thi lại</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setActiveTab('history'); clearHistoryFilters(); updateHistoryFilters({ quizId: quiz.id }); }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200"
                      >
                        <span className="material-symbols-outlined text-[15px]">history</span>
                        <span>Lịch sử bộ đề</span>
                      </button>
                      {wrongGroups.some((g) => g.quizId === quiz.id) && (
                        <button
                          onClick={() => {
                            setActiveTab('review');
                            setReviewMode('quiz-wrong');
                            setSelectedWrongGroup(wrongGroups.find((g) => g.quizId === quiz.id) || null);
                            setSelectedPracticeQuestions(new Set());
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center gap-1 border border-rose-200"
                        >
                          <span className="material-symbols-outlined text-[15px]">refresh</span>
                          <span>Luyện câu sai</span>
                        </button>
                      )}
                    </div>
                    {onDeleteQuiz && (
                      <button
                        onClick={() => onDeleteQuiz(quiz.id)}
                        className="w-full py-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition-colors flex items-center justify-center gap-1"
                        title="Đưa bộ đề khỏi kho; lịch sử làm bài vẫn được giữ"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                        <span>Xóa khỏi kho</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LỊCH SỬ LÀM BÀI */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Thống kê theo phạm vi lọc hiện tại */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Tổng lượt làm bài</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{attemptStats.totalAttempts}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Điểm trung bình</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-1">
                {attemptStats.averageScore !== null ? attemptStats.averageScore.toFixed(1) : '—'}<span className="text-sm font-semibold text-slate-400"> /10</span>
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Tỉ lệ đúng</p>
              <p className="text-2xl font-extrabold text-indigo-700 mt-1">
                {attemptStats.averageAccuracy !== null ? `${Math.round(attemptStats.averageAccuracy)}%` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Câu sai ghi nhận</p>
              <p className="text-2xl font-extrabold text-rose-600 mt-1">{attemptStats.totalWrong}</p>
            </div>
          </div>

          {/* Bộ lọc */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-indigo-600">filter_list</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bộ lọc</span>
              <button
                onClick={clearHistoryFilters}
                className="ml-auto px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                Xóa bộ lọc
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <select
                value={historyFilters.dateRange}
                onChange={(e) => updateHistoryFilters({ dateRange: e.target.value as DateRangeKey })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-600"
                aria-label="Lọc theo thời gian"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="today">Hôm nay</option>
                <option value="last7">7 ngày gần đây</option>
                <option value="this_month">Tháng này</option>
                <option value="month_year">Chọn tháng/năm…</option>
                <option value="custom">Khoảng ngày…</option>
              </select>

              {historyFilters.dateRange === 'month_year' && (
                <select
                  value={`${historyFilters.year ?? ''}-${historyFilters.month ?? ''}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-').map(Number);
                    updateHistoryFilters({ year, month });
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  aria-label="Chọn tháng và năm"
                >
                  {periodOptions.map((period) => (
                    <option key={`${period.year}-${period.month}`} value={`${period.year}-${period.month}`}>
                      {period.label}
                    </option>
                  ))}
                </select>
              )}

              {historyFilters.dateRange === 'custom' && (
                <>
                  <input
                    type="date"
                    value={historyFilters.from || ''}
                    onChange={(e) => updateHistoryFilters({ from: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    aria-label="Từ ngày"
                  />
                  <input
                    type="date"
                    value={historyFilters.to || ''}
                    onChange={(e) => updateHistoryFilters({ to: e.target.value })}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    aria-label="Đến ngày"
                  />
                </>
              )}

              <select
                value={historyFilters.quizId || ''}
                onChange={(e) => updateHistoryFilters({ quizId: e.target.value || undefined })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                aria-label="Lọc theo bộ đề"
              >
                <option value="">Tất cả bộ đề</option>
                {quizFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} ({option.attemptCount} lượt)
                  </option>
                ))}
              </select>

              <select
                value={historyFilters.documentName || ''}
                onChange={(e) => updateHistoryFilters({ documentName: e.target.value || undefined })}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                aria-label="Lọc theo tài liệu"
              >
                <option value="">Tất cả tài liệu</option>
                {documentFilterOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Danh sách từng lần làm bài */}
          {filteredAttempts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <span className="material-symbols-outlined text-[48px] text-slate-300">history_edu</span>
              <p className="text-sm font-semibold text-slate-700">Không có lượt làm bài nào khớp bộ lọc</p>
              <p className="text-xs text-slate-500">Thử xóa bộ lọc hoặc làm một bài thi mới.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {pagedAttempts.map((attempt) => {
                  const wrongCount = Math.max(0, (attempt.totalQuestions || 0) - (attempt.correctCount || 0));
                  const hasDetail = Boolean(attempt.quizSnapshot || quizList.some((q) => q.id === attempt.quizId));
                  return (
                    <div key={attempt.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm sm:text-base truncate">{attempt.quizTitle}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            attempt.score >= 8 ? 'bg-emerald-100 text-emerald-800'
                              : attempt.score >= 5 ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {Number(attempt.score).toFixed(1)} / 10 điểm
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Nộp: {Number.isNaN(Date.parse(attempt.completedAt))
                            ? attempt.completedAt
                            : new Date(attempt.completedAt).toLocaleString('vi-VN')}
                          {' • '}Đúng {attempt.correctCount}/{attempt.totalQuestions}
                          {' • '}Sai {wrongCount} câu
                          {' • '}{Math.floor(attempt.timeSpentSeconds / 60)} phút {attempt.timeSpentSeconds % 60}s
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          onClick={() => onSelectAttempt(attempt)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">analytics</span>
                          <span>Chi tiết</span>
                        </button>
                        {hasDetail && wrongCount > 0 && (
                          <button
                            onClick={() => {
                              const group = wrongGroups.find((g) => g.quizId === attempt.quizId);
                              if (group) {
                                setActiveTab('review');
                                setReviewMode('quiz-wrong');
                                setSelectedWrongGroup(group);
                                setSelectedPracticeQuestions(new Set());
                              } else {
                                setReviewMessage('Không xác định được câu sai chi tiết cho lần làm này.');
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            <span>Luyện câu sai</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Phân trang */}
              {historyTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                  <button
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPage <= 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold disabled:opacity-40"
                  >
                    Trang trước
                  </button>
                  <span className="text-xs text-slate-600">
                    Trang {Math.min(historyPage, historyTotalPages)} / {historyTotalPages} · {filteredAttempts.length} lượt làm bài
                  </span>
                  <button
                    onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                    disabled={historyPage >= historyTotalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && (
        <section className="space-y-5" aria-label="Ôn tập & Củng cố">
          {attemptsHistory.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <span className="material-symbols-outlined text-[44px] text-indigo-300">school</span>
              <h2 className="font-bold text-slate-900">Hãy làm một đề trước</h2>
              <p className="text-sm text-slate-600">Khi có lịch sử làm bài, QuizAI sẽ tổng hợp câu sai và chủ đề cần củng cố từ dữ liệu đã lưu.</p>
              <button onClick={onCreateNew} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">Chọn đề để thi</button>
            </div>
          ) : (
            <>
              {/* Chọn chế độ ôn tập */}
              <div className="flex flex-wrap items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-fit">
                <button onClick={() => setReviewMode('overview')} className={`px-4 py-2 rounded-lg text-xs font-bold ${reviewMode === 'overview' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Tổng quan</button>
                <button onClick={() => { setReviewMode('quiz-wrong'); setSelectedWrongGroup(null); }} className={`px-4 py-2 rounded-lg text-xs font-bold ${reviewMode === 'quiz-wrong' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Luyện lại câu sai</button>
                <button onClick={() => setReviewMode('weak-topics')} className={`px-4 py-2 rounded-lg text-xs font-bold ${reviewMode === 'weak-topics' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Điểm yếu</button>
                <button onClick={() => setReviewMode('topic-practice')} className={`px-4 py-2 rounded-lg text-xs font-bold ${reviewMode === 'topic-practice' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Ôn theo chủ đề</button>
              </div>

              {reviewMessage && <p role="status" className="text-sm text-amber-700">{reviewMessage}</p>}

              {reviewMode === 'overview' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500">Câu sai chưa ôn (duy nhất)</p><p className="text-2xl font-extrabold text-rose-600 mt-1">{totalUniqueWrong}</p></div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500">Chủ đề cần củng cố</p><p className="text-2xl font-extrabold text-amber-600 mt-1">{significantTopics.length}</p></div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-xs text-slate-500">Điểm gần nhất</p><p className="text-2xl font-extrabold text-emerald-700 mt-1">{latestAttempt ? `${Number(latestAttempt.score).toFixed(1)}/10` : '—'}</p></div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                    <h3 className="font-bold text-slate-900">Bộ đề có câu sai</h3>
                    {wrongGroups.length ? (
                      <div className="space-y-2">
                        {wrongGroups.slice(0, 5).map((group) => (
                          <button key={group.quizId} onClick={() => { setReviewMode('quiz-wrong'); setSelectedWrongGroup(group); }} className="w-full flex items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100 p-3 text-sm text-left">
                            <span className="font-medium text-slate-800 truncate">{group.quizTitle}</span>
                            <span className="text-rose-700 font-semibold whitespace-nowrap">{group.uniqueWrongQuestions} câu sai · {group.attemptCount} lượt</span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">Chưa ghi nhận câu sai nào trong dữ liệu chi tiết.</p>}
                  </div>
                </div>
              )}

              {reviewMode === 'quiz-wrong' && (
                <div className="space-y-4">
                  {!selectedGroupDetail ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">Chọn bộ đề để xem và luyện lại các câu trả lời sai:</p>
                      {wrongGroups.length ? wrongGroups.map((group) => (
                        <div key={group.quizId} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{group.quizTitle}</p>
                            <p className="text-xs text-slate-500">{group.documentName || 'Không rõ tài liệu'} · {group.attemptCount} lượt làm · {group.wrongAnswerCount} lượt sai · {group.uniqueWrongQuestions} câu sai duy nhất</p>
                          </div>
                          <button onClick={() => { setSelectedWrongGroup(group); setSelectedPracticeQuestions(new Set()); }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap">Xem câu sai</button>
                        </div>
                      )) : <p className="text-sm text-slate-500">Chưa có câu sai nào được ghi nhận.</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedWrongGroup(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">← Danh sách bộ đề</button>
                        <span className="text-xs text-slate-500">Nguồn: {selectedGroupDetail.quizTitle} · {selectedGroupDetail.attemptCount} lượt làm</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => startQuizWrongReview(selectedGroupDetail)} disabled={selectedGroupDetail.entries.length === 0} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-40">Luyện tất cả ({selectedGroupDetail.entries.length} câu)</button>
                        <button onClick={() => startQuizWrongReview(selectedGroupDetail, selectedPracticeQuestions.size ? selectedPracticeQuestions : undefined)} disabled={selectedPracticeQuestions.size === 0} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40">Luyện câu đã chọn ({selectedPracticeQuestions.size})</button>
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                        {selectedGroupDetail.entries.map((entry) => (
                          <label key={entry.question.id} className="flex items-start gap-3 p-4 hover:bg-slate-50/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPracticeQuestions.has(entry.question.id)}
                              onChange={(e) => {
                                setSelectedPracticeQuestions((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(entry.question.id); else next.delete(entry.question.id);
                                  return next;
                                });
                              }}
                              className="mt-1 accent-indigo-600"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800">{entry.question.questionText}</p>
                              <p className="text-xs text-slate-500 mt-1">{entry.question.topic?.trim() || 'Chưa phân loại'} · sai {entry.missCount} lần · lần gần nhất: {new Date(entry.lastMissedAt).toLocaleString('vi-VN')} · từ {entry.attempts.length} lần làm bài</p>
                              {entry.question.explanation && <p className="text-xs text-slate-600 mt-1 line-clamp-2"><span className="font-semibold">Đáp án đúng:</span> {entry.question.options.find((o) => o.key === entry.question.correctAnswer)?.text}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {reviewMode === 'weak-topics' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Phân tích từ các câu trả lời trong lịch sử làm bài. Chỉ chủ đề có ít nhất 2 câu trả lời và tỷ lệ đúng dưới 70% mới được đánh dấu cần củng cố.</p>
                  {topicWeaknesses.length ? (
                    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                      {topicWeaknesses.map((topic) => {
                        const isSignificant = significantTopics.some((t) => t.topic === topic.topic);
                        return (
                          <div key={topic.topic} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{topic.topic}</p>
                              <p className="text-xs text-slate-500">Đã làm {topic.answered} câu · sai {topic.incorrect} · đúng {topic.accuracy}% · {topic.attemptsWithWrong} lượt làm có câu sai</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSignificant ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Cần củng cố</span>
                              ) : topic.answered < 2 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">Chưa đủ dữ liệu</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Ổn định</span>
                              )}
                              <button onClick={() => startWeakTopicReview(topic.topic)} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">Luyện chủ đề</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-slate-500">Chưa có dữ liệu trả lời để phân tích chủ đề.</p>}
                </div>
              )}

              {reviewMode === 'topic-practice' && (
                <div className="space-y-4">
                  {selectedWeakTopic ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedWeakTopic(null)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">← Danh sách chủ đề</button>
                        <span className="text-sm font-bold text-slate-900">{selectedWeakTopic}</span>
                      </div>
                      {selectedTopicQuestions.length ? (
                        <>
                          <p className="text-sm text-slate-600">{selectedTopicQuestions.length} câu luyện tập khả dụng từ các bộ đề hiện có (không tự sinh câu hỏi mới).</p>
                          <button onClick={() => startTopicPractice(selectedTopicQuestions, `Luyện tập – ${selectedWeakTopic}`)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Bắt đầu luyện tập</button>
                        </>
                      ) : <p className="text-sm text-slate-500">Chưa có câu hỏi đủ điều kiện cho chủ đề này trong hệ thống.</p>}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[...new Set(quizList.flatMap((quiz) => (quiz.questions || []).map((q) => q.topic?.trim() || 'Chưa phân loại')))]
                        .filter((topic, idx, arr) => arr.indexOf(topic) === idx)
                        .map((topic) => {
                          const available = questionsForTopic(topic as string, attemptsHistory, quizList).length;
                          return (
                            <button key={topic} onClick={() => setSelectedWeakTopic(topic)} className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all">
                              <p className="text-sm font-bold text-slate-900 truncate">{topic}</p>
                              <p className="text-xs text-slate-500 mt-1">{available} câu khả dụng</p>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* DOCUMENT PRINT MODAL */}
      <DocumentPrintModal
        document={selectedDocForPrint}
        isOpen={!!selectedDocForPrint}
        onClose={() => setSelectedDocForPrint(null)}
      />

      {/* DOCUMENT VIEW MODAL */}
      <DocumentViewModal
        document={selectedDocForView}
        isOpen={!!selectedDocForView}
        onClose={() => setSelectedDocForView(null)}
        onPrint={(d) => setSelectedDocForPrint(d)}
        onGenerateQuiz={(d) => {
          if (onSelectDocumentForQuiz) onSelectDocumentForQuiz(d);
        }}
      />

      {/* EXAM PAPER EXPORT MODAL */}
      {selectedQuizForExport && (
        <ExportPaperModal
          quizSet={selectedQuizForExport}
          isOpen={!!selectedQuizForExport}
          onClose={() => setSelectedQuizForExport(null)}
        />
      )}
    </div>
  );
};
