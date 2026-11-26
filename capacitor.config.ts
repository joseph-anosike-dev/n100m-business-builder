import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the Vite production build (`dist/`) in an Android WebView.
// Run `npm run build` before `npx cap sync android` so `dist/` is current.
const config: CapacitorConfig = {
  appId: 'com.n100m.businessbuilder',
  appName: 'N100M Business Builder',
  webDir: 'dist',
  android: {
    // Behind the web content while the WebView loads. Brand black-soft/offwhite
    // are chosen by the native theme; this is the fallback.
    backgroundColor: '#F7F4EF',
  },
  plugins: {
    SystemBars: {
      // Publish --safe-area-inset-* as CSS variables (see --safe-* in tokens.css).
      insetsHandling: 'css',
    },
  },
};

export default config;
