export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
  refreshToken: string | null;
};

type CurrentUserResponse = {
  user: AuthUser;
};

type RefreshResponse = Pick<AuthResponse, "token" | "refreshToken">;

export const loginUser = () =>
  window.electronAPI.invoke("auth-login") as Promise<AuthResponse>;

type RefreshIpcResponse =
  | { ok: true; response: RefreshResponse }
  | {
      ok: false;
      error: { message: string; status?: number };
    };

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export const refreshSession = async (refreshToken: string) => {
  const result = (await window.electronAPI.invoke("auth-refresh", {
    refreshToken,
  })) as RefreshIpcResponse;

  if (!result.ok) {
    throw new AuthRequestError(result.error.message, result.error.status);
  }

  return result.response;
};

export const getCurrentUser = (token: string) =>
  window.electronAPI.invoke("auth-me", { token }) as Promise<CurrentUserResponse>;
