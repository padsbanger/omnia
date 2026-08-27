import { Route, RouteMemoryUsage } from "../../common/routes";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  sidebarCollapsed: boolean;
  activeTab: string | null;
  unreadCounts: Record<string, number>;
  routes: Array<Route>;
  isOffline: boolean;
  activeDrawer: "create" | "manage" | "settings" | null;
  windowLayout: "single" | "spread" | "matrix";
  toggleSidebar: () => void;
  setActiveTab: (tabId: string | null) => void;
  updateUnreadCount: (tabId: string, count: number) => void;
  replaceUnreadCounts: (counts: Record<string, number>) => void;
  setActiveDrawer: (drawer: "create" | "manage" | "settings" | null) => void;
  setWindowLayout: (layout: "single" | "spread" | "matrix") => void;
  addRoute: (route: Route) => void;
  removeRoute: (routeId: string) => void;
  clearRoutes: () => void;
  updateRoutesOrder: (routes: Array<Route>) => void;
  updateRouteLabel: (routeId: string, label: string) => void;
  setOfflineMode: (isOffline: boolean) => void;
  setRouteHibernation: (routeId: string, isHibernated: boolean) => void;
  updateRouteMemoryUsage: (
    routeId: string,
    memoryUsage: RouteMemoryUsage | undefined,
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeTab: null as string | null,
      unreadCounts: {},
      routes: [] as Array<Route>,
      isOffline: false,
      activeDrawer: null as "create" | "manage" | "settings" | null,
      windowLayout: "single" as "single" | "spread" | "matrix",

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setActiveTab: (activeTab) => set({ activeTab }),
      updateUnreadCount: (tabId, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [tabId]: count },
        })),
      replaceUnreadCounts: (unreadCounts) => set({ unreadCounts }),
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
      clearRoutes: () =>
        set({
          routes: [],
          activeTab: null,
          unreadCounts: {},
          activeDrawer: null,
        }),
      updateRoutesOrder: (routes) => set({ routes }),
      updateRouteLabel: (routeId, label) =>
        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === routeId ? { ...route, label } : route,
          ),
        })),
      setOfflineMode: (isOffline) => set({ isOffline }),
      setRouteHibernation: (routeId, isHibernated) =>
        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === routeId
              ? {
                  ...route,
                  isHibernated,
                  memoryUsage: isHibernated ? undefined : route.memoryUsage,
                }
              : route,
          ),
        })),
      updateRouteMemoryUsage: (routeId, memoryUsage) =>
        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === routeId ? { ...route, memoryUsage } : route,
          ),
        })),
    }),
    {
      name: "omnia-app-storage", // Key for localStorage
      merge: (persistedState, currentState) => {
        const nextState = (persistedState ?? {}) as Partial<AppState>;

        return {
          ...currentState,
          ...nextState,
          unreadCounts: {},
          activeDrawer: null,
        };
      },
      partialize: (state) => ({
        ...state,
        unreadCounts: {},
        activeDrawer: null,
        isOffline: false,
        routes: state.routes.map(({ memoryUsage: _memoryUsage, ...route }) =>
          route,
        ),
      }),
    },
  ),
);
