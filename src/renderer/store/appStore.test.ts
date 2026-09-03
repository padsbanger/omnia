// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Route } from '../../common/routes';
import { useAppStore } from './appStore';

const createRoute = (id: string, faviconUrl?: string): Route => ({
  id,
  path: `/${id}`,
  icon: 'link',
  faviconUrl,
  label: id,
  loadURL: `https://${id}.example.com`,
  partition: `persist:${id}`,
});

describe('appStore route favicons', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({ routes: [] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('updates only the matching route favicon', () => {
    useAppStore.setState({
      routes: [createRoute('one'), createRoute('two')],
    });

    useAppStore
      .getState()
      .updateRouteFavicon('one', 'https://one.example.com/favicon.png');

    expect(useAppStore.getState().routes).toEqual([
      createRoute('one', 'https://one.example.com/favicon.png'),
      createRoute('two'),
    ]);
  });

  it('keeps a discovered favicon when server routes are refreshed', () => {
    useAppStore.setState({
      routes: [
        {
          ...createRoute('one', 'https://one.example.com/favicon.png'),
          zoomLevel: 2,
        },
      ],
    });

    useAppStore.getState().updateRoutesOrder([createRoute('one')]);

    expect(useAppStore.getState().routes[0]).toMatchObject({
      faviconUrl: 'https://one.example.com/favicon.png',
      zoomLevel: 2,
    });
  });
});
