import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const containerStyle = {
  padding: '76px 24px 100px',
};

const providerBtnStyle = (bg, color, border) => ({
  width: '100%',
  padding: '16px',
  fontSize: '16px',
  fontWeight: 600,
  background: bg,
  color,
  border: border || 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
});

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function OAuthVerify() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const googleClientRef = useRef(null);

  const handleOAuth = async (provider, token) => {
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/api/verify/oauth', { provider, token });
      localStorage.setItem('primid_token', resp.data.token);
      localStorage.setItem('primid_user', JSON.stringify(resp.data.user));
      navigate('/profile');
    } catch (err) {
      setError(err.response?.data?.message || `${provider} sign-in failed.`);
    } finally {
      setLoading(false);
    }
  };

  // Initialise Google token client (scope: openid only).
  // Access token flow — no code exchange, no client secret required.
  // Consent screen shows only "Know who you are on Google" with openid scope.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.oauth2) return;
      googleClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid',
        callback: (response) => {
          if (response.access_token) handleOAuth('google', response.access_token);
        },
      });
    };

    if (window.google?.accounts?.oauth2) {
      initGoogle();
    } else {
      const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (script) {
        script.addEventListener('load', initGoogle);
        return () => script.removeEventListener('load', initGoogle);
      }
    }
  }, []);

  return (
    <div style={containerStyle}>
      <button
        onClick={() => navigate('/profile')}
        style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '28px' }}
      >
        ← Back
      </button>

      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '28px', color: '#457b9d', marginBottom: '8px' }}>▲</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>
          Tier 2 — OAuth Verified
        </h1>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>
          Connect a Google or Apple account to verify your identity and unlock a 90-day session.
        </p>
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '16px', marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          What you get
        </p>
        <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '16px', lineHeight: 1.8, margin: 0 }}>
          <li>Session extended to 90 days</li>
          <li>Ability to issue attestations</li>
          <li>Pathway to Tier 1 via ZK proofs</li>
        </ul>
      </div>

      <button
        style={providerBtnStyle(
          GOOGLE_CLIENT_ID ? '#fff' : '#e8e8e8',
          GOOGLE_CLIENT_ID ? '#1a1a2e' : '#aaa',
          GOOGLE_CLIENT_ID ? '1.5px solid #ddd' : 'none'
        )}
        onClick={() => googleClientRef.current?.requestAccessToken()}
        disabled={loading || !GOOGLE_CLIENT_ID}
        title={GOOGLE_CLIENT_ID ? undefined : 'Add REACT_APP_GOOGLE_CLIENT_ID to enable'}
      >
        <span style={{ fontSize: '18px' }}>G</span>
        Continue with Google
      </button>

      <button
        style={providerBtnStyle('#fff', '#1a1a2e', '1.5px solid #ddd')}
        onClick={() => handleOAuth('apple', 'apple_test_token')}
        disabled={loading}
      >
        <span style={{ fontSize: '18px' }}>🍎</span>
        Continue with Apple
      </button>

      {error && (
        <p style={{ color: '#c0392b', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
          {error}
        </p>
      )}

      {loading && (
        <p style={{ color: '#888', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
          Connecting…
        </p>
      )}
    </div>
  );
}
