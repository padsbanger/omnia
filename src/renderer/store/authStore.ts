import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthUser } from "../api/auth";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setSession: (
    token: string,
    user: AuthUser,
    refreshToken?: string | null,
  ) => void;
  setTokens: (token: string, refreshToken: string | null) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setSession: (token, user, refreshToken) =>
        set((state) => ({
          token,
          user,
          refreshToken:
            refreshToken === undefined ? state.refreshToken : refreshToken,
        })),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      clearSession: () =>
        set({ token: null, refreshToken: null, user: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "omnia-auth-storage",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
