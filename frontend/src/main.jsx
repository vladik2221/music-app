import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('React render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Что-то пошло не так</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, textAlign: 'center' }}>{String(this.state.error.message || this.state.error)}</div>
          <button onClick={() => this.setState({ error: null })} style={{ background: '#1db954', color: '#000', border: 'none', borderRadius: 20, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
