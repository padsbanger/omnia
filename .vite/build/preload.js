"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Example: send message to main process
  sendToMain: (channel, data) => {
    const validChannels = [
      "create-gmail-tab",
      "some-other-channel",
      "update-view-bounds",
      "activate-tab",
      "clear-partitions"
    ];
    if (validChannels.includes(channel)) {
      electron.ipcRenderer.send(channel, data);
    }
  },
  // Example: invoke (async request → response)
  invoke: (channel, data) => {
    const validInvokeChannels = [
      "create-or-show-tab",
      "update-view-bounds",
      "activate-tab",
      "clear-partitions"
    ];
    if (validInvokeChannels.includes(channel)) {
      return electron.ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error("Invalid channel"));
  },
  // If you need to listen for messages from main → renderer
  onFromMain: (channel, callback) => {
    const valid = ["tab-title-update", "update-view-bounds", "activate-tab"];
    if (valid.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      electron.ipcRenderer.on(channel, subscription);
      return () => electron.ipcRenderer.removeListener(channel, subscription);
    }
  }
});
