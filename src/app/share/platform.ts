/**
 * Whether the client is running on an iOS or Android device.
 *
 * Scoped specifically to Android and iOS so desktop browsers supporting
 * navigator.share (e.g. macOS Safari or Windows Chrome) continue to copy
 * cleanly to the clipboard rather than popping the desktop OS share sheet.
 */
export function isMobilePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return isIOS || isAndroid;
}
