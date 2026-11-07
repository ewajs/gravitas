import { contactFacts } from '@gravitas/engine';
import type { Viewport } from '@gravitas/viewport';
import {
  registerUi,
  setLocale,
  viewportMessages,
  type FlightRequest,
  type Locale,
  type LocaleRequest,
  type SoundRequest,
} from '@gravitas/ui';
import { FlightAudio } from './audio';
import { DiagnosticsOverlay } from './diagnostics';
import { KeyboardControls, type KeyCommand } from './controls';
import { CENTER_OF_MASS_HEIGHT, FEET } from './lander';
import { landingReport } from './report';
import { ENVIRONMENT, FIRST_DESCENT } from './scenario';
import { FlightSession, isVerdict } from './session';
import { browserStorage, loadSettings, saveSettings, type Settings } from './settings';
import { flightTelemetry } from './telemetry';
import './style.css';

/** Instruments refresh at 10 Hz; phase changes publish immediately. */
const TELEMETRY_INTERVAL_MS = 100;

registerUi();
const host = document.querySelector<HTMLDivElement>('#viewport')!;
const hud = document.querySelector('gravitas-flight-hud')!;
const parameters = new URLSearchParams(location.search);
const session = new FlightSession(FIRST_DESCENT);
const keyboard = new KeyboardControls(window, keyCommand);
const storage = browserStorage();
let settings: Settings = loadSettings(storage);
// Context state changes asynchronously; mirror it for observability (and tests).
const audio = new FlightAudio(settings.muted, (state) => {
  if (!stopped) host.dataset.audio = state;
});
let viewport: Viewport | undefined;
let frame: number | undefined;
let lastFrame: number | undefined;
let lastPublished = -Infinity;
let stopped = false;
let destroyed = false;
let lastOutcome = session.outcome.status;
// Developer diagnostics only behind an explicit ?debug switch; zero cost otherwise.
const diagnostics = parameters.has('debug')
  ? new DiagnosticsOverlay(document.querySelector('main')!)
  : undefined;

hud.heading = 'Gravitas';
hud.muted = settings.muted;
hud.showControls = !settings.controlsSeen;
publish();

// Settings change rarely and are saved only then, never per frame.
function updateSettings(changes: Partial<Settings>): void {
  settings = { ...settings, ...changes };
  saveSettings(storage, settings);
}

// Sound follows the flight: running while flying (or a crash plays out), else suspended.
// A hidden tab is always silent, including while a crash plays out after a verdict.
function syncAudio(): void {
  if (stopped) return;
  audio.setActive(!document.hidden && (session.phase === 'flying' || session.phase === 'complete'));
  host.dataset.audio = audio.state;
}

// Browsers allow audio only after a gesture; the first key or click unlocks it.
function unlockAudio(): void {
  if (stopped) return;
  audio.unlock();
  syncAudio();
  window.removeEventListener('keydown', unlockAudio, true);
  window.removeEventListener('pointerdown', unlockAudio, true);
}

function setMuted(muted: boolean): void {
  // After a graphics failure the preference still saves; there is no audio to change.
  if (!stopped) audio.setMuted(muted);
  hud.muted = muted;
  updateSettings({ muted });
  syncAudio();
}

// Touchdown thud and verdict cue, from outcome transitions.
function soundEvents(): void {
  const outcome = session.outcome;
  if (lastOutcome === 'airborne' && outcome.status !== 'airborne') {
    const touchdown = 'touchdown' in outcome ? outcome.touchdown : null;
    audio.touchdown(touchdown ? touchdown.verticalSpeed : 2);
  }
  if (outcome.status !== lastOutcome && isVerdict(outcome)) audio.cue(outcome.status);
  lastOutcome = outcome.status;
}

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
    const workStart = diagnostics ? performance.now() : 0;
    const phase = session.phase;
    session.advance(elapsed, keyboard.sample());
    viewport?.setVehiclePose(session.state, session.previous);
    viewport?.setLegCompression(legCompression());
    viewport?.setActuators(session.actuation);
    viewport?.render(session.alpha);
    audio.update(session.actuation);
    soundEvents();
    if (diagnostics) {
      const now = performance.now();
      diagnostics.record({ interval: elapsed * 1000, work: now - workStart }, now, () => ({
        backend: viewport?.backend ?? 'none',
        phase: session.phase,
        ticks: session.ticks,
        discardedSeconds: session.discardedSeconds,
        alpha: session.alpha,
        drawCalls: viewport?.renderStats?.drawCalls ?? 0,
        triangles: viewport?.renderStats?.triangles ?? 0,
      }));
    }
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
  // Starting or resuming begins timing at the next frame: wall time before it (such
  // as the first gesture creating the audio context) is never simulated.
  if (action === 'start' || action === 'resume') lastFrame = undefined;
  if (action === 'start') {
    session.start();
    // Seen once is enough: later visits start without the card (Help keeps the keys).
    if (!settings.controlsSeen) updateSettings({ controlsSeen: true });
  } else if (action === 'resume') session.resume();
  else if (action === 'pause') {
    session.pause();
    keyboard.clear();
  } else if (action === 'restart') {
    session.restart();
    keyboard.clear();
    // The vehicle teleports back to the opening; do not ease the camera across it.
    viewport?.setVehiclePose(session.state);
    viewport?.resetCamera();
    lastOutcome = session.outcome.status;
  }
  hud.showControls = !settings.controlsSeen;
  syncAudio();
  publish();
}

function keyCommand(command: KeyCommand): void {
  if (stopped) return;
  if (command === 'toggle-mute') setMuted(!settings.muted);
  else flightAction(command === 'toggle-pause' ? 'toggle' : 'restart');
}

function soundRequested(event: Event): void {
  const muted = (event as CustomEvent<SoundRequest>).detail?.muted;
  if (typeof muted === 'boolean') setMuted(muted);
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
  audio.dispose();
  diagnostics?.dispose();
  window.removeEventListener('keydown', unlockAudio, true);
  window.removeEventListener('pointerdown', unlockAudio, true);
  delete host.dataset.audio;
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
  hud.removeEventListener('sound-request', soundRequested);
  window.removeEventListener('keydown', unlockAudio, true);
  window.removeEventListener('pointerdown', unlockAudio, true);
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
  } else {
    resume();
    syncAudio();
  }
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
      updateSettings({ locale });
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
hud.addEventListener('sound-request', soundRequested);
// Capture phase: unlock before any handler, including the first flight key.
window.addEventListener('keydown', unlockAudio, true);
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('blur', windowBlurred);
window.addEventListener('pagehide', pageHidden);

async function start(): Promise<void> {
  // An explicit ?lang= wins; otherwise the last language chosen here; else Spanish.
  const requested = parameters.get('lang');
  const initial =
    requested === 'en' || requested === 'es-AR' ? requested : (settings.locale ?? 'es-AR');
  await changeLocale(initial, false);
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
