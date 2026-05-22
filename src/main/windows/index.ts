import {
  app,
  BrowserWindow,
  nativeImage,
  screen,
  session,
  shell,
  WebContentsView,
} from 'electron';
import path from 'node:path';
import { Route } from '../../common/routes';
import extractUnreadFromTitle from '../../common/utils/extractUnreadFromTitle';

import {
  getExternalUrlTarget,
  default as isExternalUrl,
} from '../../common/utils/isExternalUrl';
import { registerIpcHandlers } from '../ipc';
import createSplashWindow from './splashWindow';
import getAppIconPath from '../../common/utils/getAppIconPath';
import getInternalHostsForRoute from '../../common/utils/getInternalHostsForRoute';
import isGoogleOAuthPopupUrl from '../../common/utils/isGoogleOAuthPopupUrl';

const GOOGLE_OAUTH_POPUP_ICONS = new Set(['twitter', 'tradingview']);
const WEBAUTHN_DISABLED_ICONS = new Set(['gmail', 'twitter']);
const DISABLED_WEBAUTHN_BLINK_FEATURES =
  'WebAuth,WebAuthenticationConditionalUI';

type CreateWindowOptions = {
  startMinimized?: boolean;
};

const getUnreadOverlayText = (count: number) => {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
};

const createOverlayIcon = (count: number) => {
  const label = getUnreadOverlayText(count);
  if (!label) {
    return null;
  }

  const fontSize = label.length > 2 ? 17 : 20;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <circle cx="16" cy="16" r="16" fill="#ef4444" />
      <text
        x="16"
        y="17"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="Segoe UI, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        fill="#ffffff"
      >${label}</text>
    </svg>
  `;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
};

const updateAppUnreadBadge = (
  mainWindow: BrowserWindow | null,
  totalUnread: number,
) => {
  if (process.platform === 'win32') {
    const overlayIcon = createOverlayIcon(totalUnread);
    mainWindow?.setOverlayIcon(
      overlayIcon,
      totalUnread > 0 ? `${totalUnread} unread notifications` : '',
    );
    return;
  }

  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(totalUnread);
  }
};

const createWindow = ({ startMinimized = false }: CreateWindowOptions = {}) => {
  let mainWindow: BrowserWindow | null = null;
  let splashWindow: BrowserWindow | null = startMinimized
    ? null
    : createSplashWindow();
  // Add this near your unreadCounts declaration
  const audioStates: Map<string, { isPlaying: boolean; mediaType?: string }> =
    new Map();
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    icon: getAppIconPath(),
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
        disableBlinkFeatures: WEBAUTHN_DISABLED_ICONS.has(route.icon)
          ? DISABLED_WEBAUTHN_BLINK_FEATURES
          : undefined,
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

      updateAppUnreadBadge(mainWindow, totalUnread);

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
    updateAppUnreadBadge(mainWindow, totalUnread);
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

  mainWindow.once('ready-to-show', () => {
    splashWindow?.close();
    splashWindow = null;

    if (startMinimized) {
      mainWindow?.show();
      mainWindow?.minimize();
      return;
    }

    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.on('closed', () => {
    updateAppUnreadBadge(null, 0);
    splashWindow?.close();
    splashWindow = null;
    mainWindow = null;
  });

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
