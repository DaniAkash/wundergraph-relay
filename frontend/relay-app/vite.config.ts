import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import relay from "vite-plugin-relay";
import { esbuildCommonjs } from "@originjs/vite-plugin-commonjs";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), relay],
  optimizeDeps: {
    esbuildOptions: {
      plugins: [esbuildCommonjs(["react-relay"])],
    },
  },
});
