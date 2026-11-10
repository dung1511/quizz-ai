import React, { useEffect, useState, useRef } from 'react';
import { DifficultyLevel, QuestionType, QuizStyle, QuizSet } from '../types';
import {
  generateFromTextApi,
  generateFromWebApi,
  parseAiRequestApi,
  persistResearchQuizApi,
  researchTopicApi,
  ResearchRequestAnalysis,
} from '../services/api';

interface GeneratingScreenProps {
  documentTitle: string;
  quizTitle?: string;
  documentContent: string;
  numQuestions: number;
  difficulty: DifficultyLevel;
  questionType: QuestionType;
  quizStyle: QuizStyle;
  scopeChapterId?: string;
  strictSourceOnly: boolean;
  generationMode?: 'document' | 'web';
  prompt?: string;
  topic?: string;
  onComplete: (quizSet: QuizSet) => void;
}

export const GeneratingScreen: React.FC<GeneratingScreenProps> = ({
  documentTitle,
  quizTitle,
  documentContent,
  numQuestions,
  difficulty,
  questionType,
  quizStyle,
  scopeChapterId,
  strictSourceOnly,
  generationMode = 'document',
  prompt,
  topic,
  onComplete,
}) => {
  const [progress, setProgress] = useState<number>(10);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Bắt đầu quy trình xử lý tài liệu...');
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [runVersion, setRunVersion] = useState<number>(0);
  const [activeQuestionCount, setActiveQuestionCount] = useState<number>(numQuestions);
  const [analysisForReview, setAnalysisForReview] = useState<ResearchRequestAnalysis | null>(null);
  const [awaitingScopeConfirmation, setAwaitingScopeConfirmation] = useState<boolean>(false);
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
    setActiveQuestionCount(numQuestions);
  }, [
    runVersion,
    documentTitle,
    quizTitle,
    documentContent,
    numQuestions,
    difficulty,
    questionType,
    quizStyle,
    scopeChapterId,
    strictSourceOnly,
    generationMode,
    prompt,
    topic,
  ]);

  const documentSteps = [
    {
      title: '1. Trích xuất văn bản & Chuẩn hóa dữ liệu',
      description: 'Đọc nội dung văn bản từ tập tin, loại bỏ ký tự rác và chuẩn hóa dấu câu tiếng Việt.',
    },
    {
      title: '2. Phân tích cấu trúc tài liệu & Nhận diện Chương/Mục',
      description: 'Phát hiện các tiêu đề Chương, Mục con và ước tính số trang tương ứng.',
    },
    {
      title: '3. Phân đoạn & Tạo chỉ mục nguồn (Source Index)',
      description: 'Chia nhỏ văn bản thành các đoạn (chunks), liên kết từng đoạn với số trang và chương mục.',
    },
    {
      title: '4. Trích xuất đơn vị kiến thức trọng tâm (Knowledge Units)',
      description: 'Nhận diện khái niệm, định nghĩa, quy tắc, công thức, quy trình và sự so sánh cốt lõi.',
    },
    {
      title: '5. Lập ma trận đặc tả đề thi (Question Blueprint)',
      description: `Phân bổ ${numQuestions} câu hỏi theo các mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng).`,
    },
    {
      title: '6. AI biên soạn câu hỏi & Gắn nguồn gốc chi tiết',
      description: 'Chống bịa đặt kiến thức: Mỗi câu hỏi bắt buộc đính kèm trích dẫn văn bản và lý do sư phạm.',
    },
    {
      title: '7. Kiểm định chất lượng đề thi (Question Validator)',
      description: 'Xác thực 4 phương án, 1 đáp án đúng, câu hỏi không trùng lặp và đối soát dữ kiện với văn bản.',
    },
  ];

  const researchSteps = [
    { title: '1. Phân tích yêu cầu', description: 'Nhận diện môn học, chủ đề, trình độ, phạm vi và số câu hỏi.' },
    { title: '2. Nghiên cứu chủ đề', description: 'Tìm và đọc các nguồn công khai liên quan đến yêu cầu.' },
    { title: '3. Tổng hợp kiến thức trọng tâm', description: 'Đối chiếu nội dung và trích dẫn từ các nguồn đã tìm được.' },
    { title: '4. Tạo bộ câu hỏi', description: 'Biên soạn câu hỏi theo phạm vi và mức độ người dùng yêu cầu.' },
    { title: '5. Kiểm tra chất lượng', description: 'Kiểm tra số câu, lựa chọn, đáp án, trùng lặp và nguồn.' },
    { title: '6. Hoàn thành bộ đề', description: 'Đóng gói câu hỏi, lời giải và nguồn tham khảo.' },
  ];
  const steps = generationMode === 'web' ? researchSteps : documentSteps;

  const tips = [
    'Quy tắc Anti-Hallucination: AI bị cấm tạo kiến thức không tồn tại trong tài liệu nếu bạn chọn chế độ bám sát.',
    'Mỗi câu hỏi được tạo ra đều lưu lại số trang, tên chương, tên mục và đoạn trích nguyên văn từ tài liệu học tập.',
    'Sau khi làm bài kiểm tra, hệ thống sẽ đề xuất lộ trình ôn tập dựa trên các đơn vị kiến thức bạn trả lời sai.',
    'Bạn có thể xuất đề thi dưới dạng chuẩn đề thi in ấn trường Đại học hoặc phiếu tô trắc nghiệm 2B bất cứ lúc nào.',
  ];

  // Elapsed timer
  useEffect(() => {
    if (!isProcessing) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isProcessing]);

  // Tips cycler
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(tipInterval);
  }, [tips.length]);

  // Main Pipeline Execution
  useEffect(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;

    async function executePipeline() {
      try {
        if (generationMode === 'web') {
          setCurrentStepIndex(0);
          setProgress(8);
          setStatusMessage('Đang phân tích môn học, chủ đề, phạm vi và số câu...');
          const requirements = prompt?.trim() || documentTitle;
          const parsed = analysisForReview || await parseAiRequestApi(requirements, numQuestions, difficulty);
          if (cancelled) return;
          setActiveQuestionCount(parsed.question_count);
          if (!analysisForReview) {
            setAnalysisForReview(parsed);
            setAwaitingScopeConfirmation(true);
            setCurrentStepIndex(1);
            setProgress(16);
            setStatusMessage('AI đã phân tích xong. Kiểm tra phạm vi đề xuất trước khi nghiên cứu.');
            setIsProcessing(false);
            return;
          }

          setCurrentStepIndex(1);
          setProgress(24);
          setStatusMessage(`Đang nghiên cứu ${parsed.topic} và các nội dung trọng tâm...`);
          const researched = await researchTopicApi({
            topic: parsed.topic,
            requirements,
            focus_areas: parsed.focus_areas,
            search_queries: parsed.search_queries,
          });
          if (cancelled) return;

          const verifiedAreas = [...new Set(researched.knowledge_units.map((unit) => unit.focus_area))];

          setCurrentStepIndex(2);
          setProgress(48);
          setStatusMessage(`Đã xác minh ${verifiedAreas.length}/${parsed.focus_areas.length} phạm vi và tổng hợp ${researched.knowledge_units.length} đơn vị kiến thức có trích dẫn nguồn.`);

          setCurrentStepIndex(3);
          setProgress(62);
          setStatusMessage(`Đang tạo ${parsed.question_count} câu theo phạm vi đã phân tích...`);
          const generated = await generateFromWebApi({
            topic: parsed.topic,
            instruction: requirements,
            title: quizTitle?.trim() || '',
            analysis: { ...parsed, focus_areas: verifiedAreas },
            research_id: researched.research_id,
            config: { question_count: parsed.question_count, difficulty: parsed.difficulty, strictSourceOnly: true },
          });
          if (cancelled) return;

          setCurrentStepIndex(4);
          setProgress(88);
          setStatusMessage(`Đã kiểm tra ${generated.validationSummary.validCount}/${generated.validationSummary.totalQuestions} câu đạt kiểm định.`);

          const createdQuizSet: QuizSet = {
            id: `quiz-${Date.now()}`,
            title: quizTitle?.trim() || `Đề ${parsed.topic}`,
            documentId: generated.document.id,
            documentName: parsed.topic,
            documentExcerpt: generated.research.sources.map((source) => source.title).join(' • '),
            createdAt: new Date().toISOString(),
            totalQuestions: generated.questions.length,
            recommendedMinutes: Math.max(5, Math.round(generated.questions.length * 1.5)),
            difficulty: parsed.difficulty,
            questionType,
            quizStyle,
            matrix: generated.matrix,
            chapters: generated.document.chapters,
            knowledgeUnits: generated.document.knowledgeUnits,
            questions: generated.questions,
            rawDocumentText: generated.document.rawText,
          };

          setCurrentStepIndex(5);
          setProgress(95);
          setStatusMessage('Đang lưu bộ đề, nguồn và liên kết trích dẫn vào tài khoản...');
          const persistedQuiz = await persistResearchQuizApi({
            researchSessionId: researched.research_session_id,
            title: createdQuizSet.title,
            requirements,
            duration: createdQuizSet.recommendedMinutes,
            questions: generated.questions,
          });
          if (cancelled) return;
          createdQuizSet.databaseId = persistedQuiz.id;
          createdQuizSet.researchSessionId = researched.research_session_id;

          setProgress(100);
          setIsProcessing(false);
          completionTimer = setTimeout(() => onComplete(createdQuizSet), 600);
          return;
        }

        // Process the source and generate questions using the user's instruction.
        setCurrentStepIndex(1);
        setProgress(20);
        setStatusMessage('Đang phân tích tài liệu và yêu cầu tạo đề...');
        setCurrentStepIndex(5);
        setProgress(60);
        setStatusMessage('AI đang biên soạn câu hỏi và gắn nguồn gốc kiến thức chi tiết...');

        const examResult = await generateFromTextApi({
          text: documentContent,
          instruction: prompt?.trim() || `Tạo ${numQuestions} câu hỏi từ tài liệu ${documentTitle}.`,
          config: {
            documentTitle,
            question_count: numQuestions,
            difficulty,
            strictSourceOnly,
            fileType: documentTitle.toLowerCase().endsWith('.docx')
              ? 'docx'
              : documentTitle.toLowerCase().endsWith('.txt')
                ? 'txt'
                : 'pdf',
          },
        });
        if (cancelled) return;
        const docSource = examResult.document;

        // Step 7: Validator
        setCurrentStepIndex(6);
        setProgress(95);
        setStatusMessage(`Đã kiểm định: ${examResult.validationSummary.validCount}/${examResult.validationSummary.totalQuestions} câu hỏi hoàn toàn hợp lệ.`);

        const createdQuizSet: QuizSet = {
          id: `quiz-${Date.now()}`,
          title: quizTitle?.trim() || documentTitle.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          documentId: docSource.id,
          documentName: documentTitle,
          documentExcerpt: documentContent.slice(0, 160) + '...',
          createdAt: new Date().toISOString(),
          totalQuestions: examResult.questions.length,
          recommendedMinutes: Math.max(5, Math.round(examResult.questions.length * 1.5)),
          difficulty,
          questionType,
          quizStyle,
          matrix: examResult.matrix,
          chapters: docSource.chapters,
          knowledgeUnits: docSource.knowledgeUnits,
          questions: examResult.questions,
          rawDocumentText: documentContent,
        };

        setProgress(100);
        setIsProcessing(false);
        completionTimer = setTimeout(() => {
          onComplete(createdQuizSet);
        }, 600);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Pipeline error:', err);
        setGenerationError(err?.message || 'Không thể tạo bộ đề. Vui lòng thử lại.');
        setStatusMessage('Quá trình tạo bộ đề đã dừng do lỗi.');
        setIsProcessing(false);
      }
    }

    executePipeline();
    return () => {
      cancelled = true;
      hasTriggeredRef.current = false;
      if (completionTimer) clearTimeout(completionTimer);
    };
  }, [documentContent, documentTitle, quizTitle, numQuestions, difficulty, questionType, quizStyle, strictSourceOnly, generationMode, prompt, topic, onComplete, runVersion]);

  const confirmScopeAndResearch = () => {
    if (!analysisForReview?.focus_areas.length) return;
    setAwaitingScopeConfirmation(false);
    setGenerationError(null);
    setIsProcessing(true);
    setProgress(20);
    setCurrentStepIndex(1);
    setStatusMessage('Đang nghiên cứu theo phạm vi đã xác nhận...');
    hasTriggeredRef.current = false;
    setRunVersion((version) => version + 1);
  };

  const retryGeneration = () => {
    hasTriggeredRef.current = false;
    setAwaitingScopeConfirmation(false);
    setGenerationError(null);
    setStatusMessage('Bắt đầu quy trình xử lý tài liệu...');
    setProgress(10);
    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setIsProcessing(true);
    setRunVersion((version) => version + 1);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14 space-y-8 text-center">
      {/* Central Animated Orb */}
      <div className="relative flex items-center justify-center mx-auto w-32 h-32 sm:w-36 sm:h-36">
        <div className="absolute inset-0 rounded-full bg-indigo-500/15 animate-ping opacity-75" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-500 opacity-20 blur-xl animate-pulse" />
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-indigo-700 via-blue-600 to-emerald-600 flex flex-col items-center justify-center text-white shadow-xl shadow-indigo-500/20">
          <span className={`material-symbols-outlined text-[36px] sm:text-[40px] ${isProcessing ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }}>
            neurology
          </span>
          <span className="text-xs font-bold mt-0.5 font-mono tracking-wider">{progress}%</span>
        </div>
      </div>

      {/* Title & Document Info */}
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
          {generationError
            ? 'Không thể tạo bộ câu hỏi'
            : awaitingScopeConfirmation
            ? 'AI đã phân tích yêu cầu'
            : generationMode === 'web'
            ? 'AI đang nghiên cứu Internet & tạo đề thi...'
            : 'AI đang xử lý tài liệu & biên soạn đề thi...'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          {generationMode === 'web' ? 'Bộ đề: ' : 'Tài liệu: '}
          <span className="font-bold text-slate-900">{documentTitle}</span> • Chỉ tiêu:{' '}
            <span className="font-bold text-indigo-700">{activeQuestionCount} câu hỏi trắc nghiệm</span>
        </p>
      </div>

      {/* Progress Bar & Status */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5 text-indigo-700">
            <span className={`inline-block w-2 h-2 rounded-full ${isProcessing ? 'bg-emerald-500 animate-ping' : generationError ? 'bg-rose-500' : 'bg-slate-400'}`} />
            {statusMessage}
          </span>
          <span className="flex items-center gap-1 font-mono text-slate-500">
            <span className="material-symbols-outlined text-[15px]">timer</span>
            {formatTime(elapsedSeconds)}
          </span>
        </div>

        {/* Bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 rounded-full transition-all duration-300 shadow-xs"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {generationError && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-left text-sm text-rose-900">
          <p className="font-bold">Không thể tạo bộ câu hỏi</p>
          <p className="mt-1">{generationError}</p>
          <p className="mt-2 text-xs">Kiểm tra thông báo lỗi ở trên trước khi thử lại. Khi Gemini hết quota, hãy chờ quota được làm mới; không cần gửi API key từ trình duyệt.</p>
          <button
            type="button"
            onClick={retryGeneration}
            className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
          >
            Thử lại
          </button>
        </div>
      )}

      {awaitingScopeConfirmation && analysisForReview && (
        <section className="rounded-2xl border border-indigo-200 bg-white p-5 sm:p-6 text-left shadow-sm space-y-4" aria-labelledby="research-scope-title">
          <div>
            <h3 id="research-scope-title" className="text-base font-bold text-slate-900">Phạm vi kiến thức AI đề xuất</h3>
            <p className="mt-1 text-xs text-slate-600">
              {analysisForReview.scope_mode === 'inferred'
                ? 'Yêu cầu chưa nêu các mục cụ thể; AI đề xuất phạm vi nhập môn dưới đây để bạn xác nhận.'
                : 'AI đã trích xuất phạm vi bạn yêu cầu. Hãy kiểm tra trước khi bắt đầu nghiên cứu.'}
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-xs font-semibold text-slate-500">Môn học</dt><dd className="font-semibold text-slate-900">{analysisForReview.subject}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Chủ đề</dt><dd className="font-semibold text-slate-900">{analysisForReview.topic}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Trình độ</dt><dd className="font-semibold text-slate-900">{analysisForReview.education_level || 'Cơ bản'}</dd></div>
            <div>
              <dt className="text-xs font-semibold text-slate-500">Số câu</dt>
              <dd className="font-semibold text-slate-900">
                {analysisForReview.question_count} câu · {analysisForReview.question_count_source === 'requirements' ? 'ưu tiên số ghi trong yêu cầu' : 'theo bộ chọn số câu'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-slate-500">Độ khó</dt>
              <dd className="font-semibold text-slate-900">
                {analysisForReview.difficulty_profile === 'foundational'
                  ? 'Cơ bản · nhận biết và thông hiểu · không có câu hard'
                  : analysisForReview.difficulty_profile === 'progressive'
                    ? 'Tăng dần theo yêu cầu'
                    : `Theo yêu cầu · ${analysisForReview.difficulty}`}
              </dd>
            </div>
          </dl>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-600">Các phần sẽ nghiên cứu</h4>
            <p className="mt-1 text-[11px] text-slate-500">Mỗi dòng là một phạm vi; bạn có thể chỉnh trước khi nghiên cứu (tối đa 8 mục).</p>
            <textarea
              value={analysisForReview.focus_areas.join('\n')}
              onChange={(event) => {
                const focusAreas = event.target.value.split(/\n|;/).map((area) => area.trim()).filter(Boolean).slice(0, 8);
                setAnalysisForReview((current) => current ? {
                  ...current,
                  focus_areas: focusAreas,
                  scope_mode: 'explicit',
                  search_queries: [current.topic, ...focusAreas].slice(0, 5),
                } : current);
              }}
              rows={Math.min(8, Math.max(3, analysisForReview.focus_areas.length))}
              aria-label="Phạm vi kiến thức sẽ nghiên cứu"
              className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {analysisForReview.scope_notes.length > 0 && (
            <p className="text-xs text-slate-600"><strong>Ràng buộc:</strong> {analysisForReview.scope_notes.join('; ')}</p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={!analysisForReview.focus_areas.length} onClick={confirmScopeAndResearch} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              Xác nhận phạm vi và nghiên cứu
            </button>
          </div>
        </section>
      )}

      {/* Steps Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 text-left space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {generationMode === 'web' ? 'Tiến trình AI nghiên cứu chủ đề' : 'Tiến trình phân tích & kiểm định tài liệu'}
          </h3>
          <span className="text-xs text-indigo-600 font-semibold font-mono">
            {currentStepIndex + 1}/{steps.length}
          </span>
        </div>

        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isFinished = idx < currentStepIndex || progress >= 100;
            const isCurrent = isProcessing && idx === currentStepIndex && progress < 100;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                  isFinished
                    ? 'border-emerald-200 bg-emerald-50/25 text-emerald-950'
                    : isCurrent
                    ? 'border-indigo-300 bg-indigo-50/40 text-slate-900 shadow-2xs'
                    : 'border-slate-200 opacity-50 text-slate-400'
                }`}
              >
                <div className="mt-0.5">
                  {isFinished ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center animate-pulse">
                      <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs sm:text-sm font-bold ${isCurrent ? 'text-indigo-700' : isFinished ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rotating Tip */}
      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 text-left">
        <span className="material-symbols-outlined text-[22px] shrink-0 text-amber-600">lightbulb</span>
        <span className="leading-relaxed">{tips[tipIndex]}</span>
      </div>
    </div>
  );
};
