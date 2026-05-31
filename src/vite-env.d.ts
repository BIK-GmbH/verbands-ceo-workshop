/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/info" />

declare module "*.mdx" {
  import type { ComponentType } from "react";
  const component: ComponentType;
  export const frontmatter: Record<string, unknown>;
  export default component;
}
