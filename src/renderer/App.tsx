import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";

import Window from "./components/Window";
import Layout from "./components/Layout";
import { useAppStore } from "./store";

function AppWithKeyboardShortcuts() {
  const navigate = useNavigate();
  const { activeTab, routes } = useAppStore();

  useEffect(() => {
    // Only navigate on initial load if we're at root path
    if (window.location.pathname === "/") {
      if (activeTab) {
        const activeRoute = routes.find((route) => route.id === activeTab);
        if (activeRoute) {
          navigate(activeRoute.path);
        }
      } else {
        // Default to first route
        const firstRoute = routes[0];
        if (firstRoute) {
          navigate(firstRoute.path);
        }
      }
    }
  }, [activeTab, navigate, routes]);

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
