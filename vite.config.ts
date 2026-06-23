import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Zero-config-ish Vite setup: React fast refresh (HMR) for the UI.
// `npm run dev` serves with HMR; `npm run build` type-checks then bundles.
export default defineConfig({
  plugins: [react()],
});
