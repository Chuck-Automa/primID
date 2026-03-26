import React, { useState, useEffect } from 'react';
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

export default function Onboarding() {
  const navigate = useNavigate();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('primid_token');
    if (token) navigate('/profile');
  }, [navigate]);

  const handleOtpSuccess = () => {
    navigate('/profile');
  };

  const handleOAuth = async (provider) => {
    setOauthError('');
    setOauthLoading(true);
    try {
      // In dev, use stub token. In production, integrate Google/Apple SDK.
      const testToken = provider === 'google' ? 'google_test_token' : 'apple_test_token';

      // Note: Production Google OAuth requires actual flow (e.g., @react-oauth/google).
      // This is a dev placeholder.
      if (process.env.NODE_ENV !== 'development') {
        setOauthError('OAuth requires production configuration. Use phone OTP in dev.');
        setOauthLoading(false);
        return;
      }

      const resp = await api.post('/api/verify/oauth', { provider, token: testToken });
      localStorage.setItem('primid_token', resp.data.token);
      localStorage.setItem('primid_user', JSON.stringify(resp.data.user));
      navigate('/profile');
    } catch (err) {
      setOauthError(err.response?.data?.message || `${provider} sign-in failed.`);
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>primID</h1>
      <p style={subStyle}>
        Your portable, privacy-preserving identity. Start with your phone — upgrade at your own pace.
      </p>

      <OTPForm onSuccess={handleOtpSuccess} />

      <div style={dividerStyle}>— or —</div>

      <button
        style={oauthBtnStyle('#4285F4', '#fff')}
        onClick={() => handleOAuth('google')}
        disabled={oauthLoading}
      >
        Continue with Google
      </button>

      <button
        style={oauthBtnStyle('#fff', '#1a1a2e')}
        onClick={() => handleOAuth('apple')}
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
