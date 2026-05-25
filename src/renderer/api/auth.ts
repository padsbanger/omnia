export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
};

type AuthResponse = {
  user: AuthUser;
  token: string;
};

type CurrentUserResponse = {
  user: AuthUser;
};

export const registerUser = (email: string, password: string) =>
  window.electronAPI.invoke("auth-register", {
    email,
    password,
  }) as Promise<AuthResponse>;

export const loginUser = (email: string, password: string) =>
  window.electronAPI.invoke("auth-login", {
    email,
    password,
  }) as Promise<AuthResponse>;

export const getCurrentUser = (token: string) =>
  window.electronAPI.invoke("auth-me", { token }) as Promise<CurrentUserResponse>;
