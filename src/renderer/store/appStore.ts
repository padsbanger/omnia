import { Route } from "../../common/routes";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  sidebarCollapsed: boolean;
  activeTab: string | null;
  unreadCounts: Record<string, number>;
  routes: Array<Route>;
  activeDrawer: "create" | "manage" | null;
  windowLayout: "single" | "spread" | "matrix";
  toggleSidebar: () => void;
  setActiveTab: (tabId: string | null) => void;
  updateUnreadCount: (tabId: string, count: number) => void;
  setActiveDrawer: (drawer: "create" | "manage" | null) => void;
  setWindowLayout: (layout: "single" | "spread" | "matrix") => void;
  addRoute: (route: Route) => void;
  removeRoute: (routeId: string) => void;
  updateRoutesOrder: (routes: Array<Route>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeTab: null as string | null,
      unreadCounts: {},
      routes: [] as Array<Route>,
      activeDrawer: null as "create" | "manage" | null,
      windowLayout: "single" as "single" | "spread" | "matrix",

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (activeTab) => set({ activeTab }),
      updateUnreadCount: (tabId, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [tabId]: count },
        })),
      setActiveDrawer: (activeDrawer) => set({ activeDrawer }),
      setWindowLayout: (windowLayout) => set({ windowLayout }),
      addRoute: (route) =>
        set((state) => ({
          routes: [...state.routes, route],
        })),
      removeRoute: (routeId) =>
        set((state) => {
          const nextUnreadCounts = { ...state.unreadCounts };
          delete nextUnreadCounts[routeId];

          return {
            routes: state.routes.filter((route) => route.id !== routeId),
            unreadCounts: nextUnreadCounts,
            activeTab: state.activeTab === routeId ? null : state.activeTab,
          };
        }),
      updateRoutesOrder: (routes) => set({ routes }),
    }),
    {
      name: "omnia-app-storage", // Key for localStorage
    },
  ),
);
