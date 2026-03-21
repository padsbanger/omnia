import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Example: send message to main process
  sendToMain: (channel: string, data: any) => {
    // Optional: whitelist channels for security
    const validChannels = [
      "create-gmail-tab",
      "some-other-channel",
      "update-view-bounds",
      "activate-tab",
      "clear-partitions",
      "tabId-change",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Example: invoke (async request → response)
  invoke: (channel: string, data: any) => {
    const validInvokeChannels = [
      "create-or-show-tab",
      "update-view-bounds",
      "activate-tab",
      "clear-partitions",
      "tabId-change",
    ];
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error("Invalid channel"));
  },

  // If you need to listen for messages from main → renderer
  onFromMain: (channel: string, callback: (...args: any[]) => void) => {
    const valid = [
      "tab-title-update",
      "update-view-bounds",
      "activate-tab",
      "tabId-change",
    ]; // etc.
    if (valid.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const subscription = (_event: any, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },
});
