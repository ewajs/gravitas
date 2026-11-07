/** Optional Lit flight HUD, touch controls, and localization. @module */
export { setLocale, viewportMessages, type Locale } from './localization';
export { FlightHud, registerUi } from './flight-hud';
export { TouchControls } from './touch-controls';
export type {
  AppearanceRequest,
  FlightPhase,
  FlightRequest,
  FlightTelemetry,
  InputDevice,
  LandingCheck,
  LandingReport,
  LeverInput,
  RadarVector,
  LocaleRequest,
  SoundRequest,
  StickInput,
  TouchControlsMode,
  YawInput,
} from './types';
