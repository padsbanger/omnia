import { createRoot } from "react-dom/client";
import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Window from "./components/Window";
import Layout from "./components/Layout";
import routes from "./routes";

function AppWithKeyboardShortcuts() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
    <AppWithKeyboardShortcuts />
  </React.StrictMode>,
);
