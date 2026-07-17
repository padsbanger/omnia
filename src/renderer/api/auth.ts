export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
};

type CurrentUserResponse = {
  user: AuthUser;
};

export const loginUser = () =>
  window.electronAPI.invoke("auth-login") as Promise<AuthResponse>;

export const getCurrentUser = (token: string) =>
  window.electronAPI.invoke("auth-me", { token }) as Promise<CurrentUserResponse>;
