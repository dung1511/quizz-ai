import React, { useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  BookOpenText,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FolderOpen,
  LibraryBig,
  LogOut,
  Menu,
  PencilLine,
  Play,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ScreenId } from '../types';

interface HeaderProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  hasActiveQuiz: boolean;
  onOpenSampleModal?: () => void;
  currentUserEmail: string;
  onLogout: () => void;
}

interface NavigationItem {
  id: ScreenId;
  label: string;
  description?: string;
  icon: LucideIcon;
}

const workspaceItems: NavigationItem[] = [
  { id: 'upload', label: 'Tạo đề mới', description: 'Từ tài liệu học tập', icon: FilePlus2 },
  { id: 'library-history', label: 'Kho học tập', description: 'Tài liệu và lịch sử', icon: LibraryBig },
];

const quizItems: NavigationItem[] = [
  { id: 'quiz-detail', label: 'Bộ câu hỏi', icon: ClipboardList },
  { id: 'quiz-taking', label: 'Làm bài', icon: Play },
  { id: 'quiz-result', label: 'Kết quả', icon: BarChart3 },
  { id: 'quiz-review', label: 'Ôn tập đáp án', icon: BookOpenText },
  { id: 'quiz-edit', label: 'Chỉnh sửa đề', icon: PencilLine },
];

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  hasActiveQuiz,
  onOpenSampleModal,
  currentUserEmail,
  onLogout,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navigate = (screen: ScreenId) => {
    onNavigate(screen);
    setIsMobileOpen(false);
  };

  const renderNavigationItem = (item: NavigationItem, primary = false) => {
    const Icon = item.icon;
    const isActive = currentScreen === item.id || (item.id === 'upload' && currentScreen === 'generating');

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        aria-current={isActive ? 'page' : undefined}
        id={`nav-screen-${item.id}`}
        className={`quiz-nav-link ${primary ? 'quiz-nav-link-primary' : ''} ${isActive ? 'is-active' : ''}`}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        <span className="quiz-nav-copy">
          <span>{item.label}</span>
          {item.description && <small>{item.description}</small>}
        </span>
        {isActive && !primary && <ChevronRight className="quiz-nav-chevron" size={15} aria-hidden="true" />}
      </button>
    );
  };

  return (
    <header className="quiz-header">
      <div className="quiz-header-top">
        <button
          type="button"
          className="quiz-mobile-menu"
          onClick={() => setIsMobileOpen((open) => !open)}
          aria-label={isMobileOpen ? 'Đóng điều hướng' : 'Mở điều hướng'}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <button type="button" className="quiz-brand" onClick={() => navigate('upload')} id="brand-logo-button">
          <span className="quiz-brand-mark"><BookOpenCheck size={22} strokeWidth={2.2} /></span>
          <span className="quiz-brand-copy"><strong>QuizAI</strong><small>Học vui, hiểu sâu</small></span>
        </button>
        <nav className="quiz-primary-nav" aria-label="Điều hướng chính">
          {workspaceItems.map((item) => renderNavigationItem(item, item.id === 'upload'))}
        </nav>
        <div className="quiz-header-actions">
          {onOpenSampleModal && (
            <button type="button" className="quiz-sample-link" onClick={onOpenSampleModal}>
              <FolderOpen size={17} strokeWidth={1.9} />
              <span>Tài liệu mẫu</span>
            </button>
          )}
          <span className="quiz-user-avatar" aria-hidden="true">
            {currentUserEmail.trim().charAt(0).toUpperCase() || 'H'}
          </span>
          <span className="quiz-user-email" title={currentUserEmail}>{currentUserEmail}</span>
          <button type="button" className="quiz-logout" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      {hasActiveQuiz && (
        <div className="quiz-context-wrap">
          <nav className="quiz-context-nav" aria-label="Điều hướng bộ đề hiện tại">
            <span className="quiz-context-label"><Sparkles size={14} /> ĐỀ HIỆN TẠI</span>
            {quizItems.map((item) => renderNavigationItem(item))}
          </nav>
        </div>
      )}

      {isMobileOpen && (
        <div className="quiz-mobile-drawer">
          <nav aria-label="Điều hướng di động">
            {workspaceItems.map((item) => renderNavigationItem(item, item.id === 'upload'))}
            {hasActiveQuiz && quizItems.map((item) => renderNavigationItem(item))}
          </nav>
          {onOpenSampleModal && (
            <button type="button" className="quiz-mobile-action" onClick={() => {
              onOpenSampleModal();
              setIsMobileOpen(false);
            }}>
              <FolderOpen size={18} /> Tài liệu mẫu
            </button>
          )}
          <div className="quiz-mobile-account">
            <span className="quiz-user-avatar" aria-hidden="true">
              {currentUserEmail.trim().charAt(0).toUpperCase() || 'H'}
            </span>
            <span title={currentUserEmail}>{currentUserEmail}</span>
            <button type="button" onClick={onLogout} aria-label="Đăng xuất"><LogOut size={17} /></button>
          </div>
        </div>
      )}
    </header>
  );
};
