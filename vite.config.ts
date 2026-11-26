import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset URLs relative so the same build works when served
// from a sub-path, from a static host, or from inside a Capacitor WebView.
// `dist/` is also Capacitor's `webDir` (capacitor.config.ts); it is cleaned on
// every build so the APK never packages stale files.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
  },
});
