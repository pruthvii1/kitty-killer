import { defineConfig } from "vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  base: "/kitty/",
  plugins: [cloudflare()],
});