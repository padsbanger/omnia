import routes, { Route } from "../../common/routes";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  sidebarCollapsed: boolean;
  activeTab: string | null;
  unreadCounts: Record<string, number>;
  routes: Array<Route>;

  toggleSidebar: () => void;
  setActiveTab: (tabId: string | null) => void;
  updateUnreadCount: (tabId: string, count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarCollapsed: false,
      activeTab: null as string | null,
      unreadCounts: {},
      routes: routes,

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (activeTab) => set({ activeTab }),
      updateUnreadCount: (tabId, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [tabId]: count },
        })),
    }),
    {
      name: "omnia-app-storage", // Key for localStorage
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeTab: state.activeTab,
        unreadCounts: state.unreadCounts,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AppState>),
        routes,
      }),
    },
  ),
);
