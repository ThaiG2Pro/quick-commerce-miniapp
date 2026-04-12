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
import { hydrateMedusaAuthFromStorage } from "@/lib/medusa-sdk";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig;
}

void hydrateMedusaAuthFromStorage().catch((error) => {
  console.warn("Cannot hydrate Medusa auth token from storage:", error);
});

// Mount the app
const root = createRoot(document.getElementById("app")!);
root.render(createElement(RouterProvider, { router }));
