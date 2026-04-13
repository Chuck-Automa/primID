import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AttestationCard from '../AttestationCard';

const ISSUER_ID = 'issuer-uuid-001';
const SUBJECT_ID = 'subject-uuid-002';

function makeAttestation(overrides = {}) {
  return {
    id: 'attest-uuid-aaa',
    issuerId: ISSUER_ID,
    subjectId: SUBJECT_ID,
    attestationType: 'vouches_for',
    consentGivenAt: null,
    publicAt: null,
    revokedAt: null,
    createdAt: new Date('2024-03-01').toISOString(),
    // issuer/subject objects are included by the API (listAttestations includes them)
    issuer: { displayName: 'Alice Issuer', socialAccounts: [] },
    subject: { displayName: 'Bob Subject', socialAccounts: [] },
    ...overrides,
  };
}

describe('AttestationCard', () => {
  const onConsent = jest.fn();
  const onRevoke = jest.fn();

  describe('status badge', () => {
    test('shows "Pending Consent" when not consented and not revoked', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText('Pending Consent')).toBeInTheDocument();
    });

    test('shows "Active" when consent given and not revoked', () => {
      render(
        <AttestationCard
          attestation={makeAttestation({ consentGivenAt: new Date().toISOString(), publicAt: new Date().toISOString() })}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    test('shows "Revoked" when revokedAt is set', () => {
      render(
        <AttestationCard
          attestation={makeAttestation({ revokedAt: new Date().toISOString() })}
          currentUserId={ISSUER_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText('Revoked')).toBeInTheDocument();
    });
  });

  describe('attestation details', () => {
    test('renders attestation type', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText(/vouches_for/)).toBeInTheDocument();
    });

    test('renders issuer display name', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText(/Alice Issuer/)).toBeInTheDocument();
    });

    test('renders subject display name', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByText(/Bob Subject/)).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    test('subject sees "Grant Consent" button when consent pending', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByRole('button', { name: /grant consent/i })).toBeInTheDocument();
    });

    test('issuer does NOT see "Grant Consent" button', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={ISSUER_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.queryByRole('button', { name: /grant consent/i })).not.toBeInTheDocument();
    });

    test('"Grant Consent" button is absent after consent is already given', () => {
      render(
        <AttestationCard
          attestation={makeAttestation({ consentGivenAt: new Date().toISOString() })}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.queryByRole('button', { name: /grant consent/i })).not.toBeInTheDocument();
    });

    test('"Revoke" button is present when attestation is active', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={ISSUER_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
    });

    test('"Revoke" button is absent for already-revoked attestation', () => {
      render(
        <AttestationCard
          attestation={makeAttestation({ revokedAt: new Date().toISOString() })}
          currentUserId={ISSUER_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument();
    });

    test('clicking "Grant Consent" calls onConsent with attestation id', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={SUBJECT_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /grant consent/i }));
      expect(onConsent).toHaveBeenCalledWith('attest-uuid-aaa');
    });

    test('clicking "Revoke" calls onRevoke with attestation id', () => {
      render(
        <AttestationCard
          attestation={makeAttestation()}
          currentUserId={ISSUER_ID}
          onConsent={onConsent}
          onRevoke={onRevoke}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
      expect(onRevoke).toHaveBeenCalledWith('attest-uuid-aaa');
    });
  });
});
