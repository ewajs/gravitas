import type { Viewport } from '@gravitas/viewport';
import { setLocale, viewportMessages } from '@gravitas/ui';
import { INITIAL_POSE } from './fixture';
import './style.css';

const host = document.querySelector<HTMLDivElement>('#viewport')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const subtitle = document.querySelector<HTMLParagraphElement>('#subtitle')!;
const controls = document.querySelector<HTMLParagraphElement>('#controls')!;
const parameters = new URLSearchParams(location.search);
let viewport: Viewport | undefined;
let frame: number | undefined;
let disposed = false;

function draw(): void {
  frame = undefined;
  if (disposed || document.hidden || !host.clientWidth || !host.clientHeight) return;
  try {
    viewport?.render();
    frame = requestAnimationFrame(draw);
  } catch (error) {
    fail(error);
  }
}

function resume(): void {
  if (viewport?.backend && frame === undefined && !disposed && !document.hidden) {
    frame = requestAnimationFrame(draw);
  }
}

const sizeObserver = new ResizeObserver(resume);

function stop(): void {
  disposed = true;
  delete host.dataset.backend;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  sizeObserver.disconnect();
  document.removeEventListener('visibilitychange', visibilityChanged);
  window.removeEventListener('pagehide', pageHidden);
  void viewport
    ?.dispose()
    .catch((error: unknown) => console.error('[viewport] Cleanup failed', error));
}

function fail(error: unknown): void {
  stop();
  status.textContent = viewportMessages().failed;
  status.hidden = false;
  status.setAttribute('role', 'alert');
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
  if (!event.persisted) stop();
}

async function start(): Promise<void> {
  await setLocale(parameters.get('lang') === 'en' ? 'en' : 'es-AR');
  if (disposed) return;
  document.documentElement.lang = parameters.get('lang') === 'en' ? 'en' : 'es-AR';
  const text = viewportMessages();
  subtitle.textContent = text.subtitle;
  controls.textContent = text.controls;
  status.textContent = text.loading;
  const { Viewport } = await import('@gravitas/viewport');
  if (disposed) return;
  viewport = new Viewport({
    container: host,
    label: text.scene,
    backend: parameters.get('backend') === 'webgl2' ? 'webgl2' : 'auto',
  });
  viewport.setVehiclePose(INITIAL_POSE);
  await viewport.init();
  if (disposed) return;
  host.dataset.backend = viewport.backend!;
  status.hidden = true;
  sizeObserver.observe(host);
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener('pagehide', pageHidden);
  resume();
}

void start().catch((error: unknown) => {
  if (!disposed) fail(error);
});
import.meta.hot?.dispose(stop);
