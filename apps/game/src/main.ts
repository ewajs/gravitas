import { contactFacts } from '@gravitas/engine';
import type { Viewport } from '@gravitas/viewport';
import {
  registerUi,
  setLocale,
  viewportMessages,
  type FlightRequest,
  type Locale,
  type LocaleRequest,
} from '@gravitas/ui';
import { KeyboardControls, type KeyCommand } from './controls';
import { ATTITUDE, CENTER_OF_MASS_HEIGHT, FEET, LANDER } from './lander';
import { landingReport } from './report';
import { LANDING_LIMITS } from './rules';
import { ENVIRONMENT, START_STATE } from './scenario';
import { FlightSession } from './session';
import { flightTelemetry } from './telemetry';
import './style.css';

/** Instruments refresh at 10 Hz; phase changes publish immediately. */
const TELEMETRY_INTERVAL_MS = 100;

registerUi();
const host = document.querySelector<HTMLDivElement>('#viewport')!;
const hud = document.querySelector('gravitas-flight-hud')!;
const parameters = new URLSearchParams(location.search);
const session = new FlightSession({
  start: START_STATE,
  vehicle: LANDER,
  attitude: ATTITUDE,
  environment: ENVIRONMENT,
  limits: LANDING_LIMITS,
});
const keyboard = new KeyboardControls(window, keyCommand);
let viewport: Viewport | undefined;
let frame: number | undefined;
let lastFrame: number | undefined;
let lastPublished = -Infinity;
let stopped = false;
let destroyed = false;

hud.heading = 'Gravitas';
publish();

// Presentation only: how far each foot is pressed into the surface, in artwork order.
function legCompression(): number[] {
  return contactFacts(session.state, FEET, ENVIRONMENT.surface!).map((fact) => fact.penetration);
}

// HUD reactivity receives a small snapshot; the session's per-tick state stays outside Lit.
function publish(): void {
  hud.phase = session.phase;
  hud.report = landingReport(session);
  hud.telemetry = flightTelemetry(session.state, session.throttle);
}

function draw(timestamp: number): void {
  frame = undefined;
  if (stopped || document.hidden || !host.clientWidth || !host.clientHeight) return;
  const elapsed = lastFrame === undefined ? 0 : (timestamp - lastFrame) / 1000;
  lastFrame = timestamp;
  try {
    const phase = session.phase;
    session.advance(elapsed, keyboard.sample());
    viewport?.setVehiclePose(session.state, session.previous);
    viewport?.setLegCompression(legCompression());
    viewport?.render(session.alpha);
    // Keep instruments live while a crash plays out after the verdict, too.
    const moving = session.phase === 'flying' || session.phase === 'complete';
    const due = moving && timestamp - lastPublished >= TELEMETRY_INTERVAL_MS;
    if (due || session.phase !== phase) {
      publish();
      lastPublished = timestamp;
    }
    frame = requestAnimationFrame(draw);
  } catch (error) {
    fail(error);
  }
}

function resume(): void {
  if (viewport?.backend && frame === undefined && !stopped && !document.hidden) {
    // Time while not drawing (hidden, zero-size) never becomes simulation time.
    lastFrame = undefined;
    frame = requestAnimationFrame(draw);
  }
}

const sizeObserver = new ResizeObserver(resume);

function flightAction(action: FlightRequest['action'] | 'toggle'): void {
  if (action === 'toggle') {
    // After a verdict, P does nothing; restart (Enter or the button) starts over.
    const toggled = { ready: 'start', flying: 'pause', paused: 'resume', complete: undefined };
    const next = toggled[session.phase] as FlightRequest['action'] | undefined;
    if (!next) return;
    action = next;
  }
  if (action === 'start') session.start();
  else if (action === 'resume') session.resume();
  else if (action === 'pause') {
    session.pause();
    keyboard.clear();
  } else if (action === 'restart') {
    session.restart();
    keyboard.clear();
    // The vehicle teleports back to the opening; do not ease the camera across it.
    viewport?.setVehiclePose(session.state);
    viewport?.resetCamera();
  }
  publish();
}

