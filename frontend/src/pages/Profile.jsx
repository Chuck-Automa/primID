import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TierBadge from '../components/TierBadge';
import api from '../services/api';
import { PLATFORMS } from '../data/platforms';
import { useAuth } from '../context/AuthContext';

const containerStyle = {
  padding: '76px 24px 100px',
};

const sectionStyle = {
  marginBottom: '28px',
  padding: '16px',
  background: '#f8f9fa',
  borderRadius: '10px',
};

const upgradeCardStyle = {
  padding: '16px',
  background: '#eaf4fb',
  borderRadius: '10px',
  marginBottom: '12px',
  borderLeft: '4px solid #457b9d',
};

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [socialAccounts, setSocialAccounts] = useState([]);

  useEffect(() => {
    api.get('/api/user/me')
      .then((r) => setUser(r.data.user))
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false));
    api.get('/api/social-accounts')
      .then((r) => setSocialAccounts(r.data.accounts))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const startEditName = () => {
    setNameInput(user.displayName || '');
    setNameError('');
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameError('');
  };

  const saveDisplayName = async () => {
    setNameSaving(true);
    setNameError('');
    try {
      const trimmed = nameInput.trim();
      if (trimmed.length > 50) {
        setNameError('Must be 50 characters or fewer.');
        setNameSaving(false);
        return;
      }
      const r = await api.patch('/api/user/me', { displayName: trimmed || null });
      setUser((u) => ({ ...u, displayName: r.data.user.displayName }));
      setEditingName(false);
    } catch {
      setNameError('Failed to save. Try again.');
    } finally {
      setNameSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '40px 24px' }}>Loading…</div>;
  if (error) return (
    <div style={{ padding: '76px 24px 40px' }}>
      <p style={{ color: '#c0392b', marginBottom: '20px', fontSize: '14px' }}>{error}</p>
      <button
        onClick={() => window.location.reload()}
        style={{ width: '100%', padding: '12px', marginBottom: '10px', fontSize: '14px', fontWeight: 600, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
      >
        Try again
      </button>
      <button
        onClick={handleLogout}
        style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600, background: 'none', color: '#888', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' }}
      >
        Log out
      </button>
    </div>
  );
  if (!user) return null;

  const tierNames = { 0: 'Full Personhood', 1: 'Single CVA', 2: 'OAuth Verified', 3: 'Phone Verified', null: 'Ghost' };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Your Identity</h1>
        <button
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#888', fontSize: '14px', cursor: 'pointer' }}
        >
          Log out
        </button>
      </div>

      {/* Display name — tap pencil to edit */}
      <div style={{ marginBottom: '24px' }}>
        {editingName ? (
          <div>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={50}
              placeholder="Your display name"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                fontSize: '16px', fontWeight: 500, border: '1px solid #457b9d',
                borderRadius: '8px', outline: 'none',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') cancelEditName(); }}
            />
            {nameError && <p style={{ fontSize: '12px', color: '#c0392b', marginTop: '4px' }}>{nameError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={saveDisplayName}
                disabled={nameSaving}
                style={{ flex: 1, padding: '9px', fontSize: '13px', fontWeight: 600, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={cancelEditName}
                style={{ flex: 1, padding: '9px', fontSize: '13px', fontWeight: 600, background: 'none', color: '#888', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 600, color: user.displayName ? '#1a1a2e' : '#bbb' }}>
              {user.displayName || 'Add a display name'}
            </span>
            <button
              onClick={startEditName}
              aria-label="Edit display name"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '15px', color: '#888', lineHeight: 1 }}
            >
              ✏
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '28px' }}>
        <TierBadge tier={user.currentTier} size="large" />
        <p style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
          Tier {user.currentTier ?? 'Ghost'} — {tierNames[user.currentTier]}
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Trust Tiers</h2>

        {[
          {
            tier: 3,
            symbol: '■',
            color: '#e76f51',
            name: 'Phone Verified',
            description: 'SMS one-time passcode',
            completed: user.phoneVerified,
            date: user.phoneVerifiedAt,
          },
          {
            tier: 2,
            symbol: '▲',
            color: '#457b9d',
            name: 'OAuth Verified',
            description: user.oauthProvider ? `${user.oauthProvider}` : 'Google or Apple',
            completed: !!user.oauthVerifiedAt,
            date: user.oauthVerifiedAt,
            link: '/verify/oauth',
          },
          {
            tier: 1,
            symbol: '◑',
            color: '#2d6a4f',
            name: 'Single CVA',
            description: 'One qualifying verification (QV)',
            completed: user.zkPassportVerified || user.zkEmailVerified || user.pohVerified || user.ecointerVerified,
            date: user.zkPassportVerifiedAt || user.zkEmailVerifiedAt || user.pohVerifiedAt || user.ecointerVerifiedAt,
          },
          {
            tier: 0,
            symbol: '●',
            color: '#1a1a2e',
            name: 'Full Personhood',
            description: 'Two qualifying verifications (QVs)',
            completed: user.currentTier === 0,
            date: null,
          },
        ].map(({ tier, symbol, color, name, description, completed, date, link }) => (
          <div
            key={tier}
            onClick={() => !completed && link && navigate(link)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom: '1px solid #eee',
              cursor: !completed && link ? 'pointer' : 'default',
            }}
          >
            <span style={{ fontSize: '20px', color: completed ? color : '#ccc', width: '20px', textAlign: 'center' }}>
              {symbol}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: completed ? '#222' : '#aaa', margin: 0 }}>
                Tier {tier} — {name}
              </p>
              <p style={{ fontSize: '11px', color: '#aaa', margin: '2px 0 0' }}>{description}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {completed ? (
                <>
                  <span style={{ fontSize: '12px', color: '#2d6a4f', fontWeight: 600 }}>✓ Done</span>
                  {date && (
                    <p style={{ fontSize: '10px', color: '#aaa', margin: '2px 0 0' }}>
                      {new Date(date).toLocaleDateString()}
                    </p>
                  )}
                </>
              ) : (
                <span style={{ fontSize: '13px', color: link ? '#457b9d' : '#ccc' }}>
                  {link ? '›' : 'Not yet'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade prompts — informational only in Sprint 1 */}
      {(user.currentTier === null || user.currentTier >= 2) && (
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Unlock higher trust</h2>

          {(user.currentTier === null || user.currentTier === 3) && (
            <div style={upgradeCardStyle}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Tier 2 — Connect Google or Apple</p>
              <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                Sign in with Google or Apple to reach Tier 2 and extend your session to 90 days.
              </p>
            </div>
          )}

          {user.currentTier >= 2 && (
            <div style={upgradeCardStyle}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Tier 1 — Add a qualifying verification</p>
              <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                Complete one qualifying verification (QV) to reach Tier 1. (Available in Sprint 2)
              </p>
            </div>
          )}

          {(user.currentTier === 1) && (
            <div style={upgradeCardStyle}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Tier 0 — Add a second qualifying verification</p>
              <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                Two qualifying verifications (QVs) earn Full Personhood. (Available in Sprint 2)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Social handles */}
      <div style={{ ...sectionStyle, marginTop: '8px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>Social Handles</h2>
        {socialAccounts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#aaa' }}>
            No social accounts linked —{' '}
            <span
              onClick={() => navigate('/social')}
              style={{ color: '#457b9d', cursor: 'pointer' }}
            >
              add them on the Social Accounts page
            </span>
          </p>
        ) : (
          socialAccounts.map((a) => {
            const platformLabel = PLATFORMS.find((p) => p.value === a.platform)?.label || a.platform;
            const canShare = user.currentTier !== null && user.currentTier <= 2;
            return (
              <div
                key={a.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}
              >
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>{platformLabel}</p>
                  <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>{a.handle}</p>
                </div>
                {canShare && (
                  <button
                    onClick={() => navigate(`/id/${encodeURIComponent(a.platform)}/${encodeURIComponent(a.handle)}`)}
                    style={{
                      background: 'none', border: '1px solid #ddd', color: '#457b9d',
                      fontSize: '12px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                    }}
                  >
                    ⬆ Share
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: '24px' }}>
        <p style={{ fontSize: '11px', color: '#bbb' }}>User ID: {user.id}</p>
        <p style={{ fontSize: '11px', color: '#bbb' }}>Member since: {new Date(user.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
