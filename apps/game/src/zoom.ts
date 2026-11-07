/** Two taps closer than this (ms) are a double tap, which mobile browsers treat as zoom. */
const DOUBLE_TAP_MS = 300;

// Where a tap must keep its default: controls that act on tap. Help's text is not
// exempt, so a double tap on it cannot zoom the page either.
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="slider"]';

/**
 * Keeps phone browsers from zooming the game page. The viewport meta tag
 * (`user-scalable=no`) and `touch-action` in the page's CSS cover Android;
 * iOS Safari ignores `user-scalable=no` for accessibility, so this also cancels
 * its proprietary pinch `gesture*` events and the second tap of a double tap
 * outside interactive elements. The 3D view's own pinch (camera zoom) uses
 * pointer events and is unaffected. Returns a function that removes the listeners.
 */
export function blockPageZoom(target: Document): () => void {
  let lastTouchEnd = -Infinity;
  const cancel = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };
  const touchEnd = (event: TouchEvent) => {
    const now = event.timeStamp;
    const origin = event.composedPath()[0];
    const interactive = origin instanceof Element && origin.closest(INTERACTIVE) !== null;
    const doubleTap = event.touches.length === 0 && now - lastTouchEnd < DOUBLE_TAP_MS;
    // A touchend that ends a scroll or pinch cannot be cancelled; leave it alone.
    if (doubleTap && !interactive && event.cancelable) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  };
  const gestures = ['gesturestart', 'gesturechange', 'gestureend'] as const;
  for (const type of gestures) target.addEventListener(type, cancel, { passive: false });
  target.addEventListener('touchend', touchEnd, { passive: false });
  return () => {
    for (const type of gestures) target.removeEventListener(type, cancel);
    target.removeEventListener('touchend', touchEnd);
  };
}
