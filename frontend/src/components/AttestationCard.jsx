import React from 'react';
import { Link } from 'react-router-dom';
import { PLATFORMS } from '../data/platforms';

const cardStyle = {
  border: '1px solid #eee',
  borderRadius: '10px',
  padding: '16px',
  marginBottom: '12px',
  background: '#fff',
};

const badgeStyle = (revoked) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 600,
  background: revoked ? '#f8d7da' : '#d4edda',
  color: revoked ? '#721c24' : '#155724',
  marginBottom: '8px',
});

function SocialHandles({ user, label }) {
  const accounts = user?.socialAccounts || [];
  const name = user?.displayName;

  return (
    <div style={{ marginBottom: '6px' }}>
      <span style={{ fontSize: '12px', color: '#888', fontWeight: 600 }}>{label}: </span>
      {name && (
        <span style={{ fontSize: '12px', color: '#555', marginRight: '6px' }}>{name}</span>
      )}
      {accounts.length === 0 && !name && (
        <span style={{ fontSize: '12px', color: '#bbb' }}>No linked handles</span>
      )}
      {accounts.map((a) => {
        const platformLabel = PLATFORMS.find((p) => p.value === a.platform)?.label || a.platform;
        return (
          <Link
            key={`${a.platform}-${a.handle}`}
            to={`/lookup/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.handle)}`}
            style={{
              display: 'inline-block', fontSize: '12px', color: '#457b9d',
              textDecoration: 'none', marginRight: '8px',
            }}
          >
            {platformLabel} @{a.handle} ›
          </Link>
        );
      })}
    </div>
  );
}

export default function AttestationCard({ attestation, currentUserId, onConsent, onRevoke }) {
  const isRevoked = !!attestation.revokedAt;
  const isPublic = !!attestation.publicAt;
  const isSubject = attestation.subjectId === currentUserId;
  const needsConsent = isSubject && !attestation.consentGivenAt && !isRevoked;

  return (
    <div style={cardStyle}>
      <span style={badgeStyle(isRevoked)}>{isRevoked ? 'Revoked' : isPublic ? 'Active' : 'Pending Consent'}</span>
      <p style={{ fontSize: '14px', marginBottom: '8px' }}>
        <strong>Note:</strong> {attestation.attestationType}
      </p>
      <SocialHandles user={attestation.issuer} label="Issuer" />
      <SocialHandles user={attestation.subject} label="Subject" />
      <p style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
        Created: {new Date(attestation.createdAt).toLocaleDateString()}
      </p>

      <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
        {needsConsent && (
          <button
            onClick={() => onConsent(attestation.id)}
            style={{
              padding: '8px 14px', fontSize: '13px', fontWeight: 600,
              background: '#2d6a4f', color: '#fff', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
            }}
          >
            Grant Consent
          </button>
        )}
        {!isRevoked && (
          <button
            onClick={() => onRevoke(attestation.id)}
            style={{
              padding: '8px 14px', fontSize: '13px', fontWeight: 600,
              background: '#fff', color: '#c0392b', border: '1.5px solid #c0392b',
              borderRadius: '6px', cursor: 'pointer',
            }}
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
