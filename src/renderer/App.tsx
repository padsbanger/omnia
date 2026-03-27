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
