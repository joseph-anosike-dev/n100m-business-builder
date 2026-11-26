import { App } from '@capacitor/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installAndroidBack } from './androidBack';

// Only two boundaries are replaced: the platform check and the @capacitor/app
// plugin. Everything else (installAndroidBack itself) is the real code.
const platform = vi.hoisted(() => ({ native: false }));
const plugin = vi.hoisted(() => ({
  remove: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('./platform', () => ({ isNativeApp: () => platform.native }));
vi.mock('@capacitor/app', () => ({
  App: { addListener: plugin.addListener, exitApp: vi.fn() },
}));

beforeEach(() => {
  platform.native = false;
  plugin.remove.mockReset();
  plugin.addListener.mockReset();
  plugin.addListener.mockResolvedValue({ remove: plugin.remove });
});

describe('Android back in a browser', () => {
  it('does not register a back-button listener', () => {
    installAndroidBack();
    expect(App.addListener).not.toHaveBeenCalled();
  });

  it('returns a cleanup function that is safe to call, even repeatedly', () => {
    const cleanup = installAndroidBack();
    expect(typeof cleanup).toBe('function');
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
    expect(plugin.remove).not.toHaveBeenCalled();
  });
});

// Positive control: proves the browser tests above can fail, i.e. that a
// registration really is observable when the platform is native.
describe('Android back in the native app', () => {
  it('registers exactly one backButton listener', () => {
    platform.native = true;
    installAndroidBack();
    expect(App.addListener).toHaveBeenCalledTimes(1);
    expect(App.addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('removes the listener when cleaned up', async () => {
    platform.native = true;
    const cleanup = installAndroidBack();
    await Promise.resolve(); // let addListener's promise settle
    await Promise.resolve();
    cleanup();
    expect(plugin.remove).toHaveBeenCalledTimes(1);
  });

  it('removes the listener even if cleanup runs before registration finishes', async () => {
    platform.native = true;
    const cleanup = installAndroidBack();
    cleanup(); // before the promise has settled
    await Promise.resolve();
    await Promise.resolve();
    expect(plugin.remove).toHaveBeenCalledTimes(1);
  });

  it('does not throw if the listener cannot be added', async () => {
    platform.native = true;
    plugin.addListener.mockRejectedValue(new Error('no plugin'));
    expect(() => installAndroidBack()).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });
});
