import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Relative asset paths: the same build works at https://<org>.github.io/<repo>/
// and at a custom domain, so attaching the domain needs no rebuild.
export default defineConfig({
  base: process.env.BASE_PATH ?? "./",
  plugins: [react(), tailwindcss()],
});
