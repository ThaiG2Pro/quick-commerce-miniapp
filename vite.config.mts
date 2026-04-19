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
            if (!/node_modules/.test(id)) return undefined;

            // Match package name, supports pnpm nested layout
            const m = id.match(/node_modules(?:\/\.pnpm\/[^\/]+\/node_modules)?\/(?:@[^\/]+\/[^[\/]+|[^\/]+)/);
            // Better capture group for package name
            const m2 = id.match(/node_modules(?:\/\.pnpm\/[^\/]+\/node_modules)?\/(?:@[^\/]+\/[^[\/]+|[^\/]+)/);

            const capture = id.match(/node_modules(?:\/\.pnpm\/[^\/]+\/node_modules)?\/(?:@[^\/]+\/[^[\/]+|[^\/]+)/);

            // Use a more reliable capture for package name
            const pkgMatch = id.match(/node_modules(?:\/\.pnpm\/[^\/]+\/node_modules)?\/(@?[^\/]+\/?[^\/]*)/);
            const pkgName = pkgMatch ? pkgMatch[1] : id.split('node_modules/')[1].split('/')[0];

            if (pkgName === 'react' || pkgName === 'react-dom' || pkgName.startsWith('react')) {
              return 'vendor-react';
            }

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
