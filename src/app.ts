// React core
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

// Router
import router from "@/router";

// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// Expose app configuration
import appConfig from "../app-config.json";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig;
}

// Defer Medusa auth hydration so it doesn't block initial render/FCP.
// The bootstrap flow in Layout will handle auth hydration.
const ric = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 50);
ric(
  () =>
    import("@/lib/medusa-sdk").then((m) =>
      m.hydrateMedusaAuthFromStorage().catch((e) =>
        console.warn("Cannot hydrate Medusa auth token from storage:", e)
      )
    ),
  { timeout: 2000 }
);

// Mount the app
const root = createRoot(document.getElementById("app")!);
root.render(createElement(RouterProvider, { router }));
