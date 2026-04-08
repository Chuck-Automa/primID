import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import TierBadge from '../components/TierBadge';
import { PLATFORMS } from '../data/platforms';
import api from '../services/api';

const containerStyle = { padding: '76px 24px 100px' };

const TIER_NAMES = {
  0: 'Full Personhood',
  1: 'Single CVA',
  2: 'OAuth Verified',
  3: 'Phone Verified',
  null: 'Ghost',
};

export default function ProfileCard() {
  const { platform, handle } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label || platform;

  useEffect(() => {
    api.get(`/api/public/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`)
      .then((r) => setResult(r.data))
      .catch((err) => {
        if (err.response?.status === 409) {
          setResult(err.response.data);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [platform, handle]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div style={{ padding: '76px 24px' }}>Loading…</div>;

  if (notFound) {
    return (
      <div style={containerStyle}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#457b9d', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '24px' }}
        >
          ← Back
        </button>
        <p style={{ fontSize: '16px', fontWeight: 600 }}>Handle not found</p>
        <p style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
          No primID user has linked <strong>{platformLabel}</strong> handle <strong>"{handle}"</strong>.
        </p>
      </div>
    );
  }

  const { user, conflictFlagged } = result;

  return (
    <div style={containerStyle}>
      {/* Conflict warning */}
      {conflictFlagged && (
        <div style={{ padding: '12px 16px', background: '#fff3cd', borderRadius: '8px', borderLeft: '4px solid #e09f3e', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#856404' }}>
            Handle claimed by multiple users — tier shown may not be definitive
          </p>
        </div>
      )}

      {/* Platform + handle */}
      <p style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {platformLabel}
      </p>
      <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>{handle}</h1>

      {/* Display name */}
      {user.displayName && (
        <p style={{ fontSize: '16px', color: '#555', marginBottom: '20px' }}>{user.displayName}</p>
      )}

      {/* Tier badge */}
      <div style={{ marginBottom: '8px' }}>
        <TierBadge tier={user.currentTier} size="large" />
      </div>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: user.verifiedSince ? '4px' : '24px' }}>
        Tier {user.currentTier ?? 'Ghost'} — {TIER_NAMES[user.currentTier]}
      </p>
      {user.verifiedSince && (
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>
          Verified since {new Date(user.verifiedSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}

      {/* Copy link button */}
      <button
        onClick={handleCopy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '10px 18px', fontSize: '14px', fontWeight: 600,
          background: copied ? '#eafaf1' : '#f8f9fa',
          color: copied ? '#2d6a4f' : '#1a1a2e',
          border: `1px solid ${copied ? '#2d6a4f' : '#ddd'}`,
          borderRadius: '8px', cursor: 'pointer', marginBottom: '24px',
          transition: 'all 0.15s',
        }}
      >
        {copied ? '✓ Copied!' : '⬆ Copy link'}
      </button>

      {/* Link to full lookup */}
      <div>
        <Link
          to={`/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`}
          style={{ fontSize: '13px', color: '#457b9d' }}
        >
          View full verification history →
        </Link>
      </div>

      <p style={{ fontSize: '11px', color: '#ccc', marginTop: '40px' }}>
        Verified by primID
      </p>
    </div>
  );
}
