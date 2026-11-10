import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { AuthUser, getCurrentUser, login, register } from '../services/authApi';

interface LoginScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

export const LoginScreen = ({ onAuthenticated }: LoginScreenProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegistering = mode === 'register';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const identifier = email.trim();
      if (isRegistering) {
        await register(username.trim(), password, identifier.toLowerCase());
      }
      await login(isRegistering ? identifier.toLowerCase() : identifier, password);
      onAuthenticated(await getCurrentUser());
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '';
      setError(
        message.includes('Failed to fetch') || message.includes('NetworkError')
          ? 'Không thể kết nối máy chủ tài khoản. Hãy kiểm tra Django API đang chạy ở cổng 8000.'
          : message === 'API error 500'
            ? 'Máy chủ tài khoản gặp lỗi nội bộ. Hãy kiểm tra database đã migrate và khởi động lại Django API.'
            : message || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="QuizAI">
        <div className="auth-grid" aria-hidden="true" />
        <div className="auth-brand">
          <span className="auth-brand-mark"><BookOpenCheck size={22} strokeWidth={2.2} /></span>
          <span>QuizAI</span>
          <span className="auth-brand-divider" />
          <span className="auth-brand-caption">STUDY WORKSPACE</span>
        </div>

        <div className="auth-story-content">
          <div className="auth-eyebrow"><Sparkles size={14} /> HỌC TẬP CÓ CĂN CỨ</div>
          <h1>Tài liệu của bạn.<br />Bộ đề của bạn.</h1>
          <p className="auth-story-description">
            Biến nội dung học tập thành câu hỏi có trích dẫn nguồn, rồi theo dõi tiến độ ôn tập trong cùng một nơi.
          </p>

          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-topline">
              <span><span className="auth-live-dot" /> BỘ ĐỀ MỚI</span>
              <span>01 / 10</span>
            </div>
            <p className="auth-preview-question">Mệnh đề nào xác định bảng nguồn trong truy vấn SQL?</p>
            <div className="auth-preview-answer"><span>A</span> FROM <Check size={15} /></div>
            <div className="auth-preview-answer muted"><span>B</span> WHERE</div>
            <div className="auth-preview-source"><span className="auth-source-rule" /> Trích dẫn từ tài liệu · Trang 42</div>
          </div>
        </div>

        <div className="auth-story-footer">
          <span><Check size={14} /> Bám sát tài liệu gốc</span>
          <span><Check size={14} /> Theo dõi lịch sử học</span>
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand">
          <span className="auth-brand-mark"><BookOpenCheck size={21} /></span>
          <span>QuizAI</span>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <p className="auth-form-kicker">KHÔNG GIAN HỌC TẬP CỦA BẠN</p>
            <h2>{isRegistering ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</h2>
            <p>{isRegistering ? 'Bắt đầu xây dựng bộ đề từ tài liệu của bạn.' : 'Đăng nhập để tiếp tục ôn tập và tạo đề.'}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegistering && (
              <label className="auth-field">
                <span>Tên đăng nhập</span>
                <span className="auth-input-wrap">
                  <UserRound size={18} aria-hidden="true" />
                  <input
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Tên bạn muốn sử dụng"
                    required
                  />
                </span>
              </label>
            )}

            <label className="auth-field">
                <span>{isRegistering ? 'Email' : 'Email hoặc tên đăng nhập'}</span>
              <span className="auth-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  type={isRegistering ? 'email' : 'text'}
                  autoComplete={isRegistering ? 'email' : 'username'}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isRegistering ? 'ban@example.com' : 'ban@example.com hoặc username'}
                  required
                />
              </span>
            </label>

            <label className="auth-field">
              <span>Mật khẩu</span>
              <span className="auth-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  minLength={isRegistering ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegistering ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu'}
                  required
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                  aria-label={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {isPasswordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {isRegistering && <small>Mật khẩu cần có tối thiểu 8 ký tự.</small>}
            </label>

            {!isRegistering && (
              <p className="auth-password-help">Cần đặt lại mật khẩu? Liên hệ quản trị viên.</p>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Đang xác thực...' : isRegistering ? 'Tạo tài khoản' : 'Đăng nhập'}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-mode-switch">
            {isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <button type="button" onClick={() => changeMode(isRegistering ? 'login' : 'register')}>
              {isRegistering ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </p>
          <div className="auth-security-note"><LockKeyhole size={13} /> Kết nối được bảo vệ bằng xác thực JWT</div>
        </div>
        <p className="auth-legal">QuizAI <span>·</span> Trợ lý tạo đề thi từ tài liệu học tập</p>
      </section>
    </main>
  );
};