import { createRoot } from "react-dom/client";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Window from "./components/Window";
import Layout from "./components/Layout";
import routes from "./routes";

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
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
  </React.StrictMode>,
);
