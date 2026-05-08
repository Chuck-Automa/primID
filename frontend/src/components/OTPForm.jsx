import React, { useState, useEffect, useRef } from 'react';
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
const pinnedCountries = COUNTRIES.filter((c) => PINNED.includes(c.code));
const restCountries   = COUNTRIES.filter((c) => !PINNED.includes(c.code));

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;

/** Builds a full international number from a dial code and local digits. */
function buildE164(dialCode, localDigits) {
  const digits = localDigits.replace(/\D/g, '').replace(/^0/, '');
  return `+${dialCode}${digits}`;
}

export default function OTPForm({ onSuccess }) {
  const { login } = useAuth();
  const [step, setStep]               = useState('phone'); // 'phone' | 'pending'
  const [countryCode, setCountryCode] = useState('US');
  const [localPhone, setLocalPhone]   = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [listenerNumber, setListenerNumber] = useState('');
  const [verifyCode, setVerifyCode]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [copied, setCopied]           = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const phoneNumber = buildE164(selectedCountry.dial, localPhone);
      const resp = await api.post('/api/verify/phone/initiate', { phoneNumber });
      setChallengeId(resp.data.challengeId);
      setListenerNumber(resp.data.listenerNumber);
      setVerifyCode(resp.data.code);
      setCopied(false);
      setStep('pending');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start verification.');
    } finally {
      setLoading(false);
    }
  };

  // Poll status every POLL_INTERVAL_MS until verified or challenge expires.
  useEffect(() => {
    if (step !== 'pending' || !challengeId) return;

    const startTime = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - startTime > CHALLENGE_TTL_MS) {
        clearInterval(interval);
        setError('Verification expired. Please try again.');
        setStep('phone');
        return;
      }
      try {
        const resp = await api.get(`/api/verify/phone/status/${challengeId}`);
        if (resp.data.verified) {
          clearInterval(interval);
          login(resp.data.accessToken, resp.data.user);
          onSuccess(resp.data.user);
        }
      } catch {
        clearInterval(interval);
        setError('Verification expired. Please try again.');
        setStep('phone');
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [step, challengeId]);

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendCode}>
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
          {loading ? 'Starting…' : 'Send verification code'}
        </button>
      </form>
    );
  }

  // step === 'pending': show the code and wait for the user to text it.
  return (
    <div>
      <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}>
        Text the code below to <strong>{listenerNumber}</strong> from your phone:
      </p>
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <p
          style={{
            fontFamily:    'monospace',
            fontSize:      '28px',
            fontWeight:    700,
            letterSpacing: '6px',
            background:    '#f0f4ff',
            borderRadius:  '8px',
            padding:       '16px 48px 16px 16px',
            textAlign:     'center',
            marginBottom:  0,
            userSelect:    'all',
          }}
        >
          {verifyCode}
        </p>
        <button
          type="button"
          title="Copy code"
          onClick={() => {
            navigator.clipboard.writeText(verifyCode).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          style={{
            position:   'absolute',
            top:        '50%',
            right:      '12px',
            transform:  'translateY(-50%)',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            fontSize:   '16px',
            padding:    '4px',
            color:      copied ? '#2ecc71' : '#888',
          }}
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
        Waiting for verification…
      </p>
      {error && <p style={{ color: '#c0392b', marginBottom: '12px', fontSize: '14px' }}>{error}</p>}
      <button
        type="button"
        style={{ ...btnStyle, background: '#888', marginTop: '4px' }}
        onClick={() => { setStep('phone'); setError(''); }}
      >
        Start over
      </button>
    </div>
  );
}
