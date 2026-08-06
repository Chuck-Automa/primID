import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { displayName: 'Chuck' } }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/profile' }),
}));

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

describe('Navbar', () => {
  beforeEach(() => jest.clearAllMocks());

  test('menu is closed by default', () => {
    renderNavbar();
    expect(screen.queryByText('Lookup Handle')).not.toBeInTheDocument();
  });

  test('opening the menu shows a Lookup Handle link', () => {
    renderNavbar();
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.getByText('Lookup Handle')).toBeInTheDocument();
  });

  test('clicking Lookup Handle navigates to /lookup and closes the menu', () => {
    renderNavbar();
    fireEvent.click(screen.getByLabelText('Menu'));
    fireEvent.click(screen.getByText('Lookup Handle'));

    expect(mockNavigate).toHaveBeenCalledWith('/lookup');
    expect(screen.queryByText('Lookup Handle')).not.toBeInTheDocument();
  });

  test('menu also includes Profile, Attestations, and Social Accounts links', () => {
    renderNavbar();
    fireEvent.click(screen.getByLabelText('Menu'));
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Attestations')).toBeInTheDocument();
    expect(screen.getByText('Social Accounts')).toBeInTheDocument();
  });
});
