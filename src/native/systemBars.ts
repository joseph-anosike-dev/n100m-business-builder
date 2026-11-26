import { registerPlugin } from '@capacitor/core';
import { isNativeApp } from './platform';

// Capacitor's built-in SystemBars plugin controls the status and navigation
// bar icon colour. It is reached through registerPlugin so this file compiles
// regardless of which typed exports a given Capacitor 7 minor release has.
//
// Style names follow Capacitor's convention: DARK means light icons for a dark
// background, LIGHT means dark icons for a light background.
type BarStyle = 'DARK' | 'LIGHT' | 'DEFAULT';

interface SystemBarsPlugin {
  setStyle(options: { style: BarStyle }): Promise<void>;
}

/**
 * Match the system bar icons to the app's effective theme. The bars are
 * transparent (edge-to-edge); the app's top and bottom bars paint behind them.
 * Safe to call anywhere: it does nothing in a browser and never throws.
 */
export function syncSystemBars(effectiveDark: boolean): void {
  if (!isNativeApp()) return;
  try {
    const bars = registerPlugin<SystemBarsPlugin>('SystemBars');
    bars.setStyle({ style: effectiveDark ? 'DARK' : 'LIGHT' }).catch(() => {
      /* Cosmetic only. */
    });
  } catch {
    /* Cosmetic only. */
  }
}
