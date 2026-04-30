import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const pages = [
  { path: '/profile', label: 'Profile' },
  { path: '/attestations', label: 'Attestations' },
  { path: '/social', label: 'Social Accounts' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '480px',
        height: '36px',
        background: '#fff',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 200,
        boxSizing: 'border-box',
      }}>
        {/* display_name shown to the left of the hamburger; null = nothing rendered */}
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
          {user?.displayName || ''}
        </span>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'block', width: '18px', height: '2px', background: '#444', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: '#444', borderRadius: '1px' }} />
          <span style={{ display: 'block', width: '18px', height: '2px', background: '#444', borderRadius: '1px' }} />
        </button>
      </nav>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 201 }}
          />
          <div style={{
            position: 'fixed',
            top: '36px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '480px',
            background: '#fff',
            borderBottom: '1px solid #eee',
            zIndex: 202,
            boxSizing: 'border-box',
          }}>
            {pages.map((p) => (
              <button
                key={p.path}
                onClick={() => go(p.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  background: location.pathname === p.path ? '#f0f4f8' : 'none',
                  border: 'none',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: '14px',
                  color: location.pathname === p.path ? '#457b9d' : '#333',
                  fontWeight: location.pathname === p.path ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => go('/delete-account')}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 16px',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: '1px solid #f0f0f0',
                fontSize: '14px',
                color: '#c0392b',
                cursor: 'pointer',
              }}
            >
              Delete Account
            </button>
          </div>
        </>
      )}
    </>
  );
}
