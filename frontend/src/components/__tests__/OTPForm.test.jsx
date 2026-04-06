import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OTPForm from '../OTPForm';

jest.mock('../../services/api');
import api from '../../services/api';

describe('OTPForm', () => {
  const onSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
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

    test('successful initiate moves to OTP entry step', async () => {
      api.post = jest.fn().mockResolvedValueOnce({ data: { success: true } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() =>
        expect(screen.getByPlaceholderText(/6-digit code/i)).toBeInTheDocument()
      );
    });

    test('builds correct E.164 number from country + local phone', async () => {
      api.post = jest.fn().mockResolvedValueOnce({ data: { success: true } });

      render(<OTPForm onSuccess={onSuccess} />);
      // Select UK (+44)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'GB' } });
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '07911123456' }, // local UK format with leading 0
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/api/verify/phone/initiate', {
          phoneNumber: '+447911123456', // leading 0 stripped, +44 prepended
        })
      );
    });

    test('shows devCode hint when backend returns one', async () => {
      api.post = jest.fn().mockResolvedValueOnce({ data: { success: true, devCode: '123456' } });

      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: '5555550123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => expect(screen.getByText('123456')).toBeInTheDocument());
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
      expect(screen.queryByPlaceholderText(/6-digit code/i)).not.toBeInTheDocument();
    });
  });

  describe('OTP confirmation step', () => {
    async function advanceToOTPStep(localNumber = '5555550123') {
      api.post = jest.fn().mockResolvedValueOnce({ data: { success: true, devCode: '654321' } });
      render(<OTPForm onSuccess={onSuccess} />);
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), {
        target: { value: localNumber },
      });
      fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));
      await waitFor(() => expect(screen.getByPlaceholderText(/6-digit code/i)).toBeInTheDocument());
    }

    test('shows full phone number (with country code) in confirmation message', async () => {
      await advanceToOTPStep('5555550123');
      // US is default (+1), so full number is +15555550123
      expect(screen.getByText(/\+15555550123/)).toBeInTheDocument();
    });

    test('confirm sends the E.164 number built at initiate time', async () => {
      await advanceToOTPStep('5555550123');

      const user = { id: 'uid-1', tier: 3 };
      api.post = jest.fn().mockResolvedValueOnce({ data: { token: 'jwt-token', user } });

      fireEvent.change(screen.getByPlaceholderText(/6-digit code/i), {
        target: { value: '654321' },
      });
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/api/verify/phone/confirm', {
          phoneNumber: '+15555550123',
          code: '654321',
        })
      );
      expect(onSuccess).toHaveBeenCalledWith(user);
    });

    test('shows error when OTP is invalid', async () => {
      await advanceToOTPStep();

      api.post = jest.fn().mockRejectedValueOnce({
        response: { data: { message: 'Invalid or expired OTP.' } },
      });

      fireEvent.change(screen.getByPlaceholderText(/6-digit code/i), {
        target: { value: '000000' },
      });
      fireEvent.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() =>
        expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument()
      );
    });

    test('"Change" button returns to phone entry step', async () => {
      await advanceToOTPStep();

      fireEvent.click(screen.getByRole('button', { name: /change/i }));

      expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/6-digit code/i)).not.toBeInTheDocument();
    });

    test('OTP input strips non-numeric characters', async () => {
      await advanceToOTPStep();

      const input = screen.getByPlaceholderText(/6-digit code/i);
      fireEvent.change(input, { target: { value: 'abc12def3' } });

      expect(input.value).toBe('123');
    });
  });
});
