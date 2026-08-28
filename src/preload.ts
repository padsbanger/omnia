import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const validChannels = [
  'page-title-updated',
  'global-unread-update',
  'get-unread-state',
  'update-view-bounds',
  'activate-tab',
  'clear-partitions',
  'tabId-change',
  'refresh-view',
  'change-route-zoom',
  'open-external-link',
  'create-route-view',
  'delete-route-view',
  'clear-route-views',
  'hibernate-route-view',
  'sync-drawer-state',
  'get-drawer-state',
  'close-drawer-window',
  'drawer-create-route',
  'drawer-delete-route',
  'drawer-set-route-hibernation',
  'drawer-set-window-layout',
  'clear-single-partition',
  'main-window-resize',
  'open-settings',
  'get-app-settings',
  'set-startup-open-mode',
  'route-memory-usage-updated',
  'route-zoom-changed',
  'drawer-window-closed',
  'drawer-route-created',
  'drawer-route-deleted',
  'drawer-route-hibernation-changed',
  'drawer-route-label-changed',
  'drawer-window-layout-changed',
  'drawer-update-route-label',
  'auth-login',
  'auth-refresh',
  'auth-me',
  'routes-list',
  'routes-create',
  'routes-update',
  'routes-delete',
];

contextBridge.exposeInMainWorld('electronAPI', {
  sendToMain: (channel: string, data: unknown) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  invoke: (channel: string, data: unknown) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error('Invalid channel'));
  },

  onFromMain: (channel: string, callback: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});
