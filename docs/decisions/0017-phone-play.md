# 0017. Phone play: landscape flight, no page zoom, clear thumb zones

- Status: Implemented in 4.4a; checks on the owner's phones follow deployment.
- Date: 2026-11-07

## Context

Step 4.3 gave the game touch controls. On 2026-11-07 the owner decided that
flight is landscape-only with a rotate prompt, that pinch zoom and double-tap
zoom are blocked, and that the test devices are an iPhone 15 Pro and a Samsung
Galaxy A70. Phones are tested on the deployed site after merging, so the layout
has to be right in emulation and easy to diagnose on device.

## Decision

- **Landscape flight, any-orientation menus.** A phone or tablet is a device
  whose primary pointer is coarse and cannot hover. In portrait, while a flight is
  under way (flying or paused), the game sets the HUD's `rotatePrompt` and pauses.
  The prompt covers the scene below the header, so language, sound, and Help stay
  usable. Turning back hides it and leaves the flight paused, as after a hidden
  tab: the player resumes with the thumbs in place. The start card, Help, and the
  results card work upright. No Screen Orientation lock: browsers allow it only
  in fullscreen, and an installed app declares landscape in its manifest (4.4b).
- **No page zoom, three layers.** The viewport meta tag sets `maximum-scale=1,
user-scalable=no` (honoured by Android Chrome). CSS gives the page
  `touch-action: manipulation` (no double-tap zoom) and the game surface
  `touch-action: none` (no pan or pinch), with no overscroll, selection, or
  callout. iOS Safari ignores `user-scalable=no` for accessibility, so `zoom.ts`
  cancels its proprietary `gesturestart/change/end` events and the second tap of
  a double tap outside interactive elements, only when the event is cancelable.
  The 3D view's own pinch (camera zoom) uses pointer events and keeps working;
  Help and the results card still scroll inside themselves.
- **Clear thumb zones.** When the touch controls show, the HUD reflects
  `touch-controls`: the readouts become one strip along the top left, the radar
  and pad distance sit between the thumbs at the bottom, and the throttle gauge
  gives way to the lever, which already shows throttle and hover. The safe-sink
  scale and fuel bar give way too (the amber caution on vertical speed remains).
- **Edge to edge.** `viewport-fit=cover`, and every layer offsets by
  `env(safe-area-inset-*)`: the notch side in landscape and the home indicator.
- **Short screens without touch** (a short laptop window, or a phone with touch
  controls set to Never): the start card shows without the instruments behind it,
  and the results card puts its checks in a second column.

## Alternatives

- **Rotate the page with CSS in portrait** (draw landscape sideways): keeps
  flying possible upright but fights the OS (keyboard, notch, status bar) and
  every coordinate the touch controls compute.
- **A portrait flight layout:** possible, but thumbs would cover the scene, and
  the owner chose landscape.
- **Only `user-scalable=no`:** not enough on iOS.
- **Auto-resume after rotating back:** convenient, but the lander would move
  while the player is still re-gripping the phone.

## Consequences and revisit conditions

- Glass blur stays on by default on phones; Help's "Reduce transparency" turns it
  off. The `?debug` overlay now names the screen size and pixel ratio,
  orientation, input device, touch controls, and whether panels are glass or
  solid, so the owner can measure on device.
- iOS Safari edge gestures (home indicator, back swipe) belong to the system;
  they can cancel a touch, which the touch controls release cleanly.
- Revisit if on-device checks show the zones are too small or too large, if the
  blur costs too much on the A70, or if a portrait layout is wanted later.
