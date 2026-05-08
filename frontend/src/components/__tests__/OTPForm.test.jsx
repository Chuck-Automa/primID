import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import OTPForm from '../OTPForm';

jest.mock('../../services/api');
import api from '../../services/api';

const mockLogin = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe('OTPForm', () => {
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('phone entry step', () => {
    test('renders country selector, phone input, and send button', () => {
      render(<OTPForm onSuccess={onSuccess} />);
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
    });

    test('country selector defaults to United States', () => {
      render(<OTPForm onSuccess={onSuccess} />);
      expect(screen.getByRole('combobox').value).toBe('US');
    });

    test('successful initiate moves to pending step showing the challenge code', async () => {
      api.post = jest.fn().mockResolvedValueOnce({
        data: { success: true, challengeId: 'chal-1', listenerNumber: 'STAGING', code: 'aB3xYz9Q' },
      });
      api.get = jest.fn().mockResolvedValue({ data: { verified: false } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => expect(screen.getByText('aB3xYz9Q')).toBeInTheDocument());
      expect(screen.getByText(/STAGING/)).toBeInTheDocument();
    });

    test('builds correct E.164 number from country + local phone', async () => {
      api.post = jest.fn().mockResolvedValueOnce({
        data: { success: true, challengeId: 'chal-1', listenerNumber: 'STAGING', code: 'aB3xYz9Q' },
      });
      api.get = jest.fn().mockResolvedValue({ data: { verified: false } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'GB' } });
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '07911123456' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/api/verify/phone/initiate', {
          phoneNumber: '+447911123456',
        })
      );
    });

    test('shows error message when initiate fails', async () => {
      api.post = jest.fn().mockRejectedValueOnce({
        response: { data: { message: 'Please enter a valid phone number.' } },
      });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '555' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() =>
        expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument()
      );
    });

    test('DEMO_RESTRICTED shows the server error message and stays on phone step', async () => {
      api.post = jest.fn().mockRejectedValueOnce({
        response: { data: { code: 'DEMO_RESTRICTED', message: 'This number is not approved for demo access.' } },
      });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() =>
        expect(screen.getByText(/not approved for demo access/i)).toBeInTheDocument()
      );
      // Still on phone step — no code display
      expect(screen.queryByText(/waiting for verification/i)).not.toBeInTheDocument();
    });
  });

  describe('pending step (polling)', () => {
    async function advanceToPending() {
      api.post = jest.fn().mockResolvedValueOnce({
        data: { success: true, challengeId: 'chal-99', listenerNumber: 'STAGING', code: 'Xy7mPq2R' },
      });
      api.get = jest.fn().mockResolvedValue({ data: { verified: false } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
      await waitFor(() => expect(screen.getByText('Xy7mPq2R')).toBeInTheDocument());
    }

    test('pending step shows code and listener number', async () => {
      await advanceToPending();
      expect(screen.getByText('Xy7mPq2R')).toBeInTheDocument();
      expect(screen.getByText(/STAGING/)).toBeInTheDocument();
      expect(screen.getByText(/waiting for verification/i)).toBeInTheDocument();
    });

    test('"Start over" returns to phone entry step', async () => {
      await advanceToPending();
      fireEvent.click(screen.getByRole('button', { name: /start over/i }));
      expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
      expect(screen.queryByText(/waiting for verification/i)).not.toBeInTheDocument();
    });

    test('polls status endpoint and calls onSuccess when verified: true', async () => {
      jest.useFakeTimers();

      api.post = jest.fn().mockResolvedValueOnce({
        data: { success: true, challengeId: 'chal-99', listenerNumber: 'STAGING', code: 'Xy7mPq2R' },
      });
      const user = { id: 'uid-1', currentTier: 3 };
      api.get = jest.fn()
        .mockResolvedValueOnce({ data: { verified: false } })
        .mockResolvedValueOnce({ data: { verified: true, accessToken: 'jwt-abc', user } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      // Wait for pending step
      await waitFor(() => expect(screen.getByText('Xy7mPq2R')).toBeInTheDocument());

      // Advance two poll intervals
      await act(async () => { jest.advanceTimersByTime(2000); });
      await act(async () => { jest.advanceTimersByTime(2000); });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('api/verify/phone/status/chal-99'.replace('api', '/api'));
        expect(onSuccess).toHaveBeenCalledWith(user);
      });

      jest.useRealTimers();
    });

    test('resets to phone step and shows error on 404 from status', async () => {
      jest.useFakeTimers();

      api.post = jest.fn().mockResolvedValueOnce({
        data: { success: true, challengeId: 'chal-99', listenerNumber: 'STAGING', code: 'Xy7mPq2R' },
      });
      api.get = jest.fn().mockRejectedValue({ response: { status: 404 } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => expect(screen.getByText('Xy7mPq2R')).toBeInTheDocument());

      await act(async () => { jest.advanceTimersByTime(2000); });

      await waitFor(() => {
        expect(screen.getByText(/verification expired/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });
});
