import { createRoot } from "react-dom/client";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import Component from "./component";
import Layout from "./Layout";

const root = createRoot(document.body);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* create this routes dynamically per session */}
          <Route path="/gmail1" element={<Component tabId="gmail3" />} />
          <Route path="/gmail2" element={<Component tabId="gmail4" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>,
);
