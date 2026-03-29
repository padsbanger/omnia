import { contextBridge, ipcRenderer } from "electron";

const validChannels = [
  "page-title-updated",
  "global-unread-update",
  "update-view-bounds",
  "activate-tab",
  "clear-partitions",
  "tabId-change",
  "refresh-view",
  "open-external-link",
  "create-route-view",
  "delete-route-view",
  "clear-single-partition",
  "main-window-resize",
];

contextBridge.exposeInMainWorld("electronAPI", {
  sendToMain: (channel: string, data: any) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  invoke: (channel: string, data: any) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error("Invalid channel"));
  },

  onFromMain: (channel: string, callback: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});
