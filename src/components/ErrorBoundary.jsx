import { Component } from 'react';

/** 화면 하나에서 오류가 나도 앱 전체가 흰 화면이 되지 않도록 막아줌 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[코트노트] 화면 오류', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty">
        <div className="empty-icon">😵</div>
        <p className="empty-title">화면을 불러오지 못했어요</p>
        <p className="muted small">저장된 기록은 안전해요. 새로고침해 주세요.</p>
        <button className="btn primary" style={{ marginTop: 16 }} onClick={() => location.reload()}>
          새로고침
        </button>
        <p className="muted small" style={{ marginTop: 16 }}>{String(this.state.error?.message || this.state.error)}</p>
      </div>
    );
  }
}
