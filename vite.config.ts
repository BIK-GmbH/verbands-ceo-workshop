import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkGfm from "remark-gfm";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const BASE = process.env.BASE_PATH ?? "/verbands-ceo-workshop/";

const mdxPlugin = mdx({
  providerImportSource: "@mdx-js/react",
  remarkPlugins: [
    remarkFrontmatter,
    [remarkMdxFrontmatter, { name: "frontmatter" }],
    remarkGfm,
  ],
});

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    {
      enforce: "pre",
      ...mdxPlugin,
      // The MDX plugin drops the query before matching, so `x.mdx?raw` would be
      // compiled too. Raw imports (the glossary reads its own slide source) must stay strings.
      transform: (value: string, id: string) => (id.includes("?raw") ? undefined : mdxPlugin.transform(value, id)),
    },
    react(),
    tailwindcss(),
    VitePWA({
      // autoUpdate: a new deploy replaces the cached version on the next load,
      // otherwise viewers keep seeing the old deck until they accept a prompt.
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "brand/bik-logo-white.svg",
        "brand/bik-logo-dark.svg",
        "brand/fbs-logo.png",
        "brand/fbs-logo-white.png",
        "brand/innovationswerkstatt-dark.png",
        "brand/innovationswerkstatt-white.png",
        "brand/dms-logo-dark.png",
        "brand/dms-logo-white.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,ico,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${BASE}index.html`,
      },
      manifest: {
        id: "/verbands-ceo-workshop/",
        name: "KI-Geschäftsführer: Fiktion oder Realität? · FBS-Workshop",
        short_name: "FBS-Workshop",
        description:
          "Zweitages-Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ für den Fachverband Betonbohren und -sägen Deutschland e. V. — Harald Ostermann (Innovationswerkstatt & Digital Management School) und Dr. Stefan Reinheimer (BIK GmbH).",
        theme_color: "#111218",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        lang: "de",
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: "favicon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
          { src: "icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
          { src: "icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
          { src: "icon-maskable-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
});
