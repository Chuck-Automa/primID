import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../Profile';

jest.mock('../../services/api');
import api from '../../services/api';

const mockLogout = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ logout: mockLogout }),
}));

// useNavigate must be mocked since we're not in a real router context
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

function makeUser(overrides = {}) {
  return {
    id: 'uid-profile-test',
    phoneVerified: true,
    phoneVerifiedAt: '2024-01-01T00:00:00.000Z',
    oauthProvider: 'google',
    oauthVerifiedAt: '2024-02-01T00:00:00.000Z',
    biometricEverUsed: false,
    zkPassportVerified: false,
    zkEmailVerified: false,
    pohVerified: false,
    ecoinmterVerified: false,
    currentTier: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  );
}

// Profile calls api.get twice: /api/user/me and /api/social-accounts.
// This helper mocks both so socialAccounts state is never set to undefined.
function mockProfileGet(userOverrides = {}) {
  api.get = jest.fn().mockImplementation((url) => {
    if (url === '/api/social-accounts') {
      return Promise.resolve({ data: { accounts: [] } });
    }
    return Promise.resolve({ data: { user: makeUser(userOverrides) } });
  });
}

describe('Profile page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows loading state initially', () => {
    api.get = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    renderProfile();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('renders tier badge and tier name after load', async () => {
    mockProfileGet();
    renderProfile();
    await waitFor(() => expect(screen.getByText(/Your Identity/i)).toBeInTheDocument());
    expect(screen.getAllByText('▲').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/OAuth Verified/i).length).toBeGreaterThanOrEqual(1);
  });

  test('shows "Done" for completed tiers', async () => {
    mockProfileGet();
    renderProfile();
    await waitFor(() => screen.getByText(/Your Identity/i));
    // Tier 3 (Phone Verified) and Tier 2 (OAuth) are both done
    const doneMarkers = screen.getAllByText(/✓ Done/);
    expect(doneMarkers.length).toBeGreaterThanOrEqual(2);
  });

  test('shows user ID and member since date', async () => {
    mockProfileGet();
    renderProfile();
    await waitFor(() => screen.getByText(/Your Identity/i));
    expect(screen.getByText(/uid-profile-test/)).toBeInTheDocument();
    expect(screen.getByText(/Member since/)).toBeInTheDocument();
  });

  test('logout button calls logout and navigates to login', async () => {
    mockProfileGet();
    renderProfile();
    await waitFor(() => screen.getByText(/Log out/i));
    fireEvent.click(screen.getByText(/Log out/i));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('shows error state when API call fails', async () => {
    api.get = jest.fn().mockRejectedValue(new Error('Network error'));
    renderProfile();
    await waitFor(() => expect(screen.getByText(/Failed to load profile/i)).toBeInTheDocument());
  });

  test('shows upgrade prompts for Tier 3 user', async () => {
    mockProfileGet({ currentTier: 3, oauthVerifiedAt: null, oauthProvider: null });
    renderProfile();
    await waitFor(() => screen.getByText(/Your Identity/i));
    expect(screen.getByText(/Tier 2 — Connect Google or Apple/i)).toBeInTheDocument();
  });

  test('never renders raw phone number or oauthSub', async () => {
    mockProfileGet({ phoneNumber: '+15555551234', oauthSub: 'google|abc' });
    renderProfile();
    await waitFor(() => screen.getByText(/Your Identity/i));
    expect(screen.queryByText('+15555551234')).not.toBeInTheDocument();
    expect(screen.queryByText('google|abc')).not.toBeInTheDocument();
  });
});
