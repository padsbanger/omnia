import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";

import Window from "./components/Window";
import SpreadWindows from "./components/SpreadWindows";
import Layout from "./components/Layout";
import { useAppStore } from "./store";

function AppWithKeyboardShortcuts() {
  const navigate = useNavigate();
  const { activeTab, routes, windowLayout } = useAppStore();

  // Pre-create all route views in the background on startup so that
  // page-title-updated fires for every tab immediately, enabling unread
  // notification counts to be gathered before the user visits each tab.
  useEffect(() => {
    routes.forEach((route) => {
      window.electronAPI.invoke("create-route-view", { route });
    });
  }, [routes]);

  useEffect(() => {
    if (windowLayout === "spread" || windowLayout === "matrix") {
      return;
    }

    const hasMatchingRoute = routes.some(
      (route) => route.path === window.location.pathname,
    );

    if (hasMatchingRoute) {
      return;
    }

    if (activeTab) {
      const activeRoute = routes.find((route) => route.id === activeTab);
      if (activeRoute) {
        navigate(activeRoute.path, { replace: true });
        return;
      }
    }

    const firstRoute = routes[0];
    if (firstRoute) {
      navigate(firstRoute.path, { replace: true });
    }
  }, [activeTab, navigate, routes, windowLayout]);

  if (windowLayout === "spread" || windowLayout === "matrix") {
    return (
      <Layout>
        <SpreadWindows />
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        {routes.map((route) => (
          <Route
            path={route.path}
            key={route.id}
            element={<Window route={route} />}
          />
        ))}
      </Routes>
    </Layout>
  );
}

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppWithKeyboardShortcuts />
    </BrowserRouter>
  </React.StrictMode>,
);
