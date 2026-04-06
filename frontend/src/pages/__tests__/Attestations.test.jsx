import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Attestations from '../Attestations';

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
    ...overrides,
  };
}

describe('Attestations page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      'primid_user',
      JSON.stringify({ id: CURRENT_USER_ID, tier: 2 })
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('renders heading and tab buttons', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { attestations: [] } });
    render(<Attestations />);
    await waitFor(() => expect(screen.getByText(/Attestations/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /received/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issued/i })).toBeInTheDocument();
  });

  test('shows "No attestations yet" when list is empty', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { attestations: [] } });
    render(<Attestations />);
    await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());
  });

  test('shows received attestation in "Received" tab', async () => {
    api.get = jest.fn().mockResolvedValue({
      data: { attestations: [makeAttestation()] },
    });
    render(<Attestations />);
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

    api.get = jest.fn().mockResolvedValue({
      data: { attestations: [receivedAttest, issuedAttest] },
    });

    render(<Attestations />);
    await waitFor(() => screen.getByText(/vouches_for/));

    fireEvent.click(screen.getByRole('button', { name: /issued/i }));

    await waitFor(() => expect(screen.getByText(/co_founder/)).toBeInTheDocument());
  });

  test('clicking "+ New" toggles the create form', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { attestations: [] } });
    render(<Attestations />);
    await waitFor(() => screen.getByText(/Attestations/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ new/i }));
    expect(screen.getByPlaceholderText(/username \/ handle/i)).toBeInTheDocument();
    expect(screen.getByText(/select platform/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/username \/ handle/i)).not.toBeInTheDocument();
  });

  test('create form submits platform+handle and refreshes list on success', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { attestations: [] } });
    api.post = jest.fn().mockResolvedValue({ data: { success: true } });

    render(<Attestations />);
    await waitFor(() => screen.getByText(/Attestations/i));

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
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('shows error message when create fails', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { attestations: [] } });
    api.post = jest.fn().mockRejectedValue({
      response: { data: { message: 'Cannot issue attestation to yourself.' } },
    });

    render(<Attestations />);
    await waitFor(() => screen.getByText(/Attestations/i));

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
