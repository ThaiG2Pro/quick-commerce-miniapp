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
            // Only split node_modules
            if (!id.includes("node_modules")) return undefined;

            // Extract package name from path: node_modules/<pkg>/... or node_modules/@scope/pkg/...
            const parts = id.split('node_modules/')[1].split('/');
            const pkgName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];

            // Strongly group react/react-dom and related libs together
            if (pkgName === 'react' || pkgName === 'react-dom' || pkgName.startsWith('react')) {
              return 'vendor-react';
            }

            // Explicit mappings for large libs
            const map: Record<string, string> = {
              '@medusajs/js-sdk': 'vendor-medusa',
              'zmp-sdk': 'vendor-zmp',
              'zmp-ui': 'vendor-zmp',
              'embla-carousel': 'vendor-embla',
              'embla-carousel-react': 'vendor-embla',
              '@stripe/stripe-js': 'vendor-stripe',
              '@stripe/react-stripe-js': 'vendor-stripe',
              'jotai': 'vendor-jotai',
            };

            if (map[pkgName]) return map[pkgName];

            // Fallback: create one chunk per package to avoid a single large `vendor` chunk
            return `vendor-${pkgName.replace('/', '-')}`;
          }
        },
        plugins: [
          visualizer({ filename: "www/bundle-report.html", title: "Bundle Report", gzip: true, brotli: true, open: false })
        ]
      }
    },

  });
};
