import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLATFORMS } from '../data/platforms';
import api from '../services/api';

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
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Debounced suggestions fetch
  useEffect(() => {
    const trimmed = handle.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await api.get(`/api/public/suggestions/${platform}?q=${encodeURIComponent(trimmed)}`);
        setSuggestions(r.data.suggestions);
        setShowSuggestions(r.data.suggestions.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [handle, platform]);

  // Click-outside to dismiss
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePlatformChange = (e) => {
    setPlatform(e.target.value);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSelect = (suggestion) => {
    setHandle(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) { setError('Enter a handle.'); return; }
    setError('');
    setShowSuggestions(false);
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
          onChange={handlePlatformChange}
          style={inputStyle}
        >
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Handle input with suggestions dropdown */}
        <div ref={wrapperRef} style={{ position: 'relative', marginBottom: '10px' }}>
          <input
            style={{ ...inputStyle, marginBottom: 0, borderRadius: showSuggestions ? '8px 8px 0 0' : '8px' }}
            placeholder="Handle / username"
            value={handle}
            onChange={(e) => { setHandle(e.target.value); setError(''); }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowSuggestions(false); }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {showSuggestions && (
            <ul style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              margin: 0,
              padding: 0,
              listStyle: 'none',
              background: '#fff',
              border: '1.5px solid #457b9d',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              zIndex: 10,
            }}>
              {suggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                  style={{
                    padding: '11px 14px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    color: '#1a1a2e',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f6ff'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

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
