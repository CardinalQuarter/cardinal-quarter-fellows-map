import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// BASE_PATH is "/<repo-name>/" for a GitHub project page and "/" once a custom
// domain (cardinalquarterfellows.cardinalservice.org) is attached.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss()],
});
