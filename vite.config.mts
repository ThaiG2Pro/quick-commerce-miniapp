import { defineConfig } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: "./",
    base: "",
    plugins: [zaloMiniApp(), react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
              if (id.includes("@medusajs/js-sdk") || id.includes("medusa")) return "vendor-medusa";
              if (id.includes("zmp-sdk") || id.includes("zmp-ui")) return "vendor-zmp";
              if (id.includes("embla-carousel")) return "vendor-embla";
              if (id.includes("@stripe")) return "vendor-stripe";
              if (id.includes("jotai")) return "vendor-jotai";
              return "vendor";
            }
          }
        },
        plugins: [
          visualizer({ filename: "www/bundle-report.html", title: "Bundle Report", gzip: true, brotli: true, open: false })
        ]
      }
    },

  });
};
