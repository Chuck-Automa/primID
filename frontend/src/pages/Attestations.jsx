import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AttestationCard from '../components/AttestationCard';
import api from '../services/api';

const containerStyle = { padding: '76px 24px 100px' };
const tabStyle = (active) => ({
  flex: 1,
  padding: '10px',
  textAlign: 'center',
  background: active ? '#1a1a2e' : '#f8f9fa',
  color: active ? '#fff' : '#666',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: active ? 600 : 400,
});

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  marginBottom: '10px',
};

export default function Attestations() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('received');
  const [attestations, setAttestations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ platform: '', handle: '', attestationType: '' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentTier, setCurrentTier] = useState(undefined); // undefined = not yet loaded

  const fetchAttestations = () => {
    api.get('/api/attestations')
      .then((r) => setAttestations(r.data.attestations))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/api/user/me')
      .then((r) => {
        setCurrentUserId(r.data.user.id);
        setCurrentTier(r.data.user.currentTier ?? null);
      })
      .catch(() => setCurrentTier(null));
    fetchAttestations();
  }, []);

  const received = attestations.filter((a) => a.subjectId === currentUserId);
  const issued = attestations.filter((a) => a.issuerId === currentUserId);
  const displayed = tab === 'received' ? received : issued;

  const handleConsent = async (id) => {
    try {
      await api.patch(`/api/attestations/${id}/consent`);
      fetchAttestations();
    } catch (err) {
      alert(err.response?.data?.message || 'Consent failed.');
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this attestation? This cannot be undone.')) return;
    try {
      await api.post(`/api/attestations/${id}/revoke`);
      fetchAttestations();
    } catch (err) {
      alert(err.response?.data?.message || 'Revoke failed.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.post('/api/attestations', form);
      setForm({ platform: '', handle: '', attestationType: '' });
      setShowCreate(false);
      fetchAttestations();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create attestation.');
    } finally {
      setCreating(false);
    }
  };

  if (currentTier === undefined) return <div style={{ padding: '76px 24px' }}>Loading…</div>;

  if (currentTier === null || currentTier >= 3) {
    return (
      <div style={containerStyle}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>Attestations</h1>
        <div style={{ padding: '20px', background: '#eaf4fb', borderRadius: '10px', borderLeft: '4px solid #457b9d' }}>
          <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Verify with Google or Apple to unlock attestations</p>
          <p style={{ fontSize: '13px', color: '#555', marginBottom: '16px' }}>
            Attestations require Tier 2. Connect Google or Apple to extend your session to 90 days and enable this feature.
          </p>
          <button
            onClick={() => navigate('/verify/oauth')}
            style={{
              width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
              background: '#1a1a2e', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            Connect Google or Apple
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Attestations</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: '8px 14px', fontSize: '13px', fontWeight: 600,
            background: '#1a1a2e', color: '#fff', border: 'none',
            borderRadius: '6px', cursor: 'pointer',
          }}
        >
          {showCreate ? 'Cancel' : '+ New'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={{ marginBottom: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>New Attestation</h2>
          <select
            style={{ ...inputStyle, color: form.platform ? '#000' : '#999', background: '#fff' }}
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            required
          >
            <option value="" disabled>Select platform</option>
            <optgroup label="Centralized">
              <option value="instagram">Instagram</option>
              <option value="x">X (Twitter)</option>
              <option value="facebook">Facebook</option>
              <option value="telegram">Telegram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="signal">Signal</option>
            </optgroup>
            <optgroup label="Public / verifiable">
              <option value="github">GitHub</option>
              <option value="bluesky">Bluesky</option>
              <option value="farcaster">Farcaster</option>
              <option value="nostr">Nostr</option>
              <option value="bitchat">BitChat</option>
            </optgroup>
          </select>
          <input
            style={inputStyle}
            placeholder="Username / handle"
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value.trim() })}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
          <input
            style={inputStyle}
            placeholder="Note (max 50 characters)"
            maxLength={50}
            value={form.attestationType}
            onChange={(e) => setForm({ ...form, attestationType: e.target.value })}
            required
          />
          {createError && <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '10px' }}>{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            style={{
              width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
              background: '#1a1a2e', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            {creating ? 'Creating…' : 'Create Attestation'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #eee' }}>
        <button style={tabStyle(tab === 'received')} onClick={() => setTab('received')}>
          Received ({received.length})
        </button>
        <button style={tabStyle(tab === 'issued')} onClick={() => setTab('issued')}>
          Issued ({issued.length})
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#888', fontSize: '14px' }}>Loading…</p>
      ) : displayed.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
          No attestations yet.
        </p>
      ) : (
        displayed.map((a) => (
          <AttestationCard
            key={a.id}
            attestation={a}
            currentUserId={currentUserId}
            onConsent={handleConsent}
            onRevoke={handleRevoke}
          />
        ))
      )}
    </div>
  );
}
