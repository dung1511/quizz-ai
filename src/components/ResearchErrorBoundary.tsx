import React from 'react';

interface ResearchErrorBoundaryProps {
  children: React.ReactNode;
  onBack: () => void;
}

interface ResearchErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  retryRevision: number;
}

export class ResearchErrorBoundary extends React.Component<ResearchErrorBoundaryProps, ResearchErrorBoundaryState> {
  private readonly boundaryProps: ResearchErrorBoundaryProps;
  state: ResearchErrorBoundaryState = { hasError: false, errorMessage: '', retryRevision: 0 };

  constructor(props: ResearchErrorBoundaryProps) {
    super(props);
    this.boundaryProps = props;
  }

  static getDerivedStateFromError(error: unknown): ResearchErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      retryRevision: 0,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AI Research] React render error:', error, info.componentStack);
  }

  private retry = () => {
    const setState = (this as unknown as {
      setState: (updater: (state: ResearchErrorBoundaryState) => ResearchErrorBoundaryState) => void;
    }).setState;
    setState.call(this, (state) => ({
      hasError: false,
      errorMessage: '',
      retryRevision: state.retryRevision + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <section role="alert" className="mx-auto max-w-2xl rounded-xl border border-rose-300 bg-rose-50 p-6 text-rose-950">
          <h2 className="text-lg font-bold">Đã xảy ra lỗi khi hiển thị kết quả nghiên cứu.</h2>
          <p className="mt-2 text-sm">Không thể hiển thị bước hiện tại. Thông tin kỹ thuật đã được ghi vào console.</p>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer font-semibold">Thông tin lỗi</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.errorMessage}</pre>
          </details>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={this.retry} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800">
              Thử lại
            </button>
            <button type="button" onClick={this.boundaryProps.onBack} className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100">
              Quay lại
            </button>
          </div>
        </section>
      );
    }

    return <React.Fragment key={this.state.retryRevision}>{this.boundaryProps.children}</React.Fragment>;
  }
}
