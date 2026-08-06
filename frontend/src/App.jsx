import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Attestations from './pages/Attestations';
import SocialAccounts from './pages/SocialAccounts';
import OAuthVerify from './pages/OAuthVerify';
import PhoneVerify from './pages/PhoneVerify';
import QVLanding from './pages/QVLanding';
import Lookup from './pages/Lookup';
import LookupResult from './pages/LookupResult';
import ProfileCard from './pages/ProfileCard';
import Navbar from './components/Navbar';
import DeleteAccount from './pages/DeleteAccount';

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

function RequireAuth({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: '80px 24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Navigate to="/profile" replace />;
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
        <AuthProvider>
          <div style={appStyle}>
            <Navbar />
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<RequireGuest><Onboarding /></RequireGuest>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/attestations" element={<RequireAuth><Attestations /></RequireAuth>} />
              <Route path="/social" element={<RequireAuth><SocialAccounts /></RequireAuth>} />
              <Route path="/verify/oauth" element={<RequireAuth><OAuthVerify /></RequireAuth>} />
              <Route path="/verify/phone" element={<RequireAuth><PhoneVerify /></RequireAuth>} />
              <Route path="/verify/qv" element={<RequireAuth><QVLanding /></RequireAuth>} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/lookup/:platform/:handle" element={<LookupResult />} />
              <Route path="/id/:platform/:handle" element={<ProfileCard />} />
              <Route path="/delete-account" element={<RequireAuth><DeleteAccount /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
