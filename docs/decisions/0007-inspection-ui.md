# 0007. Inspection UI and the shared pose contract

- Status: Implemented in 0.4; visuals await owner review.
- Date: 2026-11-06

## Decision

Move the existing plain `VehiclePose` type from viewport to engine now that both
viewport and UI consume it. Retain viewport's re-export for existing callers.
The contract stays world metres and a normalized body-to-world quaternion;
validation at the renderer boundary stays in viewport. This introduces no
dynamics, clock, rendering dependency, or new state owner in engine.

Use one optional Lit `InspectionHud`, registered explicitly by the app. Its
properties receive branding, a pose snapshot, the pad reference, rendering status,
and committed locale. The HUD calculates horizontal offset and tilt only for
display; it does not decide flight or contact outcomes. The app supplies the same
stationary fixture to viewport and HUD. Future flight updates must send deliberate
presentation snapshots rather than making per-frame simulation state reactive.

Use native select/button/dialog controls. The modal dialog provides focus
containment, Escape, and focus return. CSS custom properties define the theme;
responsive layout, safe-area spacing, visible focus, and 44px controls support
desktop and narrow use. No decorative animation is introduced.

Keep the existing Lit/localize runtime. Components subscribe through
`updateWhenLocaleChanges`, whose Lit controller cleans up when disconnected.
The HUD emits a typed `locale-request`; the app loads translations, then updates
document language, HUD number formatting, URL, and viewport's `setLabel`.
Language requests are serialized while keeping the selector focusable. A failed
translation download preserves the current language and scene and suggests a
reload, since browser module imports may cache failed loads. Rendering failures
remain translatable without remounting the renderer.

## Tradeoffs and revisit conditions

The HUD explicitly describes a stationary inspection scene. Fuel, speed, altitude,
and landing results require the flight/contact models in M1/M2; they are not
invented here to fill instruments. Horizontal pad offset ignores Y; tilt is the
angle between body +Y and world +Y, independent of yaw. Display uses local decimal
formatting, metres, and degrees; the pose retains SI/quaternion data.

The first HUD needs one component and no component-library dependency. Split out
reusable controls when a second real consumer warrants it. Legacy Lit decorator
settings also apply to app/browser-test typechecking because workspaces consume
source directly. The engine's browser-free compilation settings remain unchanged.

See [UI verification](../verification/ui.md) for numerical and local browser checks.
