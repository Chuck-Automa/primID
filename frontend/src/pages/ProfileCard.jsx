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

const PLATFORM_URLS = {
  instagram: 'https://instagram.com/{handle}',
  x:         'https://x.com/{handle}',
  facebook:  'https://facebook.com/{handle}',
  telegram:  'https://t.me/{handle}',
  linkedin:  'https://linkedin.com/in/{handle}',
  github:    'https://github.com/{handle}',
  bluesky:   'https://bsky.app/profile/{handle}',
  farcaster: 'https://warpcast.com/{handle}',
};

export default function ProfileCard() {
  const { platform, handle } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [githubProfile, setGithubProfile] = useState(null);
  const [attestationsOpen, setAttestationsOpen] = useState(false);
  const [attestations, setAttestations] = useState(null); // null = not yet fetched

  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label || platform;
  const profileUrlTemplate = PLATFORM_URLS[platform];
  const profileUrl = profileUrlTemplate ? profileUrlTemplate.replace('{handle}', encodeURIComponent(handle)) : null;

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

  // GitHub profile fetch — client-side, no caching
  useEffect(() => {
    if (platform !== 'github') return;
    fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.avatar_url) setGithubProfile(data);
      })
      .catch(() => {});
  }, [platform, handle]);

  const handleToggleAttestations = () => {
    if (!attestationsOpen && attestations === null) {
      api.get(`/api/public/attestations/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`)
        .then((r) => setAttestations(r.data.attestations))
        .catch(() => setAttestations([]));
    }
    setAttestationsOpen((o) => !o);
  };

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

      {/* Tier badge — hero element */}
      <div style={{ marginBottom: '8px' }}>
        <TierBadge tier={user.currentTier} size="large" />
      </div>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: user.verifiedSince ? '4px' : '20px' }}>
        Tier {user.currentTier ?? 'Ghost'} — {TIER_NAMES[user.currentTier]}
      </p>
      {user.verifiedSince && (
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
          Verified since {new Date(user.verifiedSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}

      {/* Display name */}
      {user.displayName && (
        <p style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginBottom: '24px' }}>{user.displayName}</p>
      )}

      {/* GitHub profile preview */}
      {platform === 'github' && githubProfile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#f8f9fa', borderRadius: '10px', marginBottom: '12px' }}>
          <img
            src={githubProfile.avatar_url}
            alt={handle}
            style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            {githubProfile.name && githubProfile.name !== handle && (
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#1a1a2e' }}>{githubProfile.name}</p>
            )}
            {githubProfile.bio && (
              <p style={{ fontSize: '13px', color: '#666', margin: githubProfile.name ? '2px 0 0' : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {githubProfile.bio.length > 120 ? githubProfile.bio.slice(0, 120) + '…' : githubProfile.bio}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Platform link card */}
      {profileUrl ? (
        <a
          href={profileUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: '#f8f9fa', borderRadius: '10px',
            border: '1px solid #eee', textDecoration: 'none', marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>{platformLabel}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>@{handle}</span>
          <span style={{ fontSize: '18px', color: '#457b9d' }}>›</span>
        </a>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: '#f8f9fa', borderRadius: '10px',
          border: '1px solid #eee', marginBottom: '24px',
        }}>
          <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>{platformLabel}</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>@{handle}</span>
        </div>
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
          borderRadius: '8px', cursor: 'pointer', marginBottom: '20px',
          transition: 'all 0.15s',
        }}
      >
        {copied ? '✓ Copied!' : '⬆ Copy link'}
      </button>

      {/* Expandable attestations section */}
      <div style={{ marginBottom: '24px', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={handleToggleAttestations}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', background: '#f8f9fa', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>Attestations</span>
          <span style={{ fontSize: '13px', color: '#888' }}>
            {attestationsOpen ? '▲' : '▼'}
          </span>
        </button>

        {attestationsOpen && (
          <div style={{ padding: '0 16px 16px' }}>
            {attestations === null ? (
              <p style={{ fontSize: '13px', color: '#aaa', paddingTop: '12px' }}>Loading…</p>
            ) : attestations.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#aaa', paddingTop: '12px' }}>No public attestations.</p>
            ) : (
              attestations.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <TierBadge tier={a.issuer.currentTier} size="small" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, margin: 0, color: '#1a1a2e' }}>{a.attestationType}</p>
                    {a.issuer.displayName && (
                      <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>by {a.issuer.displayName}</p>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>
                    {new Date(a.publicAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Link to full lookup */}
      <div style={{ marginBottom: '40px' }}>
        <Link
          to={`/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`}
          style={{ fontSize: '13px', color: '#457b9d' }}
        >
          View full verification history →
        </Link>
      </div>

      <p style={{ fontSize: '11px', color: '#ccc' }}>
        Verified by primID
      </p>
    </div>
  );
}
