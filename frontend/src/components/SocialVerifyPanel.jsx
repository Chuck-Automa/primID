import React, { useState, useEffect } from 'react';
import api from '../services/api';

const POLL_INTERVAL_MS = 3000;

const panelStyle = {
  marginTop: '10px',
  padding: '14px',
  background: '#f0f4ff',
  borderRadius: '8px',
  fontSize: '13px',
};

const codeBoxStyle = {
  fontFamily: 'monospace',
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '4px',
  background: '#fff',
  borderRadius: '8px',
  padding: '12px',
  textAlign: 'center',
  marginBottom: '10px',
  userSelect: 'all',
};

const btnStyle = {
  width: '100%',
  padding: '10px',
  fontSize: '13px',
  fontWeight: 600,
  background: '#1a1a2e',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  marginBottom: '6px',
};

const linkBtnStyle = {
  ...btnStyle,
  display: 'block',
  textAlign: 'center',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

function crawlReasonMessage(reason, expectedHandle) {
  switch (reason) {
    case 'handle_mismatch':
      return `We found the code, but not on the account you registered. Make sure you're posting from @${expectedHandle}.`;
    case 'handle_not_found':
      return 'We could not find that account. Check the handle you registered.';
    case 'platform_rate_limited':
      return 'GitHub is rate-limiting verification right now. Please try again shortly.';
    case 'platform_error':
      return 'Verification is temporarily unavailable. Please try again shortly.';
    case 'code_not_found':
    default:
      return "We haven't found the code yet. Make sure it's posted publicly, then try again.";
  }
}

// Verify flow for a single Category A (Telegram) or Category B (GitHub)
// social_account. Renders below the account row once "Verify" is clicked.
export default function SocialVerifyPanel({ account, onVerified, onClose }) {
  const [phase, setPhase] = useState('starting'); // 'starting' | 'pending' | 'error'
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.post(`/api/social-accounts/${account.id}/verify/initiate`)
      .then((r) => {
        if (cancelled) return;
        setCode(r.data.code);
        setExpiresAt(r.data.expiresAt);
        setPhase('pending');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to start verification.');
        setPhase('error');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  // Telegram (Category A): poll the account list for verifiedAt, mirroring
  // OTPForm's phone-status poll pattern — there is no dedicated status
  // endpoint since verification arrives asynchronously via DM.
  useEffect(() => {
    if (account.platform !== 'telegram' || phase !== 'pending' || !expiresAt) return;

    const ttlMs = new Date(expiresAt).getTime() - Date.now();
    const startTime = Date.now();

    const interval = setInterval(async () => {
      if (Date.now() - startTime > ttlMs) {
        clearInterval(interval);
        setError('Verification code expired. Please try again.');
        setPhase('error');
        return;
      }
      try {
        const resp = await api.get('/api/social-accounts');
        const updated = resp.data.accounts.find((a) => a.id === account.id);
        if (updated?.verifiedAt) {
          clearInterval(interval);
          onVerified();
        }
      } catch {
        // transient — the TTL check above is what eventually stops polling
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [account.id, account.platform, phase, expiresAt, onVerified]);

  const handleCrawl = async () => {
    setCrawling(true);
    setCrawlMessage('');
    try {
      const resp = await api.post(`/api/verify/social/${account.id}/crawl`);
      if (resp.data.verified) {
        onVerified();
        return;
      }
      setAttemptsRemaining(resp.data.attemptsRemaining ?? null);
      setCrawlMessage(crawlReasonMessage(resp.data.reason, account.handle));
    } catch (err) {
      const data = err.response?.data;
      if (data?.attempts_exhausted) {
        setExhausted(true);
        setCrawlMessage('Too many attempts — request a new code.');
      } else if (data?.code === 'challenge_expired' || data?.code === 'no_active_challenge') {
        setError('Verification code expired. Please try again.');
        setPhase('error');
      } else {
        setCrawlMessage(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setCrawling(false);
    }
  };

  if (phase === 'starting') {
    return <div style={panelStyle}>Starting verification…</div>;
  }

  if (phase === 'error') {
    return (
      <div style={panelStyle}>
        <p style={{ color: '#c0392b', marginBottom: '8px' }}>{error}</p>
        <button style={{ ...btnStyle, background: '#888' }} onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <p style={{ marginBottom: '8px', color: '#666' }}>
        {account.platform === 'telegram'
          ? <>Send this code to <strong>@primidbot</strong> on Telegram:</>
          : <>Create a <strong>public</strong> gist whose description or filename contains this code:</>}
      </p>

      <div style={{ position: 'relative' }}>
        <p style={codeBoxStyle}>{code}</p>
        <button
          type="button"
          title="Copy code"
          onClick={() => {
            navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', color: copied ? '#2ecc71' : '#888',
          }}
        >
          {copied ? '✓' : '⎘'}
        </button>
      </div>

      {account.platform === 'telegram' ? (
        <>
          <a href="https://t.me/primidbot" target="_blank" rel="noreferrer" style={linkBtnStyle}>
            Open Telegram
          </a>
          <p style={{ color: '#666', marginTop: '6px' }}>Waiting for verification…</p>
        </>
      ) : (
        <>
          <a href="https://gist.github.com/" target="_blank" rel="noreferrer" style={linkBtnStyle}>
            Open GitHub Gist
          </a>
          {crawlMessage && (
            <p style={{ color: exhausted ? '#c0392b' : '#8a6d3b', margin: '8px 0' }}>
              {crawlMessage}
              {attemptsRemaining !== null && !exhausted && ` (${attemptsRemaining} attempts left)`}
            </p>
          )}
          <button
            type="button"
            style={{ ...btnStyle, opacity: crawling || exhausted ? 0.6 : 1 }}
            disabled={crawling || exhausted}
            onClick={handleCrawl}
          >
            {crawling ? 'Checking…' : "I've posted the code"}
          </button>
        </>
      )}

      <button
        type="button"
        style={{ ...btnStyle, background: 'none', color: '#888', border: '1px solid #ddd' }}
        onClick={onClose}
      >
        Cancel
      </button>
    </div>
  );
}
