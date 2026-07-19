import {
  app,
  BrowserWindow,
  screen,
  session,
  shell,
  WebContentsView,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DrawerKind,
  DrawerStateSnapshot,
  WindowLayout,
} from '../../common/drawer';
import { Route, RouteMemoryUsage } from '../../common/routes';
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
import packageJson from '../../../package.json';
import { updateAppUnreadBadge } from './appUnreadBadge';
import {
  createUnreadTrackerScript,
  parseUnreadTrackerMessage,
} from './unreadTracker';

const GOOGLE_OAUTH_POPUP_ICONS = new Set(['twitter', 'tradingview']);
const WEBAUTHN_DISABLED_ICONS = new Set(['gmail', 'twitter']);
const DISABLED_WEBAUTHN_BLINK_FEATURES =
  'WebAuth,WebAuthenticationConditionalUI';
const MEMORY_USAGE_POLL_INTERVAL_MS = 15000;
const SIDEMENU_WIDTH = 100;
const DRAWER_ANIMATION_DURATION_MS = 180;
const WINDOWS_APP_USER_MODEL_ID = packageJson.build.appId;
const DRAWER_WIDTHS: Record<DrawerKind, number> = {
  create: 360,
  manage: 360,
  settings: 440,
};

type CreateWindowOptions = {
  startMinimized?: boolean;
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

  if (process.platform === 'win32') {
    mainWindow.setAppDetails({
      appId: WINDOWS_APP_USER_MODEL_ID,
      appIconPath: getAppIconPath(),
      appIconIndex: 0,
      relaunchDisplayName: app.getName(),
      relaunchCommand: process.execPath,
    });
  }

  const views = new Map<string, WebContentsView>();
  const runtimeRoutes: Route[] = [];
  const unreadCounts: Array<{ routeId: string; count: number; source?: string }> = [];
  let latestTotalUnread = 0;
  let drawerWindow: BrowserWindow | null = null;
  let drawerWindowTargetUrl: string | null = null;
  let drawerAnimationTimer: NodeJS.Timeout | null = null;
  let drawerState: DrawerStateSnapshot = {
    activeDrawer: null,
    activeTab: null,
    routes: [],
    windowLayout: 'single',
    isOffline: false,
  };

  const emitRouteMemoryUsage = (
    routeId: string,
    memoryUsage: RouteMemoryUsage | undefined,
  ) => {
    const route = runtimeRoutes.find((item) => item.id === routeId);
    if (route) {
      route.memoryUsage = memoryUsage;
    }

    mainWindow?.webContents.send('route-memory-usage-updated', {
      routeId,
      memoryUsage,
    });
  };

  const syncAppUnreadBadge = (totalUnread: number) => {
    latestTotalUnread = totalUnread;
    updateAppUnreadBadge(mainWindow, totalUnread);
  };

  const getUnreadSourcePriority = (source: string) => {
    if (source.endsWith('-dom')) return 2;
    if (source === 'title') return 1;
    return 0;
  };

  const setRouteUnreadCount = (
    routeId: string,
    count: number,
    source: string,
  ) => {
    const normalizedCount = Math.max(0, Math.floor(count));
    const existing = unreadCounts.find((item) => item.routeId === routeId);

    if (
      existing &&
      getUnreadSourcePriority(existing.source ?? '') >
        getUnreadSourcePriority(source)
    ) {
      return;
    }

    if (existing) {
      existing.count = normalizedCount;
      existing.source = source;
    } else {
      unreadCounts.push({ routeId, count: normalizedCount, source });
    }

    const totalUnread = unreadCounts.reduce((total, item) => total + item.count, 0);

    syncAppUnreadBadge(totalUnread);

    mainWindow?.webContents.send('global-unread-update', {
      unreadCounts,
      total: totalUnread,
    });
    mainWindow?.webContents.send('unread-update', {
      routeId,
      count: normalizedCount,
      source,
    });
  };

  const getWebContentsProcessMemoryInfo = async (view: WebContentsView) => {
    const webContentsWithOptionalMemoryApi = view.webContents as typeof view.webContents & {
      getProcessMemoryInfo?: () => Promise<{
        private: number;
        shared: number;
        residentSet?: number;
      }>;
    };

    if (typeof webContentsWithOptionalMemoryApi.getProcessMemoryInfo === 'function') {
      return webContentsWithOptionalMemoryApi.getProcessMemoryInfo();
    }

    const osProcessId = view.webContents.getOSProcessId();
    if (!osProcessId) {
      return null;
    }

    const processMetric = app
      .getAppMetrics()
      .find((metric) => metric.pid === osProcessId);

    if (!processMetric) {
      return null;
    }

    return {
      private: processMetric.memory.privateBytes ?? 0,
      shared: 0,
      residentSet: processMetric.memory.workingSetSize,
    };
  };

  const collectRouteMemoryUsage = async (
    routeId: string,
    view: WebContentsView,
  ) => {
    if (view.webContents.isDestroyed()) {
      return;
    }

    if (view.webContents.isLoadingMainFrame()) {
      return;
    }

    const processInfo = (await getWebContentsProcessMemoryInfo(view).catch(
      () => null,
    )) as
      | {
          private: number;
          shared: number;
          residentSet?: number;
        }
      | null;

    emitRouteMemoryUsage(routeId, {
      privateSize: processInfo?.private ?? 0,
      sharedSize: processInfo?.shared ?? 0,
      residentSet: processInfo?.residentSet ?? 0,
      heapSizeLimit: 0,
      usedHeapSize: 0,
    });
  };

  const syncAllRouteMemoryUsage = async () => {
    await Promise.all(
      Array.from(views.entries()).map(([routeId, view]) =>
        collectRouteMemoryUsage(routeId, view).catch((error) => {
          console.error(`Failed to collect memory usage for ${routeId}`, error);
        }),
      ),
    );
  };

  const clearRouteRuntimeState = (routeId: string) => {
    const unreadIndex = unreadCounts.findIndex((item) => item.routeId === routeId);
    if (unreadIndex >= 0) unreadCounts.splice(unreadIndex, 1);

    audioStates.delete(routeId);
    emitRouteMemoryUsage(routeId, undefined);

    const totalUnread = unreadCounts.reduce(
      (total, item) => total + item.count,
      0,
    );
    syncAppUnreadBadge(totalUnread);
    mainWindow?.webContents.send('global-unread-update', {
      unreadCounts,
      total: totalUnread,
    });
  };

  const getDrawerWindowUrl = (drawer: DrawerKind) => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      return `${MAIN_WINDOW_VITE_DEV_SERVER_URL}?drawer=${drawer}`;
    }

    const fileUrl = pathToFileURL(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
    fileUrl.searchParams.set('drawer', drawer);
    return fileUrl.toString();
  };

  const clearDrawerAnimation = () => {
    if (drawerAnimationTimer) {
      clearInterval(drawerAnimationTimer);
      drawerAnimationTimer = null;
    }
  };

  const getDrawerBounds = (drawer: DrawerKind) => {
    if (!mainWindow) {
      return null;
    }

    const contentBounds = mainWindow.getContentBounds();
    return {
      x: contentBounds.x + SIDEMENU_WIDTH,
      y: contentBounds.y,
      width: DRAWER_WIDTHS[drawer],
      height: contentBounds.height,
    };
  };

  const animateDrawerWindowIn = (drawer: DrawerKind) => {
    if (!drawerWindow || drawerWindow.isDestroyed()) {
      return;
    }

    const finalBounds = getDrawerBounds(drawer);
    if (!finalBounds) {
      return;
    }

    clearDrawerAnimation();

    const startBounds = {
      ...finalBounds,
      x: finalBounds.x - finalBounds.width,
    };
    const animationStart = Date.now();

    drawerWindow.setBounds(startBounds);
    if (!drawerWindow.isVisible()) {
      drawerWindow.show();
    }

    drawerAnimationTimer = setInterval(() => {
      if (!drawerWindow || drawerWindow.isDestroyed()) {
        clearDrawerAnimation();
        return;
      }

      const elapsed = Date.now() - animationStart;
      const progress = Math.min(1, elapsed / DRAWER_ANIMATION_DURATION_MS);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      drawerWindow.setBounds({
        ...finalBounds,
        x: Math.round(
          startBounds.x + (finalBounds.x - startBounds.x) * easedProgress,
        ),
      });

      if (progress >= 1) {
        clearDrawerAnimation();
      }
    }, 16);
  };

  const updateDrawerWindowBounds = () => {
    if (!mainWindow || !drawerWindow || drawerWindow.isDestroyed()) {
      return;
    }

    const activeDrawer = drawerState.activeDrawer;
    if (!activeDrawer) {
      return;
    }

    const bounds = getDrawerBounds(activeDrawer);
    if (!bounds) {
      return;
    }

    drawerWindow.setBounds(bounds);
  };

  const closeDrawerWindow = () => {
    if (!drawerWindow || drawerWindow.isDestroyed()) {
      drawerState.activeDrawer = null;
      drawerWindow = null;
      return;
    }

    drawerState.activeDrawer = null;
    clearDrawerAnimation();
    drawerWindow.hide();
    mainWindow?.webContents.send('drawer-window-closed');
  };

  const ensureDrawerWindow = async (drawer: DrawerKind) => {
    if (!mainWindow) {
      return;
    }

    const targetUrl = getDrawerWindowUrl(drawer);

    if (!drawerWindow || drawerWindow.isDestroyed()) {
      drawerWindow = new BrowserWindow({
        parent: mainWindow,
        frame: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        show: false,
        skipTaskbar: true,
        backgroundColor: '#ffffff',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js'),
        },
      });

      drawerWindow.on('closed', () => {
        clearDrawerAnimation();
        drawerWindow = null;
        drawerWindowTargetUrl = null;
      });
    }

    updateDrawerWindowBounds();

    const currentUrl = drawerWindow.webContents.getURL();
    const isAlreadyTargetingUrl =
      drawerWindowTargetUrl === targetUrl ||
      currentUrl === targetUrl;

    if (!isAlreadyTargetingUrl) {
      drawerWindowTargetUrl = targetUrl;
      try {
        await drawerWindow.loadURL(targetUrl);
      } catch (error) {
        const navigationError = error as { code?: string };
        if (navigationError.code === 'ERR_ABORTED') {
          return;
        }

        throw error;
      }
    }

    if (!drawerWindow.isVisible()) {
      animateDrawerWindowIn(drawer);
    } else {
      updateDrawerWindowBounds();
    }

    drawerWindow.focus();
  };

  const createViewForRoute = (route: Route) => {
    if (!runtimeRoutes.some((existingRoute) => existingRoute.id === route.id)) {
      runtimeRoutes.push(route);
    }

    const runtimeRoute = runtimeRoutes.find(
      (existingRoute) => existingRoute.id === route.id,
    );
    if (runtimeRoute) {
      runtimeRoute.isHibernated = false;
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

    const injectUnreadTracker = () => {
      if (webContents.isDestroyed()) {
        return;
      }

      webContents
        .executeJavaScript(createUnreadTrackerScript(), false)
        .catch((error) => {
          console.error(`Failed to inject unread tracker for ${route.id}`, error);
        });
    };

    webContents.on('console-message', (_event: any, detailsOrLevel: any, message?: string) => {
      const consoleMessage =
        typeof detailsOrLevel?.message === 'string'
          ? detailsOrLevel.message
          : message;

      if (typeof consoleMessage !== 'string') {
        return;
      }

      const unreadUpdate = parseUnreadTrackerMessage(consoleMessage);

      if (!unreadUpdate) {
        return;
      }

      setRouteUnreadCount(route.id, unreadUpdate.count, unreadUpdate.source);
    });

    webContents.on('dom-ready', injectUnreadTracker);
    webContents.on('did-finish-load', injectUnreadTracker);

    webContents.on('page-title-updated', (_event: any, title: string) => {
      const unread = extractUnreadFromTitle(title);
      setRouteUnreadCount(route.id, unread, 'title');
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
    webContents.on('did-finish-load', () => {
      setTimeout(() => {
        void collectRouteMemoryUsage(route.id, view);
      }, 1000);
    });

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

    clearRouteRuntimeState(route.id);

    const routeIndex = runtimeRoutes.findIndex((r) => r.id === route.id);
    if (routeIndex >= 0) runtimeRoutes.splice(routeIndex, 1);

    try {
      await session.fromPartition(route.partition).clearStorageData();
    } catch (error) {
      console.error(`Failed to clear partition ${route.partition}`, error);
    }

    return true;
  };

  const hibernateRouteView = async (route: Route) => {
    const view = views.get(route.id);
    if (view) {
      mainWindow?.contentView.removeChildView(view);
      views.delete(route.id);
      if (!view.webContents.isDestroyed()) {
        view.webContents.close({ waitForBeforeUnload: false });
      }
    }

    const runtimeRoute = runtimeRoutes.find((item) => item.id === route.id);
    if (runtimeRoute) {
      runtimeRoute.isHibernated = true;
    }

    clearRouteRuntimeState(route.id);
    return true;
  };

  const getDrawerState = () => drawerState;

  const syncDrawerState = async (state: DrawerStateSnapshot) => {
    drawerState = state;

    if (!state.activeDrawer) {
      closeDrawerWindow();
      return;
    }

    await ensureDrawerWindow(state.activeDrawer);
  };

  const createRouteFromDrawer = async (route: Route) => {
    if (!route || !route.id) {
      return false;
    }

    const view = createViewForRoute(route);
    if (!view) {
      return false;
    }

    if (!runtimeRoutes.some((existingRoute) => existingRoute.id === route.id)) {
      runtimeRoutes.push(route);
    }

    drawerState = {
      ...drawerState,
      activeTab: route.id,
      routes: [...drawerState.routes, route],
    };

    mainWindow?.webContents.send('drawer-route-created', { route });
    return true;
  };

  const updateRouteFromDrawer = async (routeId: string, label: string) => {
    const route = drawerState.routes.find((item) => item.id === routeId);
    if (!route) {
      return false;
    }

    drawerState = {
      ...drawerState,
      routes: drawerState.routes.map((item) =>
        item.id === routeId ? { ...item, label } : item,
      ),
    };

    const runtimeRoute = runtimeRoutes.find((item) => item.id === routeId);
    if (runtimeRoute) {
      runtimeRoute.label = label;
    }

    const nextRoute = { ...route, label };
    mainWindow?.webContents.send('drawer-route-label-changed', {
      route: nextRoute,
      routeId,
      label,
    });

    return true;
  };

  const deleteRouteFromDrawer = async (routeId: string) => {
    const route = drawerState.routes.find((item) => item.id === routeId);
    if (!route) {
      return { success: false, fallbackRoute: null };
    }

    const fallbackRoute =
      drawerState.routes.find((item) => item.id !== routeId) ?? null;

    const success = await removeRouteView(route);
    if (!success) {
      return { success: false, fallbackRoute: null };
    }

    drawerState = {
      ...drawerState,
      activeTab: drawerState.activeTab === routeId ? fallbackRoute?.id ?? null : drawerState.activeTab,
      routes: drawerState.routes.filter((item) => item.id !== routeId),
    };

    mainWindow?.webContents.send('drawer-route-deleted', {
      routeId,
      fallbackRoute,
    });

    return { success: true, fallbackRoute };
  };

  const setRouteHibernationFromDrawer = async (
    routeId: string,
    isHibernated: boolean,
  ) => {
    const route = drawerState.routes.find((item) => item.id === routeId);
    if (!route) {
      return false;
    }

    if (isHibernated) {
      const success = await hibernateRouteView(route);
      if (!success) {
        return false;
      }
    } else {
      const restoredRoute = { ...route, isHibernated: false };
      const view = createViewForRoute(restoredRoute);
      if (!view) {
        return false;
      }
    }

    drawerState = {
      ...drawerState,
      routes: drawerState.routes.map((item) =>
        item.id === routeId ? { ...item, isHibernated } : item,
      ),
    };

    mainWindow?.webContents.send('drawer-route-hibernation-changed', {
      routeId,
      isHibernated,
      route: { ...route, isHibernated },
    });
    return true;
  };

  const setWindowLayoutFromDrawer = (windowLayout: WindowLayout) => {
    drawerState = {
      ...drawerState,
      windowLayout,
    };
    mainWindow?.webContents.send('drawer-window-layout-changed', {
      windowLayout,
    });
  };

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    views,
    routes: runtimeRoutes,
    createViewForRoute,
    removeRouteView,
    hibernateRouteView,
    getDrawerState,
    syncDrawerState,
    closeDrawerWindow,
  createRouteFromDrawer,
  deleteRouteFromDrawer,
  updateRouteFromDrawer,
  setRouteHibernationFromDrawer,
  setWindowLayoutFromDrawer,
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
      updateAppUnreadBadge(mainWindow, latestTotalUnread);
      return;
    }

    mainWindow?.show();
    mainWindow?.maximize();
    updateAppUnreadBadge(mainWindow, latestTotalUnread);
  });

  let memoryUsageInterval: NodeJS.Timeout | null = null;

  mainWindow.on('closed', () => {
    if (memoryUsageInterval) {
      clearInterval(memoryUsageInterval);
    }
    clearDrawerAnimation();
    closeDrawerWindow();
    updateAppUnreadBadge(null, 0);
    splashWindow?.close();
    splashWindow = null;
    mainWindow = null;
  });

  mainWindow.on('move', () => {
    updateDrawerWindowBounds();
  });

  mainWindow.on('resize', () => {
    updateDrawerWindowBounds();
    mainWindow?.webContents.send('main-window-resize', {
      bounds: mainWindow.getBounds(),
    });
  });

  if (process.env.ELECTRON_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Main window render process gone', details);
  });

  mainWindow.once('show', () => {
    updateAppUnreadBadge(mainWindow, latestTotalUnread);

    memoryUsageInterval = setInterval(() => {
      void syncAllRouteMemoryUsage();
    }, MEMORY_USAGE_POLL_INTERVAL_MS);
  });

  mainWindow.on('restore', () => {
    updateAppUnreadBadge(mainWindow, latestTotalUnread);
  });

  return mainWindow;
};

export default createWindow;
