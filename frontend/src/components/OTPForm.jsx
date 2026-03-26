import React, { useState } from 'react';
import api from '../services/api';

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  fontSize: '16px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  marginBottom: '12px',
};

const btnStyle = {
  width: '100%',
  padding: '14px',
  fontSize: '16px',
  fontWeight: 600,
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
};

export default function OTPForm({ onSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/api/verify/phone/initiate', { phoneNumber: phone });
      // Dev mode: backend may return the code in the response (when Twilio not configured)
      if (resp.data.devCode) setDevCode(resp.data.devCode);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await api.post('/api/verify/phone/confirm', { phoneNumber: phone, code });
      localStorage.setItem('primid_token', resp.data.token);
      localStorage.setItem('primid_user', JSON.stringify(resp.data.user));
      onSuccess(resp.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendOtp}>
        <input
          style={inputStyle}
          type="tel"
          placeholder="Phone number (e.g. +15555555555)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        {error && <p style={{ color: '#c0392b', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}
        <button style={btnStyle} type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send verification code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleConfirmOtp}>
      <p style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
        Code sent to {phone}.{' '}
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: '#457b9d', cursor: 'pointer', fontSize: '14px' }}
          onClick={() => setStep('phone')}
        >
          Change
        </button>
      </p>
      {devCode && (
        <p style={{ marginBottom: '12px', fontSize: '13px', background: '#fff3cd', padding: '8px', borderRadius: '4px' }}>
          Dev mode — OTP: <strong>{devCode}</strong>
        </p>
      )}
      <input
        style={inputStyle}
        type="text"
        inputMode="numeric"
        placeholder="6-digit code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        required
      />
      {error && <p style={{ color: '#c0392b', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}
      <button style={btnStyle} type="submit" disabled={loading}>
        {loading ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  );
}
