import React from 'react';
import { useNavigate } from 'react-router-dom';

const containerStyle = { padding: '76px 24px 100px' };

const sectionStyle = {
  marginBottom: '24px',
  padding: '16px',
  background: '#f8f9fa',
  borderRadius: '10px',
};

const protocolCardStyle = {
  display: 'flex',
  gap: '14px',
  padding: '14px 0',
  borderBottom: '1px solid #eee',
};

const comingSoonBadgeStyle = {
  display: 'inline-block',
  fontSize: '10px',
  fontWeight: 700,
  color: '#888',
  background: '#eee',
  borderRadius: '999px',
  padding: '3px 9px',
  marginTop: '4px',
};

const PROTOCOLS = [
  {
    symbol: '🛂',
    name: 'zkPassport',
    description: 'Proves you hold a valid passport using a zero-knowledge proof over the chip data — the chip contents are never revealed or transmitted.',
  },
  {
    symbol: '✉️',
    name: 'zkEmail',
    description: 'Proves control of an email account (Gmail or Outlook) using a zero-knowledge proof over message headers — the email body content is never read or stored.',
  },
  {
    symbol: '🧑',
    name: 'Proof of Humanity',
    description: 'A supplemental humanity signal checked via isHuman() against your connected wallet.',
  },
  {
    symbol: '🤝',
    name: 'Encointer',
    description: 'In-person human verification at a local meetup — the highest-assurance protocol in the pool.',
  },
];

export default function QVLanding() {
  const navigate = useNavigate();

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Qualifying Verifications</h1>
      <p style={{ fontSize: '14px', color: '#555', marginBottom: '24px' }}>
        A Qualifying Verification (QV) is a cryptographic proof of personhood that doesn't rely on a phone
        number or an OAuth account. QVs are what unlock the top two primID trust tiers.
      </p>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>How QVs affect your tier</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #eee' }}>
          <span style={{ fontSize: '18px', color: '#2d6a4f', width: '20px', textAlign: 'center' }}>◑</span>
          <p style={{ fontSize: '13px', margin: 0 }}>
            <strong>1 QV</strong> from the pool below → <strong>Tier 1</strong>, Single CVA
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
          <span style={{ fontSize: '18px', color: '#1a1a2e', width: '20px', textAlign: 'center' }}>●</span>
          <p style={{ fontSize: '13px', margin: 0 }}>
            <strong>2 QVs</strong> from the pool below → <strong>Tier 0</strong>, Full Personhood
          </p>
        </div>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
          Any two protocols qualify — no single one is required. QVs outrank phone and OAuth verification:
          completing even one moves you to Tier 1 or Tier 0 regardless of your phone/OAuth status.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>The QV pool</h2>
        {PROTOCOLS.map((p) => (
          <div key={p.name} style={protocolCardStyle}>
            <span style={{ fontSize: '22px', lineHeight: 1 }}>{p.symbol}</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{p.name}</p>
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>{p.description}</p>
              <span style={comingSoonBadgeStyle}>Coming soon</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>
        QV verification is not yet available — none of these flows are live yet. This page will link directly
        to each one as they ship.
      </p>

      <button
        onClick={() => navigate('/profile')}
        style={{
          width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
          background: 'none', color: '#888', border: '1px solid #ddd',
          borderRadius: '8px', cursor: 'pointer',
        }}
      >
        Back to profile
      </button>
    </div>
  );
}
