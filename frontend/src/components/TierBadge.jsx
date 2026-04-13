import React from 'react';

const TIER_CONFIG = {
  0: { symbol: '●', label: 'Full Personhood', color: '#1a1a2e' },
  1: { symbol: '◑', label: 'Single CVA', color: '#2d6a4f' },
  2: { symbol: '▲', label: 'OAuth Verified', color: '#457b9d' },
  3: { symbol: '■', label: 'Phone Verified', color: '#e76f51' },
  null: { symbol: '○', label: 'Ghost', color: '#adb5bd' },
};

const REVOKED_COLOR = '#c0392b';

export default function TierBadge({ tier, size = 'medium', revoked = false }) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG[null];
  const color = revoked ? REVOKED_COLOR : config.color;

  const sizes = {
    small: { symbol: '20px', label: '10px', padding: '4px 8px' },
    medium: { symbol: '28px', label: '12px', padding: '8px 14px' },
    large: { symbol: '40px', label: '14px', padding: '12px 20px' },
  };

  const s = sizes[size] || sizes.medium;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: s.padding,
        border: `2px solid ${color}`,
        borderRadius: '8px',
        color,
      }}
    >
      <span style={{ fontSize: s.symbol, lineHeight: 1 }}>{config.symbol}</span>
      <span style={{ fontSize: s.label, fontWeight: 600 }}>{config.label}</span>
    </div>
  );
}
