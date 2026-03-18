import { createRoot } from "react-dom/client";
import Component from "./component";

const root = createRoot(document.body);
root.render(
  <h2>
    Hello from React!!111
    <Component />
  </h2>,
);
