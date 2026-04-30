import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const handleDelete = async () => {
    setSubmitting(true);
    setError('');
    try {
      await deleteAccount();
      navigate('/login');
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '76px 24px 100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1d1d1f', marginBottom: '8px' }}>
        Delete Your Account
      </h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>
        This is permanent and cannot be undone.
      </p>

      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>
          What will be erased:
        </p>
        <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8', margin: 0 }}>
          <li>Display name and profile</li>
          <li>Phone and OAuth verification links</li>
          <li>All linked social accounts</li>
        </ul>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>
          What remains (anonymized):
        </p>
        <ul style={{ fontSize: '13px', color: '#555', paddingLeft: '20px', lineHeight: '1.8', margin: 0 }}>
          <li>Attestation records become anonymous — not linked to you</li>
        </ul>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
          To confirm, type DELETE:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>{error}</p>
      )}

      <button
        onClick={handleDelete}
        disabled={confirmText !== 'DELETE' || submitting}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px',
          fontSize: '15px',
          fontWeight: 600,
          color: '#fff',
          background: confirmText === 'DELETE' && !submitting ? '#c0392b' : '#e0a0a0',
          border: 'none',
          borderRadius: '10px',
          cursor: confirmText === 'DELETE' && !submitting ? 'pointer' : 'not-allowed',
          marginBottom: '12px',
        }}
      >
        {submitting ? 'Deleting…' : 'Permanently Delete Account'}
      </button>

      <button
        onClick={() => navigate('/profile')}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px',
          fontSize: '15px',
          fontWeight: 500,
          color: '#457b9d',
          background: 'none',
          border: '1px solid #457b9d',
          borderRadius: '10px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  );
}
