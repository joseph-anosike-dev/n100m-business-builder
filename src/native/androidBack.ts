import { App } from '@capacitor/app';
import { resolveBack } from '../app/backBehaviour';
import { currentPath, replaceRoute } from '../app/router';
import { isNativeApp } from './platform';

/** Close the topmost open modal (the More sheet). Returns true if one was open. */
function closeOpenDialog(): boolean {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  const top = dialogs[dialogs.length - 1];
  if (!top) return false;
  top.close(); // fires the dialog's close event, which updates React state
  return true;
}

function handleBack(): void {
  if (closeOpenDialog()) return;
  const action = resolveBack(currentPath());
  if (action.kind === 'exit') {
    void App.exitApp();
  } else {
    // Replace, not push: back should not grow the history stack.
    replaceRoute(action.to);
  }
}

/**
 * Take over the Android hardware/gesture back button. Does nothing in a
 * browser, so the web app keeps the browser's own back behaviour.
 * Returns a function that removes the listener.
 */
export function installAndroidBack(): () => void {
  if (!isNativeApp()) return () => {};

  let removed = false;
  let remove: (() => void) | undefined;

  App.addListener('backButton', handleBack)
    .then((handle) => {
      if (removed) void handle.remove();
      else remove = () => void handle.remove();
    })
    .catch(() => {
      /* Listener could not be added: Android keeps its default back action. */
    });

  return () => {
    removed = true;
    remove?.();
  };
}
