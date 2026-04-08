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
import Lookup from './pages/Lookup';
import LookupResult from './pages/LookupResult';
import Navbar from './components/Navbar';

/**
 * Returns the stored JWT only if it exists and has not expired.
 * Checks the `exp` claim in the payload — no signature verification (server handles that).
 * Clears a stale token from localStorage so the user isn't silently trapped.
 */
function getValidToken() {
  const token = localStorage.getItem('primid_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('primid_token');
      localStorage.removeItem('primid_user');
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem('primid_token');
    localStorage.removeItem('primid_user');
    return null;
  }
}

function RequireAuth({ children }) {
  if (!getValidToken()) return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }) {
  if (getValidToken()) return <Navigate to="/profile" replace />;
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
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<RequireGuest><Onboarding /></RequireGuest>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/attestations" element={<RequireAuth><Attestations /></RequireAuth>} />
          <Route path="/social" element={<RequireAuth><SocialAccounts /></RequireAuth>} />
          <Route path="/verify/oauth" element={<RequireAuth><OAuthVerify /></RequireAuth>} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/lookup/:platform/:handle" element={<LookupResult />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
