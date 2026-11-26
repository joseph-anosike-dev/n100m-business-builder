import { Capacitor } from '@capacitor/core';

/** True only inside the Capacitor Android (or iOS) shell, never in a browser. */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
