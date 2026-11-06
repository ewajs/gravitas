import type { Viewport } from '@gravitas/viewport';
import {
  registerUi,
  setLocale,
  viewportMessages,
  type Locale,
  type LocaleRequest,
} from '@gravitas/ui';
import { INITIAL_POSE, PAD_POSITION } from './fixture';
import './style.css';

registerUi();
const host = document.querySelector<HTMLDivElement>('#viewport')!;
const hud = document.querySelector('gravitas-inspection-hud')!;
const parameters = new URLSearchParams(location.search);
let viewport: Viewport | undefined;
let frame: number | undefined;
let stopped = false;
let destroyed = false;

// The app supplies the same immutable pose to presentation consumers. There is no simulation yet.
hud.heading = 'Gravitas';
hud.pose = INITIAL_POSE;
hud.padPosition = PAD_POSITION;

function draw(): void {
  frame = undefined;
  if (stopped || document.hidden || !host.clientWidth || !host.clientHeight) return;
  try {
    viewport?.render();
    frame = requestAnimationFrame(draw);
  } catch (error) {
    fail(error);
  }
}

function resume(): void {
  if (viewport?.backend && frame === undefined && !stopped && !document.hidden) {
    frame = requestAnimationFrame(draw);
  }
}

const sizeObserver = new ResizeObserver(resume);

function stopRendering(): void {
  stopped = true;
  delete host.dataset.backend;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
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
window.addEventListener('pagehide', pageHidden);

async function start(): Promise<void> {
  await changeLocale(parameters.get('lang') === 'en' ? 'en' : 'es-AR', false);
  if (destroyed) return;
  const { Viewport } = await import('@gravitas/viewport');
  if (destroyed) return;
  viewport = new Viewport({
    container: host,
    label: viewportMessages().scene,
    backend: parameters.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
  });
  viewport.setVehiclePose(INITIAL_POSE);
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