function keyCommand(command: KeyCommand): void {
  if (stopped) return;
  flightAction(command === 'toggle-pause' ? 'toggle' : 'restart');
}

function flightRequested(event: Event): void {
  const action = (event as CustomEvent<FlightRequest>).detail?.action;
  if (stopped || !['start', 'pause', 'resume', 'restart'].includes(action)) return;
  flightAction(action);
}

// Losing focus never leaves a key "held": the matching keyup may never arrive.
function windowBlurred(): void {
  keyboard.clear();
}

function stopRendering(): void {
  stopped = true;
  delete host.dataset.backend;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  session.pause();
  keyboard.dispose();
  sizeObserver.disconnect();
  document.removeEventListener('visibilitychange', visibilityChanged);
  void viewport
    ?.dispose()
    .catch((error: unknown) => console.error('[viewport] Cleanup failed', error));
}

function destroy(): void {
  destroyed = true;
  stopRendering();
  hud.removeEventListener('locale-request', localeRequested);
  hud.removeEventListener('flight-request', flightRequested);
  window.removeEventListener('blur', windowBlurred);
  window.removeEventListener('pagehide', pageHidden);
}

function fail(error: unknown): void {
  stopRendering();
  hud.status = 'failed';
  console.error('[viewport] Initialization or rendering failed', error);
}

function visibilityChanged(): void {
  if (document.hidden) {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    // A hidden tab pauses the flight; the player resumes deliberately.
    flightAction('pause');
  } else resume();
}

function pageHidden(event: PageTransitionEvent): void {
  // A bfcache visit resumes the same instance; ordinary page exit releases it.
  if (!event.persisted) destroy();
}

async function changeLocale(locale: Locale, updateUrl: boolean): Promise<void> {
  hud.localePending = true;
  hud.localeError = false;
  try {
    await setLocale(locale);
    if (destroyed) return;
    hud.locale = locale;
    // The manual is a separate static build under the same base: /manual/ or /manual/en/.
    hud.manualHref = `${import.meta.env.BASE_URL}manual/${locale === 'en' ? 'en/' : ''}`;
    document.documentElement.lang = locale;
    if (viewport && !stopped) viewport.setLabel(viewportMessages().scene);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('lang', locale);
      history.replaceState(null, '', url);
    }
  } catch {
    // Translation download failure leaves the scene and previous language usable.
    if (!destroyed) hud.localeError = true;
  } finally {
    if (!destroyed) hud.localePending = false;
  }
}

function localeRequested(event: Event): void {
  const locale = (event as CustomEvent<LocaleRequest>).detail?.locale;
  if (hud.localePending || (locale !== 'es-AR' && locale !== 'en')) return;
  void changeLocale(locale, true);
}

hud.addEventListener('locale-request', localeRequested);
hud.addEventListener('flight-request', flightRequested);
window.addEventListener('blur', windowBlurred);
window.addEventListener('pagehide', pageHidden);

async function start(): Promise<void> {
  await changeLocale(parameters.get('lang') === 'en' ? 'en' : 'es-AR', false);
  if (destroyed) return;
  const { Viewport } = await import('@gravitas/viewport');
  if (destroyed) return;
  viewport = new Viewport({
    container: host,
    centerOfMassHeight: CENTER_OF_MASS_HEIGHT,
    label: viewportMessages().scene,
    backend: parameters.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
  });
  viewport.setVehiclePose(session.state);
  await viewport.init();
  if (destroyed) return;
  host.dataset.backend = viewport.backend!;
  hud.status = 'ready';
  sizeObserver.observe(host);
  document.addEventListener('visibilitychange', visibilityChanged);
  resume();
}

void start().catch((error: unknown) => {
  if (!destroyed) fail(error);
});
import.meta.hot?.dispose(destroy);
