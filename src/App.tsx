import React, { useEffect, useState } from 'react';
import {
  ScreenId,
  QuizSet,
  QuizAttempt,
  DifficultyLevel,
  QuestionType,
  QuizStyle,
  SampleDocument,
  DocumentSource,
} from './types';
import {
  SAMPLE_DOCUMENTS,
} from './data/sampleData';
import { Header } from './components/Header';
import { UploadScreen } from './components/UploadScreen';
import { GeneratingScreen } from './components/GeneratingScreen';
import { QuizDetailScreen } from './components/QuizDetailScreen';
import { QuizTakingScreen } from './components/QuizTakingScreen';
import { QuizResultScreen } from './components/QuizResultScreen';
import { QuizReviewScreen } from './components/QuizReviewScreen';
import { QuizEditScreen } from './components/QuizEditScreen';
import { LibraryHistoryScreen } from './components/LibraryHistoryScreen';
import { SampleModal } from './components/SampleModal';
import { LoginScreen } from './components/LoginScreen';
import { ResearchErrorBoundary } from './components/ResearchErrorBoundary';
import { AuthUser, getCurrentUser, logout } from './services/authApi';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loadedWorkspaceUserId, setLoadedWorkspaceUserId] = useState<number | null>(null);
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('upload');
  const [activeQuizSet, setActiveQuizSet] = useState<QuizSet | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<QuizAttempt | null>(null);
  const [isSmartReviewQuiz, setIsSmartReviewQuiz] = useState(false);
  const [allQuizzes, setAllQuizzes] = useState<QuizSet[]>([]);
  const [allAttempts, setAllAttempts] = useState<QuizAttempt[]>([]);
  const [allDocuments, setAllDocuments] = useState<(SampleDocument | DocumentSource)[]>(SAMPLE_DOCUMENTS);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;
    if (!localStorage.getItem('quizai_access_token')) {
      setIsAuthLoading(false);
      return () => { isActive = false; };
    }

    getCurrentUser()
      .then((user) => { if (isActive) setAuthUser(user); })
      .catch(() => { logout(); })
      .finally(() => { if (isActive) setIsAuthLoading(false); });

    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    if (!authUser) return;

    const storageKey = `quizai_workspace_v1_${authUser.id}`;
    try {
      const savedWorkspace = localStorage.getItem(storageKey);
      const workspace = savedWorkspace ? JSON.parse(savedWorkspace) : {};
      setAllQuizzes(Array.isArray(workspace.quizzes) ? workspace.quizzes : []);
      setAllAttempts(Array.isArray(workspace.attempts) ? workspace.attempts : []);
      setAllDocuments(Array.isArray(workspace.documents) ? workspace.documents : SAMPLE_DOCUMENTS);
    } catch {
      setAllQuizzes([]);
      setAllAttempts([]);
      setAllDocuments(SAMPLE_DOCUMENTS);
    }
    setLoadedWorkspaceUserId(authUser.id);
  }, [authUser]);

  useEffect(() => {
    if (!authUser || loadedWorkspaceUserId !== authUser.id) return;

    localStorage.setItem(`quizai_workspace_v1_${authUser.id}`, JSON.stringify({
      quizzes: allQuizzes,
      attempts: allAttempts,
      documents: allDocuments,
    }));
  }, [authUser, loadedWorkspaceUserId, allQuizzes, allAttempts, allDocuments]);

  // Generation parameters state
  const [generationConfig, setGenerationConfig] = useState<{
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
  }>({
    content: SAMPLE_DOCUMENTS[0].content,
    documentTitle: SAMPLE_DOCUMENTS[0].fileName,
    numQuestions: 10,
    difficulty: 'medium',
    questionType: 'multiple_choice',
    quizStyle: 'standard',
    strictSourceOnly: true,
    mode: 'document',
  });

  // Handler: Start generation from Upload screen
  const handleStartGenerate = (config: {
    content: string;
    documentTitle: string;
    numQuestions: number;
    difficulty: DifficultyLevel;
    questionType: QuestionType;
    quizStyle: QuizStyle;
    scopeChapterId?: string;
    strictSourceOnly: boolean;
    mode?: 'document' | 'web';
    quizTitle?: string;
    prompt?: string;
    topic?: string;
  }) => {
    setGenerationConfig(config);
    setCurrentScreen('generating');
  };

  // Handler: Complete AI generation with generated QuizSet
  const handleGenerationComplete = (generatedQuizSet: QuizSet) => {
    setActiveQuizSet(generatedQuizSet);
    setAllQuizzes((prev) => [generatedQuizSet, ...prev]);
    setCurrentScreen('quiz-detail');
  };

  // Handler: Submit Quiz Attempt
  const handleSubmitQuiz = (attempt: QuizAttempt) => {
    const completedAttempt = { ...attempt, quizSnapshot: activeQuizSet ?? undefined };
    setActiveAttempt(completedAttempt);
    setAllAttempts((prev) => [completedAttempt, ...prev]);
    if (activeQuizSet && !isSmartReviewQuiz && !activeQuizSet.id.startsWith('review-')) {
      setAllQuizzes((prev) => prev.some((quiz) => quiz.id === activeQuizSet.id)
        ? prev
        : [activeQuizSet, ...prev]);
    }
    setIsSmartReviewQuiz(false);
    setCurrentScreen('quiz-result');
  };

  // Handler: Save edits to questions
  const handleSaveQuizEdits = (updatedQuiz: QuizSet) => {
    setActiveQuizSet(updatedQuiz);
    setAllQuizzes((prev) =>
      prev.map((q) => (q.id === updatedQuiz.id ? updatedQuiz : q))
    );
    setCurrentScreen('quiz-detail');
  };

  // Handler: Register newly uploaded/parsed document
  const handleRegisterDocument = (doc: DocumentSource | SampleDocument) => {
    setAllDocuments((prev) => {
      const exists = prev.some((d) => d.id === doc.id || d.fileName === doc.fileName);
      if (exists) {
        return prev.map((d) => (d.id === doc.id || d.fileName === doc.fileName ? doc : d));
      }
      return [doc, ...prev];
    });
  };

  // Handler: Delete document from library
  const handleDeleteDocument = (id: string) => {
    setAllDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDeleteQuiz = (id: string) => {
    const quiz = allQuizzes.find((item) => item.id === id);
    if (!quiz || !window.confirm(`Đưa "${quiz.title}" khỏi kho đề? Lịch sử thi và kết quả sẽ được giữ lại.`)) return;
    const hasAttempts = allAttempts.some((attempt) => attempt.quizId === id);
    setAllQuizzes((prev) => hasAttempts
      ? prev.map((item) => item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item)
      : prev.filter((item) => item.id !== id));
  };

  // Handler: Select a document from library to build a quiz
  const handleSelectDocumentForQuiz = (doc: SampleDocument | DocumentSource) => {
    const content = 'rawText' in doc ? doc.rawText : doc.content || '';
    setGenerationConfig({
      ...generationConfig,
      content,
      documentTitle: doc.fileName,
      scopeChapterId: undefined,
    });
    setCurrentScreen('upload');
  };

  if (isAuthLoading) {
    return <div className="auth-loading" role="status">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!authUser) {
    return <LoginScreen onAuthenticated={setAuthUser} />;
  }

  if (loadedWorkspaceUserId !== authUser.id) {
    return <div className="auth-loading" role="status">Đang tải kho cá nhân...</div>;
  }

  const generatingView = (
    <GeneratingScreen
      documentTitle={generationConfig.documentTitle}
      quizTitle={generationConfig.quizTitle}
      documentContent={generationConfig.content}
      numQuestions={generationConfig.numQuestions}
      difficulty={generationConfig.difficulty}
      questionType={generationConfig.questionType}
      quizStyle={generationConfig.quizStyle}
      scopeChapterId={generationConfig.scopeChapterId}
      strictSourceOnly={generationConfig.strictSourceOnly}
      generationMode={generationConfig.mode || 'document'}
      prompt={generationConfig.prompt}
      topic={generationConfig.topic}
      onComplete={handleGenerationComplete}
    />
  );

  return (
    <div className="workspace-shell">
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => setCurrentScreen(screen)}
        hasActiveQuiz={!!activeQuizSet}
        onOpenSampleModal={() => setIsSampleModalOpen(true)}
        currentUserEmail={authUser.email || authUser.username}
        onLogout={() => {
          logout();
          setAuthUser(null);
          setCurrentScreen('upload');
        }}
      />

      {/* Main View Router */}
      <main className="workspace-main">
        {currentScreen === 'upload' && (
          <UploadScreen
            onStartGenerate={handleStartGenerate}
            onSelectRecentQuiz={(quiz) => {
              setActiveQuizSet(quiz);
              setCurrentScreen('quiz-detail');
            }}
            onRegisterDocument={handleRegisterDocument}
          />
        )}

        {currentScreen === 'generating' && generationConfig.mode === 'web' && (
          <ResearchErrorBoundary
            onBack={() => setCurrentScreen('upload')}
          >
            {generatingView}
          </ResearchErrorBoundary>
        )}

        {currentScreen === 'generating' && generationConfig.mode !== 'web' && generatingView}

        {currentScreen === 'quiz-detail' && (
          activeQuizSet && (
            <QuizDetailScreen
              quizSet={activeQuizSet}
              onStartQuiz={() => setCurrentScreen('quiz-taking')}
              onEditQuestions={() => setCurrentScreen('quiz-edit')}
              onBackToUpload={() => setCurrentScreen('upload')}
            />
          )
        )}

        {currentScreen === 'quiz-taking' && (
          activeQuizSet && (
            <QuizTakingScreen
              quizSet={activeQuizSet}
              onSubmitQuiz={handleSubmitQuiz}
              onExitQuiz={() => setCurrentScreen('quiz-detail')}
            />
          )
        )}

        {currentScreen === 'quiz-result' && (
          activeAttempt && activeQuizSet && (
            <QuizResultScreen
              attempt={activeAttempt}
              quizSet={activeQuizSet}
              onViewDetailedReview={() => setCurrentScreen('quiz-review')}
              onRetakeQuiz={() => setCurrentScreen('quiz-taking')}
              onBackToHome={() => setCurrentScreen('upload')}
            />
          )
        )}

        {currentScreen === 'quiz-review' && (
          activeAttempt && activeQuizSet && (
            <QuizReviewScreen
              attempt={activeAttempt}
              quizSet={activeQuizSet}
              onBackToResult={() => setCurrentScreen('quiz-result')}
              onRetakeQuiz={() => setCurrentScreen('quiz-taking')}
            />
          )
        )}

        {currentScreen === 'quiz-edit' && (
          activeQuizSet && (
            <QuizEditScreen
              quizSet={activeQuizSet}
              onSaveQuiz={handleSaveQuizEdits}
              onCancel={() => setCurrentScreen('quiz-detail')}
            />
          )
        )}

        {currentScreen === 'library-history' && (
          <LibraryHistoryScreen
            documents={allDocuments}
            quizList={allQuizzes.filter((quiz) => !quiz.archivedAt)}
            attemptsHistory={allAttempts}
            onSelectQuiz={(quiz) => {
              setIsSmartReviewQuiz(false);
              setActiveQuizSet(quiz);
              setCurrentScreen('quiz-detail');
            }}
            onRetakeQuiz={(quiz) => {
              setIsSmartReviewQuiz(false);
              setActiveQuizSet(quiz);
              setCurrentScreen('quiz-taking');
            }}
            onSelectAttempt={(attempt) => {
              setActiveAttempt(attempt);
              const foundQuiz = attempt.quizSnapshot || allQuizzes.find((q) => q.id === attempt.quizId);
              if (foundQuiz) {
                setActiveQuizSet(foundQuiz);
                setCurrentScreen('quiz-result');
              }
            }}
            onStartReview={(quiz) => {
              setIsSmartReviewQuiz(true);
              setActiveQuizSet(quiz);
              setCurrentScreen('quiz-taking');
            }}
            onCreateNew={() => setCurrentScreen('upload')}
            onDeleteDocument={handleDeleteDocument}
            onDeleteQuiz={handleDeleteQuiz}
            onSelectDocumentForQuiz={handleSelectDocumentForQuiz}
          />
        )}
      </main>

      {/* Sample Modal for Testing */}
      <SampleModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectDocument={(doc) => {
          setGenerationConfig({
            ...generationConfig,
            content: doc.content,
            documentTitle: doc.fileName,
          });
          setCurrentScreen('upload');
        }}
        onSelectQuiz={(quiz) => {
          setActiveQuizSet(quiz);
          setCurrentScreen('quiz-detail');
        }}
      />
    </div>
  );
}
