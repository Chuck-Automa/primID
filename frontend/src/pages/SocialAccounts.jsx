import React, { useState, useEffect } from 'react';
import api from '../services/api';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', isPublic: false },
  { value: 'x', label: 'X (Twitter)', isPublic: false },
  { value: 'facebook', label: 'Facebook', isPublic: false },
  { value: 'telegram', label: 'Telegram', isPublic: false },
  { value: 'linkedin', label: 'LinkedIn', isPublic: false },
  { value: 'signal', label: 'Signal', isPublic: false },
  { value: 'github', label: 'GitHub', isPublic: true },
  { value: 'bluesky', label: 'Bluesky', isPublic: true },
  { value: 'farcaster', label: 'Farcaster', isPublic: true },
  { value: 'nostr', label: 'Nostr', isPublic: true },
  { value: 'bitchat', label: 'BitChat', isPublic: true },
];

const containerStyle = { padding: '76px 24px 100px' };

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  marginBottom: '10px',
};

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
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ platform: 'instagram', handle: '', isPublic: false });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAccounts = () => {
    setLoading(true);
    api.get('/api/social-accounts')
      .then((r) => setAccounts(r.data.accounts))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAccounts(); }, []);

  // Auto-set isPublic based on selected platform
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
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
        <form onSubmit={handleAdd} style={{ marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Add Social Account</h2>

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
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
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

      {loading ? (
        <p style={{ color: '#888', fontSize: '14px' }}>Loading…</p>
      ) : accounts.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          No social accounts linked yet.
        </p>
      ) : (
        accounts.map((a) => {
          const platformLabel = PLATFORMS.find((p) => p.value === a.platform)?.label || a.platform;
          return (
            <div key={a.id} style={accountRowStyle}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>{platformLabel}</p>
                <p style={{ fontSize: '13px', color: '#666' }}>{a.handle}</p>
                {a.isPublic && <p style={{ fontSize: '11px', color: '#2d6a4f', marginTop: '2px' }}>Verifiable</p>}
              </div>
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
          );
        })
      )}
    </div>
  );
}
