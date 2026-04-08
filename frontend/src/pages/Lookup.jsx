import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLATFORMS } from '../data/platforms';

const containerStyle = { padding: '76px 24px 100px', maxWidth: '480px', margin: '0 auto' };

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  fontSize: '14px',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  outline: 'none',
  marginBottom: '10px',
  boxSizing: 'border-box',
  background: '#fff',
};

export default function Lookup() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState('github');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) { setError('Enter a handle.'); return; }
    setError('');
    navigate(`/lookup/${encodeURIComponent(platform)}/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Look up a primID</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '28px' }}>
        Enter a social handle to see its verified trust tier.
      </p>

      <form onSubmit={handleSubmit}>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          style={inputStyle}
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <input
          style={inputStyle}
          placeholder="Handle / username"
          value={handle}
          onChange={(e) => { setHandle(e.target.value); setError(''); }}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />

        {error && <p style={{ color: '#c0392b', fontSize: '13px', marginBottom: '10px' }}>{error}</p>}

        <button
          type="submit"
          style={{
            width: '100%', padding: '13px', fontSize: '15px', fontWeight: 600,
            background: '#1a1a2e', color: '#fff', border: 'none',
            borderRadius: '8px', cursor: 'pointer',
          }}
        >
          Look up
        </button>
      </form>
    </div>
  );
}
