import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const notification = {
    on: vi.fn(),
    show: vi.fn(),
  };
  const Notification = Object.assign(vi.fn(() => notification), {
    isSupported: vi.fn(),
  });

  return { Notification, notification };
});

vi.mock("electron", () => ({ Notification: mocks.Notification }));

import { showMainNotification } from "./notifications";

describe("showMainNotification", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a notification and restores the main window when it is clicked", () => {
    const mainWindow = {
      focus: vi.fn(),
      isMinimized: vi.fn(() => true),
      restore: vi.fn(),
      show: vi.fn(),
    };
    mocks.Notification.isSupported.mockReturnValue(true);

    showMainNotification("New activity", "You have a message", { silent: true }, mainWindow);

    expect(mocks.Notification).toHaveBeenCalledWith({
      title: "New activity",
      body: "You have a message",
      icon: undefined,
      silent: true,
      timeoutType: "default",
      urgency: "normal",
      hasReply: false,
    });
    expect(mocks.notification.show).toHaveBeenCalledOnce();

    const clickHandler = mocks.notification.on.mock.calls.find(([event]) => event === "click")?.[1];
    clickHandler();

    expect(mainWindow.restore).toHaveBeenCalledOnce();
    expect(mainWindow.show).toHaveBeenCalledOnce();
    expect(mainWindow.focus).toHaveBeenCalledOnce();
  });

  it("does not construct a notification when the platform does not support it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.Notification.isSupported.mockReturnValue(false);

    showMainNotification("New activity", "You have a message", {}, null);

    expect(mocks.Notification).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Notifications not supported on this platform");
    warn.mockRestore();
  });
});
