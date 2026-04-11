import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TierBadge from '../components/TierBadge';
import { PLATFORMS } from '../data/platforms';
import api from '../services/api';

const containerStyle = { padding: '76px 24px 100px' };

const EVENT_LABELS = {
  phone_verified:       'Phone OTP verified',
  oauth_verified:       'OAuth verified (Google / Apple)',
  zk_passport_verified: 'zkPassport proof verified',
  zk_email_verified:    'zkEmail proof verified',
  poh_verified:         'Proof of Humanity verified',
  ecoinmter_verified:   'Ecoinmter in-person verified',
};

const TIER_NAMES = {
  0: 'Full Personhood',
  1: 'Single CVA',
  2: 'OAuth Verified',
  3: 'Phone Verified',
  null: 'Ghost',
};

function Collapsible({ label, count, onOpen, children }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    if (!open && onOpen) onOpen();
    setOpen((o) => !o);
  };
  return (
    <div style={{ marginTop: '4px' }}>
      <button
        onClick={toggle}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: '13px', color: '#457b9d', display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        <span style={{ fontSize: '10px' }}>{open ? '▼' : '▶'}</span>
        {label} {count !== undefined && <span style={{ color: '#aaa' }}>({count})</span>}
      </button>
      {open && <div style={{ marginTop: '8px', paddingLeft: '14px' }}>{children}</div>}
    </div>
  );
}

export default function LookupResult() {
  const { platform, handle } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [attestations, setAttestations] = useState(null); // null = not yet fetched
  const [attestationsLoading, setAttestationsLoading] = useState(false);

  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label || platform;

  useEffect(() => {
    api.get(`/api/public/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`)
      .then((r) => setResult(r.data))
      .catch((err) => {
        if (err.response?.status === 409) {
          // Conflict — still render the data
          setResult(err.response.data);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [platform, handle]);

  if (loading) return <div style={{ padding: '76px 24px' }}>Looking up…</div>;

  if (notFound) {
    return (
      <div style={containerStyle}>
        <button
          onClick={() => navigate('/lookup')}
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
  const history = user.verificationHistory || [];
  const conflicts = user.conflicts || [];

  return (
    <div style={containerStyle}>
      <button
        onClick={() => navigate('/lookup')}
        style={{ background: 'none', border: 'none', color: '#457b9d', fontSize: '14px', cursor: 'pointer', padding: 0, marginBottom: '24px' }}
      >
        ← Back
      </button>

      {/* Handle header */}
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>
        {platformLabel}
      </p>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>
        {handle}
      </h1>

      {/* Conflict warning */}
      {conflictFlagged && (
        <div style={{ padding: '12px 16px', background: '#fff3cd', borderRadius: '8px', borderLeft: '4px solid #e09f3e', marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#856404' }}>Handle conflict</p>
          <p style={{ fontSize: '13px', color: '#856404', marginTop: '4px' }}>
            This handle is claimed by multiple users. The tier shown may not be definitive until the conflict is resolved.
          </p>
          {conflicts.length > 0 && (
            <Collapsible label="Conflict history" count={conflicts.length}>
              {conflicts.map((c, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                  <span>Detected: {new Date(c.detectedAt).toLocaleDateString()}</span>
                  {c.resolvedAt
                    ? <span style={{ marginLeft: '8px', color: '#2d6a4f' }}>· Resolved: {new Date(c.resolvedAt).toLocaleDateString()}</span>
                    : <span style={{ marginLeft: '8px', color: '#c0392b' }}>· Unresolved</span>
                  }
                </div>
              ))}
            </Collapsible>
          )}
        </div>
      )}

      {/* Tier badge */}
      <div style={{ marginBottom: '20px' }}>
        <TierBadge tier={user.currentTier} size="large" />
        {user.verifiedSince && (
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
            Verified since {new Date(user.verifiedSince).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
        {history.length > 0 && (
          <Collapsible label="Verification history" count={history.length}>
            {history.map((h, i) => (
              <div key={i} style={{ fontSize: '12px', color: '#555', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{EVENT_LABELS[h.event] || h.event}</span>
                <span style={{ color: '#888', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                  → Tier {h.tier} ({TIER_NAMES[h.tier]}) · {new Date(h.at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </Collapsible>
        )}
      </div>

      {/* Display name */}
      {user.displayName && (
        <div style={{ padding: '14px 16px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Display name</p>
          <p style={{ fontSize: '15px', fontWeight: 600 }}>{user.displayName}</p>
        </div>
      )}

      {/* Attestations */}
      <div style={{ marginTop: '8px' }}>
        <Collapsible
          label="Attestations"
          onOpen={() => {
            if (attestations === null && !attestationsLoading) {
              setAttestationsLoading(true);
              api.get(`/api/public/attestations/${encodeURIComponent(platform)}/${encodeURIComponent(handle)}`)
                .then((r) => setAttestations(r.data.attestations))
                .catch(() => setAttestations([]))
                .finally(() => setAttestationsLoading(false));
            }
          }}
        >
          {attestationsLoading ? (
            <p style={{ fontSize: '12px', color: '#aaa' }}>Loading…</p>
          ) : attestations === null || attestations.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#aaa' }}>No public attestations.</p>
          ) : (
            attestations.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <TierBadge tier={a.issuer.currentTier} size="small" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, margin: 0, color: '#1a1a2e' }}>{a.attestationType}</p>
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
        </Collapsible>
      </div>

      <p style={{ fontSize: '11px', color: '#bbb', marginTop: '32px' }}>
        Verified by primID · tier data is read-only and sourced directly from the primID identity registry
      </p>
    </div>
  );
}
