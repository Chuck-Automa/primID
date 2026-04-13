import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialAccounts from '../SocialAccounts';

const renderSocialAccounts = () =>
  render(<MemoryRouter><SocialAccounts /></MemoryRouter>);

jest.mock('../../services/api');
import api from '../../services/api';

describe('SocialAccounts page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Must be reset after clearAllMocks to ensure it returns true
    window.confirm = jest.fn(() => true);
  });

  test('renders heading', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    renderSocialAccounts();
    await waitFor(() => expect(screen.getByText(/Social Accounts/i)).toBeInTheDocument());
  });

  test('shows "No social accounts linked yet." when list is empty', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    renderSocialAccounts();
    await waitFor(() =>
      expect(screen.getByText(/no social accounts linked yet/i)).toBeInTheDocument()
    );
  });

  test('renders existing accounts with platform label and handle', async () => {
    api.get = jest.fn().mockResolvedValue({
      data: {
        accounts: [
          { id: 'acc-1', platform: 'github', handle: 'chuck-dev', isPublic: true, removedAt: null },
        ],
      },
    });
    renderSocialAccounts();
    await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());
    expect(screen.getByText('chuck-dev')).toBeInTheDocument();
  });

  test('shows "Verifiable" label for public platforms', async () => {
    api.get = jest.fn().mockResolvedValue({
      data: {
        accounts: [{ id: 'acc-1', platform: 'farcaster', handle: 'chuck.eth', isPublic: true }],
      },
    });
    renderSocialAccounts();
    await waitFor(() => expect(screen.getByText(/Verifiable/i)).toBeInTheDocument());
  });

  test('clicking "+ Add" toggles the add form', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    renderSocialAccounts();
    await waitFor(() => screen.getByText(/Social Accounts/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));
    expect(screen.getByPlaceholderText(/handle/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/handle/i)).not.toBeInTheDocument();
  });

  test('add form submits with selected platform and handle', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    api.post = jest.fn().mockResolvedValue({ data: { success: true } });

    renderSocialAccounts();
    await waitFor(() => screen.getByText(/Social Accounts/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'github' } });
    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: 'chuck-dev' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/api/social-accounts',
        expect.objectContaining({ platform: 'github', handle: 'chuck-dev' })
      )
    );
  });

  test('platform change auto-sets isPublic for public platforms', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    renderSocialAccounts();
    await waitFor(() => screen.getByText(/Social Accounts/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));

    // Select GitHub (public platform)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'github' } });

    // The isPublic checkbox should now be checked
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  test('platform change auto-unsets isPublic for private platforms', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    renderSocialAccounts();
    await waitFor(() => screen.getByText(/Social Accounts/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));

    // Select Signal (private platform)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'signal' } });

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  test('shows error message when add fails', async () => {
    api.get = jest.fn().mockResolvedValue({ data: { accounts: [] } });
    api.post = jest.fn().mockRejectedValue({
      response: { data: { message: 'Invalid platform.' } },
    });

    renderSocialAccounts();
    await waitFor(() => screen.getByText(/Social Accounts/i));

    fireEvent.click(screen.getByRole('button', { name: /\+ add/i }));
    fireEvent.change(screen.getByPlaceholderText(/handle/i), {
      target: { value: 'handle123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add account/i }));

    await waitFor(() => expect(screen.getByText(/Invalid platform/i)).toBeInTheDocument());
  });

  test('Remove button calls patch remove API and refreshes', async () => {
    api.get = jest.fn().mockResolvedValue({
      data: {
        accounts: [{ id: 'acc-1', platform: 'github', handle: 'chuck', isPublic: true }],
      },
    });
    api.patch = jest.fn().mockResolvedValue({ data: { success: true } });

    renderSocialAccounts();
    await waitFor(() => screen.getByText('GitHub'));

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/social-accounts/acc-1/remove')
    );
    expect(api.get).toHaveBeenCalledTimes(3); // user/me + initial accounts load + after remove
  });
});
