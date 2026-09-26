import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: unknown;
}

class PopupErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }
  componentDidCatch(error: unknown, _info: ErrorInfo) {
    void _info;
    console.error('Popup crash caught:', error);
  }
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#fff', fontSize: 13, fontFamily: 'sans-serif' }}>
          <p style={{ fontWeight: 800, marginBottom: 8 }}>Something went wrong.</p>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>Please click the refresh button in the header or reload the extension.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#fff', color: '#000', borderRadius: 9999, padding: '8px 20px', fontWeight: 800, fontSize: 12 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const el = document.getElementById('root');
if (!el) {
  console.error('#root element missing — popup cannot mount');
} else {
  try {
    createRoot(el).render(
      <StrictMode>
        <PopupErrorBoundary>
          <App />
        </PopupErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    console.error('Failed to mount popup:', err);
    el.innerHTML =
      '<div style="padding:24px;color:#fff;font-size:13px;font-family:sans-serif">Failed to start. Please reload the extension.</div>';
  }
}
