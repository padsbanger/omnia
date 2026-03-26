import { Route } from "../../common/routes";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  sidebarCollapsed: boolean;
  activeTab: string | null;
  unreadCounts: Record<string, number>;
  routes: Array<Route>;
  drawerOpen: boolean;

  toggleSidebar: () => void;
  setActiveTab: (tabId: string | null) => void;
  updateUnreadCount: (tabId: string, count: number) => void;
  setDrawerOpen: (isOpen: boolean) => void;
  addRoute: (route: Route) => void;
  updateRoutesOrder: (routes: Array<Route>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarCollapsed: false,
      activeTab: null as string | null,
      unreadCounts: {},
      routes: [] as Array<Route>,
      drawerOpen: false,

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (activeTab) => set({ activeTab }),
      updateUnreadCount: (tabId, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [tabId]: count },
        })),
      setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
      addRoute: (route) =>
        set((state) => ({
          routes: [...state.routes, route],
        })),
      updateRoutesOrder: (routes) => set({ routes }),
    }),
    {
      name: "omnia-app-storage", // Key for localStorage
    },
  ),
);
