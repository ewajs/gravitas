/** One drawn frame's measurements. */
export interface FrameSample {
  /** Time since the previous frame, in ms (display-paced, so near 16.7 at 60 Hz). */
  readonly interval: number;
  /** Main-thread time spent simulating and submitting this frame, in ms. */
  readonly work: number;
}

/** Summary over a window of recent frames. */
export interface FrameStats {
  readonly fps: number;
  readonly intervalMs: number;
  readonly workP50Ms: number;
  readonly workP95Ms: number;
}

/** Percentile of a list (nearest rank); 0 for an empty list. */
export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[rank]!;
}

/** Summarizes frame samples: mean frame rate from intervals, work percentiles. */
export function frameStats(samples: readonly FrameSample[]): FrameStats {
  const intervals = samples.map((s) => s.interval).filter((value) => value > 0);
  const mean = intervals.reduce((sum, value) => sum + value, 0) / Math.max(1, intervals.length);
  const work = samples.map((s) => s.work);
  return {
    fps: mean > 0 ? 1000 / mean : 0,
    intervalMs: mean,
    workP50Ms: percentile(work, 0.5),
    workP95Ms: percentile(work, 0.95),
  };
}

/** Extra facts shown beside frame statistics; supplied by the app each refresh. */
export interface DiagnosticFacts {
  readonly backend: string;
  readonly phase: string;
  readonly ticks: number;
  readonly discardedSeconds: number;
  readonly alpha: number;
  readonly drawCalls: number;
  readonly triangles: number;
}

const WINDOW = 120;
const REFRESH_MS = 250;

/**
 * Developer overlay behind an explicit `?debug` switch. Records frame samples in a
 * ring and rewrites its text at 4 Hz; no logging, no per-frame DOM writes. The
 * same numbers are mirrored on the element's data attributes for scripted
 * measurement. Not player-facing, so not localized.
 */
export class DiagnosticsOverlay {
  readonly #element: HTMLPreElement;
  readonly #samples: FrameSample[] = [];
  #lastRefresh = -Infinity;

  constructor(parent: HTMLElement) {
    this.#element = document.createElement('pre');
    this.#element.id = 'diagnostics';
    this.#element.setAttribute('aria-hidden', 'true');
    Object.assign(this.#element.style, {
      position: 'absolute',
      top: '8px',
      left: '50%',
      transform: 'translateX(-50%)',
      margin: '0',
      padding: '6px 10px',
      font: '11px/1.4 ui-monospace, monospace',
      color: '#9fe0a8',
      background: '#020609cc',
      borderRadius: '6px',
      pointerEvents: 'none',
      zIndex: '10',
    });
    parent.append(this.#element);
  }

  record(sample: FrameSample, now: number, facts: () => DiagnosticFacts): void {
    this.#samples.push(sample);
    if (this.#samples.length > WINDOW) this.#samples.shift();
    if (now - this.#lastRefresh < REFRESH_MS) return;
    this.#lastRefresh = now;
    const stats = frameStats(this.#samples);
    const f = facts();
    this.#element.textContent = [
      `${stats.fps.toFixed(1)} fps  ${stats.intervalMs.toFixed(1)} ms/frame  work p50 ${stats.workP50Ms.toFixed(2)} p95 ${stats.workP95Ms.toFixed(2)} ms`,
      `${f.backend}  ${f.drawCalls} draws  ${f.triangles} tris  ${f.phase}  tick ${f.ticks}  α ${f.alpha.toFixed(2)}  dropped ${f.discardedSeconds.toFixed(3)} s`,
    ].join('\n');
    Object.assign(this.#element.dataset, {
      fps: stats.fps.toFixed(2),
      workP50: stats.workP50Ms.toFixed(3),
      workP95: stats.workP95Ms.toFixed(3),
      discarded: f.discardedSeconds.toFixed(4),
      drawCalls: String(f.drawCalls),
      triangles: String(f.triangles),
    });
  }

  dispose(): void {
    this.#element.remove();
  }
}
