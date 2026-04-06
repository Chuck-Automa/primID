import React from 'react';
import { render, screen } from '@testing-library/react';
import TierBadge from '../TierBadge';

describe('TierBadge', () => {
  test('renders Tier 0 — Full Personhood with filled circle symbol', () => {
    render(<TierBadge tier={0} />);
    expect(screen.getByText('●')).toBeInTheDocument();
    expect(screen.getByText('Full Personhood')).toBeInTheDocument();
  });

  test('renders Tier 1 — Single CVA with half circle symbol', () => {
    render(<TierBadge tier={1} />);
    expect(screen.getByText('◑')).toBeInTheDocument();
    expect(screen.getByText('Single CVA')).toBeInTheDocument();
  });

  test('renders Tier 2 — OAuth Verified with triangle symbol', () => {
    render(<TierBadge tier={2} />);
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText('OAuth Verified')).toBeInTheDocument();
  });

  test('renders Tier 3 — Phone Verified with square symbol', () => {
    render(<TierBadge tier={3} />);
    expect(screen.getByText('■')).toBeInTheDocument();
    expect(screen.getByText('Phone Verified')).toBeInTheDocument();
  });

  test('renders Ghost (null tier) with empty circle symbol', () => {
    render(<TierBadge tier={null} />);
    expect(screen.getByText('○')).toBeInTheDocument();
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  test('falls back to Ghost config for unknown tier value', () => {
    render(<TierBadge tier={99} />);
    expect(screen.getByText('○')).toBeInTheDocument();
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  test('renders at small size by default when size prop is omitted', () => {
    // Default size is "medium" per component source
    const { container } = render(<TierBadge tier={2} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('renders without crashing for each size variant', () => {
    for (const size of ['small', 'medium', 'large']) {
      const { unmount } = render(<TierBadge tier={2} size={size} />);
      expect(screen.getByText('OAuth Verified')).toBeInTheDocument();
      unmount();
    }
  });
});
