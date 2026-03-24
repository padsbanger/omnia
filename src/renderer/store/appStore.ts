import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  // Example state - you can customize this
  sidebarCollapsed: boolean;
  activeTab: string | null;
  unreadCounts: Record<string, number>;

  // Actions
  toggleSidebar: () => void;
  setActiveTab: (tabId: string | null) => void;
  updateUnreadCount: (tabId: string, count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      activeTab: null as string | null,
      unreadCounts: {},

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
      // You can add version for migrations if needed
      // version: 1,
    },
  ),
);
