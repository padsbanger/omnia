import { app, BrowserWindow, session, shell, WebContentsView } from 'electron';
import path from 'node:path';
import { Route } from '../../common/routes';
import extractUnreadFromTitle from '../../common/utils/extractUnreadFromTitle';

import {
  getExternalUrlTarget,
  default as isExternalUrl,
} from '../../common/utils/isExternalUrl';
import { registerIpcHandlers } from '../ipc';

const GOOGLE_OAUTH_HOSTS = [
  'mail.google.com',
  'accounts.google.com',
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'gstatic.com',
];

const TWITTER_HOSTS = ['twitter.com', 'x.com', 't.co', 'twimg.com'];
const GOOGLE_OAUTH_POPUP_ICONS = new Set(['twitter', 'tradingview']);

const getInternalHostsForRoute = (route: Route): string[] => {
  const baseHosts = route.internalHosts ?? [new URL(route.loadURL).hostname];
  const mergedHosts = new Set(baseHosts.map((host) => host.toLowerCase()));

  if (route.icon === 'twitter') {
    TWITTER_HOSTS.forEach((host) => mergedHosts.add(host));
    GOOGLE_OAUTH_HOSTS.forEach((host) => mergedHosts.add(host));
  }

  if (route.icon === 'tradingview') {
    GOOGLE_OAUTH_HOSTS.forEach((host) => mergedHosts.add(host));
  }

  return Array.from(mergedHosts);
};

const isGoogleOAuthPopupUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (
      !hostname.endsWith('google.com') &&
      !hostname.endsWith('googleapis.com') &&
      !hostname.endsWith('googleusercontent.com')
    ) {
      return false;
    }

    return (
      parsed.pathname.includes('/o/oauth2/') ||
      parsed.pathname.includes('/gsi/') ||
      parsed.pathname.includes('RotateCookiesPage')
    );
  } catch {
    return false;
  }
};

const createWindow = () => {
  let mainWindow: BrowserWindow | null = null;
  // Add this near your unreadCounts declaration
  const audioStates: Map<string, { isPlaying: boolean; mediaType?: string }> =
    new Map();

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const views = new Map<string, WebContentsView>();
  const runtimeRoutes: Route[] = [];
  const unreadCounts: Array<{ routeId: string; count: number }> = [];

  const createViewForRoute = (route: Route) => {
    if (!runtimeRoutes.some((existingRoute) => existingRoute.id === route.id)) {
      runtimeRoutes.push(route);
    }

    if (views.has(route.id)) {
      return views.get(route.id) ?? null;
    }

    const partition = route.partition;
    const ses = session.fromPartition(partition);
    const internalHosts = getInternalHostsForRoute(route);

    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = [
        'media',
        'audioCapture',
        'videoCapture',
        'notifications',
      ];
      callback(allowed.includes(permission));
    });

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required',
        backgroundThrottling: false,
        plugins: true,
      },
    });

    view.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    );

    const webContents = view.webContents;

    // Media debugging
    webContents.on('media-started-playing', () => {
      const isPlaying = true;
      const existing = audioStates.get(route.id);
      if (existing) {
        existing.isPlaying = true;
        // Optionally track media type if available
      } else {
        audioStates.set(route.id, { isPlaying: true });
      }

      console.log(`🎵 Media started playing in route: ${route.id}`);
    });

    webContents.on('media-started-playing', () => {
      const isPlaying = true;
      const existing = audioStates.get(route.id);
      if (existing) existing.isPlaying = true;
      else audioStates.set(route.id, { isPlaying: true });

      mainWindow?.webContents.send('audio-state-change', {
        routeId: route.id,
        isPlaying: true,
      });
    });

    webContents.on('media-ended', () => {
      const existing = audioStates.get(route.id);
      if (existing) {
        existing.isPlaying = false;
        mainWindow?.webContents.send('audio-state-change', {
          routeId: route.id,
          isPlaying: false,
        });
      }
    });

    webContents.on('page-title-updated', (e: any, title: string) => {
      const unread = extractUnreadFromTitle(title);

      const existing = unreadCounts.find((u) => u.routeId === route.id);
      if (existing) existing.count = unread;
      else unreadCounts.push({ routeId: route.id, count: unread });

      const totalUnread = unreadCounts.reduce((a, b) => a + b.count, 0);

      mainWindow?.webContents.send('global-unread-update', {
        unreadCounts,
        total: totalUnread,
      });
      mainWindow?.webContents.send('unread-update', {
        routeId: route.id,
        count: unread,
      });
    });

    const openInExternalBrowser = (url: string) => {
      const externalTarget = getExternalUrlTarget(url, internalHosts) ?? url;
      shell.openExternal(externalTarget).catch(console.error);
    };

    const shouldOpenExternally = (url: string) =>
      isExternalUrl(url, internalHosts);

    webContents.on('will-navigate', (event, url) => {
      if (shouldOpenExternally(url)) {
        event.preventDefault();
        void openInExternalBrowser(url);
      }
    });

    webContents.setWindowOpenHandler(({ url }) => {
      if (shouldOpenExternally(url)) {
        void openInExternalBrowser(url);
        return { action: 'deny' };
      }

      if (
        GOOGLE_OAUTH_POPUP_ICONS.has(route.icon) &&
        isGoogleOAuthPopupUrl(url)
      ) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            parent: mainWindow ?? undefined,
            modal: true,
            width: 520,
            height: 720,
            autoHideMenuBar: true,
            webPreferences: {
              session: ses,
              nodeIntegration: false,
              contextIsolation: true,
            },
          },
        };
      }

      webContents.loadURL(url).catch(console.error);
      return { action: 'deny' };
    });

    views.set(route.id, view);
    void view.webContents.loadURL(route.loadURL);

    return view;
  };

  // ... (removeRouteView and registerIpcHandlers remain unchanged from your previous version)

  const removeRouteView = async (route: Route) => {
    // [your existing removeRouteView code here — unchanged]
    const view = views.get(route.id);
    if (view) {
      mainWindow?.contentView.removeChildView(view);
      views.delete(route.id);
      if (!view.webContents.isDestroyed()) {
        view.webContents.close({ waitForBeforeUnload: false });
      }
    }

    const unreadIndex = unreadCounts.findIndex(
      (item) => item.routeId === route.id,
    );
    if (unreadIndex >= 0) unreadCounts.splice(unreadIndex, 1);

    const routeIndex = runtimeRoutes.findIndex((r) => r.id === route.id);
    if (routeIndex >= 0) runtimeRoutes.splice(routeIndex, 1);

    try {
      await session.fromPartition(route.partition).clearStorageData();
    } catch (error) {
      console.error(`Failed to clear partition ${route.partition}`, error);
    }

    const totalUnread = unreadCounts.reduce(
      (total, item) => total + item.count,
      0,
    );
    mainWindow?.webContents.send('global-unread-update', {
      unreadCounts,
      total: totalUnread,
    });

    return true;
  };

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    views,
    routes: runtimeRoutes,
    createViewForRoute,
    removeRouteView,
  });

  // Load main renderer (unchanged)
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('resize', () => {
    mainWindow?.webContents.send('main-window-resize', {
      bounds: mainWindow.getBounds(),
    });
  });

  if (process.env.ELECTRON_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
};

export default createWindow;
