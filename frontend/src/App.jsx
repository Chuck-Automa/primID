import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 24px', fontFamily: 'monospace' }}>
          <p style={{ color: '#c0392b', fontWeight: 700, marginBottom: '12px' }}>Error</p>
          <p style={{ fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </p>
          <p style={{ fontSize: '11px', color: '#aaa', marginTop: '12px', whiteSpace: 'pre-wrap' }}>
            {this.state.error.stack}
          </p>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: '20px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Attestations from './pages/Attestations';
import SocialAccounts from './pages/SocialAccounts';
import OAuthVerify from './pages/OAuthVerify';
import Navbar from './components/Navbar';

function getToken() {
  return localStorage.getItem('primid_token');
}

function RequireAuth({ children }) {
  const token = getToken();
  if (!token) return <Navigate to="/" replace />;
  return children;
}

const appStyle = {
  maxWidth: '480px',
  margin: '0 auto',
  minHeight: '100vh',
  background: '#fff',
  boxShadow: '0 0 20px rgba(0,0,0,0.08)',
};

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <div style={appStyle}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Onboarding />} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/attestations" element={<RequireAuth><Attestations /></RequireAuth>} />
          <Route path="/social" element={<RequireAuth><SocialAccounts /></RequireAuth>} />
          <Route path="/verify/oauth" element={<RequireAuth><OAuthVerify /></RequireAuth>} />
        </Routes>
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
