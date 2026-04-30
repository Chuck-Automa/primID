import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeleteAccount from '../DeleteAccount';

const mockDeleteAccount = jest.fn();
const mockNavigate      = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ deleteAccount: mockDeleteAccount }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DeleteAccount />
    </MemoryRouter>
  );
}

describe('DeleteAccount page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders confirmation input and disabled submit button by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText('DELETE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /permanently delete account/i })).toBeDisabled();
  });

  test('enables submit button only when input value is exactly DELETE', () => {
    renderPage();
    const input  = screen.getByPlaceholderText('DELETE');
    const button = screen.getByRole('button', { name: /permanently delete account/i });

    fireEvent.change(input, { target: { value: 'delete' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(button).not.toBeDisabled();
  });

  test('calls deleteAccount then navigates to /login on submit', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: /permanently delete account/i }));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('shows error message if deleteAccount throws', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('Server error'));
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: /permanently delete account/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });
});
