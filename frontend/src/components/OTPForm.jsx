import React, { useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import COUNTRIES, { flagEmoji } from '../data/countries';

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  fontSize: '16px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  boxSizing: 'border-box',
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

const PINNED = ['US', 'CA'];
const pinnedCountries  = COUNTRIES.filter((c) => PINNED.includes(c.code));
const restCountries    = COUNTRIES.filter((c) => !PINNED.includes(c.code));

/** Builds a full international number from a dial code and local digits. */
function buildE164(dialCode, localDigits) {
  // Strip non-digits, then remove a single leading zero (trunk prefix).
  const digits = localDigits.replace(/\D/g, '').replace(/^0/, '');
  return `+${dialCode}${digits}`;
}

export default function OTPForm({ onSuccess }) {
  const { login } = useAuth();
  const [step, setStep]             = useState('phone'); // 'phone' | 'otp'
  const [countryCode, setCountryCode] = useState('US');
  const [localPhone, setLocalPhone] = useState('');
  const [fullPhone, setFullPhone]   = useState(''); // E.164, set when OTP sent
  const [code, setCode]             = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [devCode, setDevCode]       = useState('');

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const phoneNumber = buildE164(selectedCountry.dial, localPhone);
      setFullPhone(phoneNumber);
      const resp = await api.post('/api/verify/phone/initiate', { phoneNumber });
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
      const resp = await api.post('/api/verify/phone/confirm', { phoneNumber: fullPhone, code });
      login(resp.data.accessToken, resp.data.user);
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            style={{
              padding: '14px 10px',
              fontSize: '15px',
              border: '1.5px solid #ddd',
              borderRadius: '8px',
              outline: 'none',
              background: '#fff',
              flexShrink: 0,
              width: '140px',
            }}
          >
            {pinnedCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {flagEmoji(c.code)} {c.name} (+{c.dial})
              </option>
            ))}
            <option disabled>──────────────</option>
            {restCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {flagEmoji(c.code)} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
          <input
            style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
            type="tel"
            placeholder="Phone number"
            value={localPhone}
            onChange={(e) => setLocalPhone(e.target.value)}
            autoComplete="tel-national"
            required
          />
        </div>
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
        Code sent to {fullPhone}.{' '}
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: '#457b9d', cursor: 'pointer', fontSize: '14px' }}
          onClick={() => { setStep('phone'); setError(''); setDevCode(''); }}
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
