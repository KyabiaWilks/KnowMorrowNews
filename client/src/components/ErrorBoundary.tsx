import { Component, type ErrorInfo, type ReactNode } from 'react';

/** 单个页面出错时不要把整站拖成白屏 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[jontop] 页面渲染出错', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty" style={{ padding: 60 }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🌑</div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Something went wrong on this page.</div>
        <div style={{ fontSize: 13, marginBottom: 16 }}>{this.state.error.message}</div>
        <button className="btn" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
