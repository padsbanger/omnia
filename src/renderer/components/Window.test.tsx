// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../../common/routes';
import Window from './Window';

const route: Route = {
  id: 'route-1',
  label: 'Route 1',
  icon: 'link',
  path: '/route-1',
  loadURL: 'https://route-1.example.com',
  partition: 'persist:route-1',
};

describe('Window', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.assign(window, {
      electronAPI: {
        invoke: vi.fn(async () => ({ success: true })),
        onFromMain: vi.fn(() => vi.fn()),
      },
    });
    vi.stubGlobal('ResizeObserver', class {
      disconnect() {}
      observe() {}
    });
  });

  it('refreshes the active view only for the browser refresh shortcut', () => {
    render(<Window route={route} />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', ctrlKey: true }));

    expect(window.electronAPI.invoke).toHaveBeenCalledWith('refresh-view', { route });
  });
});
