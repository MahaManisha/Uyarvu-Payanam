import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    localStorage.removeItem('studentData');
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0b1329',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '36px 28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 20px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '10px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
              We encountered an unexpected issue while loading this page. Clearing temporary cache and reloading should resolve it.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }}
              >
                Reload & Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
