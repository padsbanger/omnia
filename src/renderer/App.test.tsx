// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appState: {} as Record<string, unknown>,
  authState: {} as Record<string, unknown>,
  sessionState: {} as Record<string, unknown>,
}));

vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: vi.fn() }),
}));
vi.mock('@heroui/react', () => ({ Spinner: () => <span>spinner</span> }));
vi.mock('./hooks/useSessionVerification', () => ({
  useSessionVerification: () => mocks.sessionState,
}));
vi.mock('./store', () => ({
  useAppStore: (selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector(mocks.appState) : mocks.appState,
  useAuthStore: () => mocks.authState,
}));
vi.mock('./components/AuthScreen', () => ({
  __esModule: true,
  default: ({ hasCachedRoutes }: { hasCachedRoutes: boolean }) => (
    <div>auth-screen:{String(hasCachedRoutes)}</div>
  ),
}));

import { AuthGate } from './App';

describe('AuthGate', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.appState = {
      routes: [],
      isOffline: false,
      setActiveTab: vi.fn(),
      setOfflineMode: vi.fn(),
      updateRoutesOrder: vi.fn(),
    };
    mocks.authState = {
      clearSession: vi.fn(),
      hasHydrated: true,
      refreshToken: null,
      setSession: vi.fn(),
      setTokens: vi.fn(),
      token: null,
      user: null,
    };
    mocks.sessionState = {
      hasCompletedInitialVerification: true,
      isVerifying: false,
      verifiedToken: null,
    };
  });

  it('shows a blocking loader while storage hydration is incomplete', () => {
    mocks.authState = { ...mocks.authState, hasHydrated: false };

    render(<AuthGate />);

    expect(screen.getByText('spinner')).toBeTruthy();
  });

  it('shows the authentication screen when no verified session is available', () => {
    mocks.appState = { ...mocks.appState, routes: [{ id: 'cached' }] };

    render(<AuthGate />);

    expect(screen.getByText('auth-screen:true')).toBeTruthy();
  });
});
