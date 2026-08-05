import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PLATFORMS } from '../data/platforms';
import SocialVerifyPanel from '../components/SocialVerifyPanel';

// Platforms with a machine-verifiable path today (Category A Telegram DM listener,
// Category B GitHub crawl) — matches backend social.controller.js's
// VERIFIABLE_PLATFORMS. Everything else in PLATFORMS is Category C
// (self-reported only) or not yet built (Sprint 3+ crawlers).
const VERIFIABLE_PLATFORMS = ['telegram', 'github'];

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  marginBottom: '10px',
};

function formatVerifiedAt(isoString) {
  const d = new Date(isoString);
  const date = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} at ${time}`;
}

const accountRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  border: '1px solid #eee',
  borderRadius: '8px',
  marginBottom: '8px',
  background: '#fff',
};

export default function SocialAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ platform: 'instagram', handle: '', isPublic: false });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [currentTier, setCurrentTier] = useState(undefined);
  const [verifyingId, setVerifyingId] = useState(null);

  useEffect(() => {
    api.get('/api/user/me')
      .then((r) => setCurrentTier(r.data.user.currentTier ?? null))
      .catch(() => setCurrentTier(null));
  }, []);

  const canShare = currentTier !== null && currentTier !== undefined && currentTier <= 2;

  const fetchAccounts = () => {
    setLoading(true);
    api.get('/api/social-accounts')
      .then((r) => setAccounts(r.data.accounts))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handlePlatformChange = (e) => {
    const platform = e.target.value;
    const p = PLATFORMS.find((pl) => pl.value === platform);
    setForm({ ...form, platform, isPublic: p ? p.isPublic : false });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await api.post('/api/social-accounts', form);
      setForm({ platform: 'instagram', handle: '', isPublic: false });
      setShowAdd(false);
      fetchAccounts();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add account.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this social account?')) return;
    try {
      await api.patch(`/api/social-accounts/${id}/remove`);
      fetchAccounts();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  return (
    <div style={{
      height: 'calc(100vh - 36px)',
      marginTop: '36px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '16px',
      gap: '12px',
    }}>

      {/* Input card — header + add form */}
      <div style={{ flexShrink: 0, background: '#f8f9fa', borderRadius: '12px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Social Accounts</h1>
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{
              padding: '8px 14px', fontSize: '13px', fontWeight: 600,
              background: '#1a1a2e', color: '#fff', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
            }}
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} style={{ marginTop: '16px' }}>
            <select
              style={{ ...inputStyle, background: '#fff' }}
              value={form.platform}
              onChange={handlePlatformChange}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}{p.isPublic ? ' (verifiable)' : ''}</option>
              ))}
            </select>

            <input
              style={inputStyle}
              placeholder="Handle / username"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value.trim() })}
              required
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              />
              Public / verifiable account
            </label>

            {addError && <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '10px' }}>{addError}</p>}

            <button
              type="submit"
              disabled={adding}
              style={{
                width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
                background: '#1a1a2e', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: 'pointer',
              }}
            >
              {adding ? 'Adding…' : 'Add Account'}
            </button>
          </form>
        )}
      </div>

      {/* List card — independently scrollable */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '16px',
      }}>
        {loading ? (
          <p style={{ color: '#888', fontSize: '14px' }}>Loading…</p>
        ) : accounts.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', marginTop: '24px' }}>
            No social accounts linked yet.
          </p>
        ) : (
          accounts.map((a) => {
            const platformLabel = PLATFORMS.find((p) => p.value === a.platform)?.label || a.platform;
            const canVerify = VERIFIABLE_PLATFORMS.includes(a.platform);
            return (
              <div key={a.id} style={{ marginBottom: '8px' }}>
                <div style={{ ...accountRowStyle, marginBottom: 0 }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>{platformLabel}</p>
                    <p style={{ fontSize: '13px', color: '#666' }}>{a.handle}</p>
                    {canVerify && a.verifiedAt ? (
                      <p style={{ fontSize: '11px', color: '#2d6a4f', marginTop: '2px' }}>
                        ✓ Verified on {formatVerifiedAt(a.verifiedAt)}
                      </p>
                    ) : (
                      a.isPublic && <p style={{ fontSize: '11px', color: '#2d6a4f', marginTop: '2px' }}>Verifiable</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canVerify && (
                      <button
                        onClick={() => setVerifyingId(verifyingId === a.id ? null : a.id)}
                        style={{
                          background: 'none', border: '1px solid #ddd', color: '#1a1a2e',
                          fontSize: '12px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                        }}
                      >
                        {verifyingId === a.id ? 'Cancel' : a.verifiedAt ? 'Re-verify' : 'Verify'}
                      </button>
                    )}
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
                    <button
                      onClick={() => handleDelete(a.id)}
                      style={{
                        background: 'none', border: '1px solid #eee', color: '#c0392b',
                        fontSize: '12px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {verifyingId === a.id && (
                  <SocialVerifyPanel
                    account={a}
                    onVerified={() => { setVerifyingId(null); fetchAccounts(); }}
                    onClose={() => setVerifyingId(null)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
