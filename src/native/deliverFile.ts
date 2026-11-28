import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { bytesToBase64 } from '../backup/zip';
import { isNativeApp } from './platform';

/**
 * Hand a file to the user. On Android: write it to the app's cache folder and open the system share
 * sheet (Drive, WhatsApp, Files, ...). In a browser: a normal download. Rejects if it cannot do either.
 *
 * The share sheet does not tell us whether the user finished saving, so success here means "handed
 * over", not "stored somewhere". The UI words it that way. The cache copy is left to the OS to clear.
 */
export async function deliverFile(
  bytes: Uint8Array,
  filename: string,
  mediaType = 'application/zip',
  dialogTitle = 'Save your backup',
): Promise<void> {
  if (isNativeApp()) {
    const can = await Share.canShare();
    if (!can.value) throw new Error('Sharing is not available on this device.');
    const written = await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    });
    await Share.share({ title: filename, dialogTitle, url: written.uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mediaType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
