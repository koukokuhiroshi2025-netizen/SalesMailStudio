import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vite";

const localStatePath = process.env.SALES_MAIL_STUDIO_STATE_PATH
  ?? join(tmpdir(), "sales-mail-studio-state");

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare({ persistState: { path: localStatePath } }),
  ],
  server: { port: 5173 },
});
