// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loginUser: vi.fn(),
  setSession: vi.fn(),
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children, isDisabled, ...props }: React.PropsWithChildren<{ isDisabled?: boolean }>) => (
    <button disabled={isDisabled} {...props}>{children}</button>
  ),
}));
vi.mock("../api/auth", () => ({ loginUser: mocks.loginUser }));
vi.mock("../store", () => ({
  useAuthStore: (selector: (state: { setSession: typeof mocks.setSession }) => unknown) =>
    selector({ setSession: mocks.setSession }),
}));

import AuthScreen from "./AuthScreen";

describe("AuthScreen", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts authentication and stores the returned session", async () => {
    mocks.loginUser.mockResolvedValue({
      token: "access-token",
      refreshToken: "refresh-token",
      user: { id: "user-1", name: "Ada" },
    });
    render(<AuthScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mocks.setSession).toHaveBeenCalledWith(
        "access-token",
        { id: "user-1", name: "Ada" },
        "refresh-token",
      );
    });
  });

  it("shows an authentication error and offers offline mode when routes are cached", async () => {
    const continueOffline = vi.fn();
    mocks.loginUser.mockRejectedValue(new Error("Authentication service unavailable"));
    render(<AuthScreen hasCachedRoutes onContinueOffline={continueOffline} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Authentication service unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use saved routes offline" }));
    expect(continueOffline).toHaveBeenCalledOnce();
  });
});
