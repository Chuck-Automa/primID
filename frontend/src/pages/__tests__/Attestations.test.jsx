import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Attestations from '../Attestations';

const renderAttestations = () =>
  render(<MemoryRouter><Attestations /></MemoryRouter>);

jest.mock('../../services/api');
import api from '../../services/api';

const CURRENT_USER_ID = 'current-user-uuid-001';
const ISSUER_ID = 'issuer-uuid-002';

function makeAttestation(overrides = {}) {
  return {
    id: 'attest-uuid-aaa',
    issuerId: ISSUER_ID,
    subjectId: CURRENT_USER_ID,
    attestationType: 'vouches_for',
    consentGivenAt: null,
    publicAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    issuer: { displayName: null, socialAccounts: [] },
    subject: { displayName: null, socialAccounts: [] },
    ...overrides,
  };
}

// Attestations calls api.get twice on mount: /api/user/me and /api/attestations.
// This helper returns correct data for each so the tier gate passes and userId is set.
function mockAttestGet(attestations = []) {
  api.get = jest.fn().mockImplementation((url) => {
    if (url === '/api/user/me') {
      return Promise.resolve({ data: { user: { id: CURRENT_USER_ID, currentTier: 2 } } });
    }
    return Promise.resolve({ data: { attestations } });
  });
}

describe('Attestations page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders heading and tab buttons', async () => {
    mockAttestGet();
    renderAttestations();
    await waitFor(() => expect(screen.getByRole('heading', { name: /^Attestations$/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /received/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issued/i })).toBeInTheDocument();
  });

  test('shows "No attestations yet" when list is empty', async () => {
    mockAttestGet();
    renderAttestations();
    await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());
  });

  test('shows received attestation in "Received" tab', async () => {
    mockAttestGet([makeAttestation()]);
    renderAttestations();
    await waitFor(() => expect(screen.getByText(/vouches_for/)).toBeInTheDocument());
  });

  test('switching to "Issued" tab shows issued attestations', async () => {
    const receivedAttest = makeAttestation({ subjectId: CURRENT_USER_ID, issuerId: ISSUER_ID });
    const issuedAttest = makeAttestation({
      id: 'issued-uuid',
      issuerId: CURRENT_USER_ID,
      subjectId: ISSUER_ID,
      attestationType: 'co_founder',
    });

    mockAttestGet([receivedAttest, issuedAttest]);

    renderAttestations();
    await waitFor(() => screen.getByText(/vouches_for/));

    fireEvent.click(screen.getByRole('button', { name: /issued/i }));

    await waitFor(() => expect(screen.getByText(/co_founder/)).toBeInTheDocument());
  });

  test('clicking "+ New" toggles the create form', async () => {
    mockAttestGet();
    renderAttestations();
    await waitFor(() => screen.getByRole('heading', { name: /^Attestations$/i }));

    fireEvent.click(screen.getByRole('button', { name: /\+ new/i }));
    expect(screen.getByPlaceholderText(/username \/ handle/i)).toBeInTheDocument();
    expect(screen.getByText(/select platform/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/username \/ handle/i)).not.toBeInTheDocument();
  });

  test('create form submits platform+handle and refreshes list on success', async () => {
    mockAttestGet();
    api.post = jest.fn().mockResolvedValue({ data: { success: true } });

    renderAttestations();
    await waitFor(() => screen.getByRole('heading', { name: /^Attestations$/i }));

    fireEvent.click(screen.getByRole('button', { name: /\+ new/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'github' } });
    fireEvent.change(screen.getByPlaceholderText(/username \/ handle/i), {
      target: { value: 'chuck-automa' },
    });
    fireEvent.change(screen.getByPlaceholderText(/note/i), {
      target: { value: 'vouches_for' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create attestation/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/attestations', {
      platform: 'github',
      handle: 'chuck-automa',
      attestationType: 'vouches_for',
    }));
    expect(api.get).toHaveBeenCalledTimes(3); // user/me + initial attestations load + after create
  });

  test('shows error message when create fails', async () => {
    mockAttestGet();
    api.post = jest.fn().mockRejectedValue({
      response: { data: { message: 'Cannot issue attestation to yourself.' } },
    });

    renderAttestations();
    await waitFor(() => screen.getByRole('heading', { name: /^Attestations$/i }));

    fireEvent.click(screen.getByRole('button', { name: /\+ new/i }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'github' } });
    fireEvent.change(screen.getByPlaceholderText(/username \/ handle/i), {
      target: { value: 'self-handle' },
    });
    fireEvent.change(screen.getByPlaceholderText(/note/i), {
      target: { value: 'vouches_for' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create attestation/i }));

    await waitFor(() =>
      expect(screen.getByText(/Cannot issue attestation to yourself/i)).toBeInTheDocument()
    );
  });
});
