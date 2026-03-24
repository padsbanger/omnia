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
];

contextBridge.exposeInMainWorld("electronAPI", {
  // Example: send message to main process
  sendToMain: (channel: string, data: any) => {
    // Optional: whitelist channels for security

    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Example: invoke (async request → response)
  invoke: (channel: string, data: any) => {
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error("Invalid channel"));
  },

  // If you need to listen for messages from main → renderer
  onFromMain: (channel: string, callback: (...args: any[]) => void) => {
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});
