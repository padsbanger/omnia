import { Notification } from "electron";

function showMainNotification(
  title: string,
  body: string,
  options: any = {},
  mainWindow: any,
) {
  if (!Notification.isSupported()) {
    console.warn("Notifications not supported on this platform");
    return;
  }

  const notification = new Notification({
    title,
    body,
    icon: options.icon, // optional
    silent: options.silent ?? false,
    timeoutType: "default", // or "never"
    urgency: options.urgency ?? "normal", // macOS/Linux: 'normal' | 'critical' | 'low'
    hasReply: options.hasReply ?? false,
    // ... more options available (see docs)
  });

  notification.show();

  notification.on("click", () => {
    console.log("Notification clicked from main");
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notification.on("close", () => {
    console.log("Notification closed");
  });
}
