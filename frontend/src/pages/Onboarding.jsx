import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import OTPForm from '../components/OTPForm';
import api from '../services/api';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: '40px 24px 80px',
};

const headingStyle = {
  fontSize: '28px',
  fontWeight: 700,
  marginBottom: '8px',
  color: '#1a1a2e',
};

const subStyle = {
  fontSize: '16px',
  color: '#666',
  marginBottom: '40px',
  lineHeight: 1.5,
};

const dividerStyle = {
  textAlign: 'center',
  color: '#aaa',
  margin: '20px 0',
  fontSize: '13px',
};

const oauthBtnStyle = (bg, color) => ({
  width: '100%',
  padding: '14px',
  fontSize: '16px',
  fontWeight: 600,
  background: bg,
  color: color,
  border: bg === '#fff' ? '1.5px solid #ddd' : 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  marginBottom: '10px',
});

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function Onboarding() {
  const navigate = useNavigate();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('primid_token');
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp || payload.exp * 1000 > Date.now()) {
        navigate('/profile');
      } else {
        localStorage.removeItem('primid_token');
        localStorage.removeItem('primid_user');
      }
    } catch {
      localStorage.removeItem('primid_token');
      localStorage.removeItem('primid_user');
    }
  }, [navigate]);

  const handleOtpSuccess = () => {
    navigate('/profile');
  };

  // Registration/login via OAuth — routes through /api/auth/register (no auth required)
  const handleOAuth = async (provider, token) => {
    setOauthError('');
    setOauthLoading(true);
    try {
      const resp = await api.post('/api/auth/register', { method: 'oauth', provider, token });
      localStorage.setItem('primid_token', resp.data.token);
      localStorage.setItem('primid_user', JSON.stringify(resp.data.user));
      navigate('/profile');
    } catch (err) {
      setOauthError(err.response?.data?.message || `${provider} sign-in failed.`);
    } finally {
      setOauthLoading(false);
    }
  };

  // Render Google's GIS button once the script is ready
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handleOAuth('google', response.credential),
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 320,
        text: 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
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
      <h1 style={headingStyle}>primID</h1>
      <p style={subStyle}>
        Your portable, privacy-preserving identity. Start with your phone — upgrade at your own pace.
      </p>

      <OTPForm onSuccess={handleOtpSuccess} />

      <div style={dividerStyle}>— or —</div>

      {/* Google button — GIS-rendered when client ID set, fallback otherwise */}
      {GOOGLE_CLIENT_ID ? (
        <div ref={googleBtnRef} style={{ marginBottom: '10px', minHeight: '44px' }} />
      ) : (
        <button
          style={{ ...oauthBtnStyle('#e8e8e8', '#aaa'), cursor: 'not-allowed' }}
          disabled
          title="Add REACT_APP_GOOGLE_CLIENT_ID to enable"
        >
          Continue with Google
        </button>
      )}

      <button
        style={oauthBtnStyle('#fff', '#1a1a2e')}
        onClick={() => handleOAuth('apple', 'apple_test_token')}
        disabled={oauthLoading}
      >
        Continue with Apple
      </button>

      {oauthError && (
        <p style={{ color: '#c0392b', marginTop: '12px', fontSize: '14px', textAlign: 'center' }}>
          {oauthError}
        </p>
      )}
    </div>
  );
}
