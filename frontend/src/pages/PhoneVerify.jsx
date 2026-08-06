import React from 'react';
import { useNavigate } from 'react-router-dom';
import OTPForm from '../components/OTPForm';

const containerStyle = {
  padding: '76px 24px 100px',
};

export default function PhoneVerify() {
  const navigate = useNavigate();

  return (
    <div style={containerStyle}>
      <button
        onClick={() => navigate('/profile')}
        style={{ background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', padding: 0, marginBottom: '28px' }}
      >
        ← Back
      </button>

      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '28px', color: '#e76f51', marginBottom: '8px' }}>■</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>
          Tier 3 — Phone Verified
        </h1>
        <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>
          Verify your phone number by texting a one-time code. Already verified? Sending a new
          code re-confirms your number.
        </p>
      </div>

      <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '16px', marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          What you get
        </p>
        <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '16px', lineHeight: 1.8, margin: 0 }}>
          <li>A recovery path if you lose access to your other sign-in method</li>
          <li>Progress toward Tier 2 once both base methods are complete</li>
        </ul>
      </div>

      <OTPForm onSuccess={() => navigate('/profile')} />
    </div>
  );
}
