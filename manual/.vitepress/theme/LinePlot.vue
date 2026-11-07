<script setup lang="ts">
// One-axis line plot for the Learn explorers. Formula curves draw as 2px lines,
// engine samples as dots; a legend appears for two or more series and sparse end
// labels name each series. A crosshair tooltip lists every series at the hovered x
// (pointer or arrow keys), and a table view keeps every value reachable.
import { computed, ref, useId } from 'vue';
import { clamp } from '@gravitas/engine';
import { niceTicks, type Point } from '../learn/models';
import { useLocale } from './locale';
import { superscript } from './notation';

export interface Series {
  readonly id: string;
  readonly label: string;
  /** Categorical slot 1–3 (blue, orange, aqua), fixed per meaning. */
  readonly slot: 1 | 2 | 3;
  readonly points: readonly Point[];
  /** `dots` for engine samples, `line` (default) for formulas. */
  readonly style?: 'line' | 'dots';
}
export interface Marker {
  readonly x: number;
  readonly label: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    series: readonly Series[];
    xLabel: string;
    yLabel: string;
    xUnit?: string;
    yUnit?: string;
    digits?: number;
    /** Ticks show 10^k when the data is log₁₀ already. */
    logTicks?: boolean;
    markers?: readonly Marker[];
    yMin?: number;
    yMax?: number;
  }>(),
  { xUnit: '', yUnit: '', digits: 1, logTicks: false, markers: () => [] },
);

const { english, format } = useLocale();
const W = 640;
const H = 280;
const M = { left: 56, right: 92, top: 12, bottom: 44 };

const all = computed(() => props.series.flatMap((s) => s.points));
const xDomain = computed(() => {
  const xs = all.value.map((p) => p[0]);
  return [Math.min(...xs), Math.max(...xs)] as const;
});
const yDomain = computed(() => {
  const ys = all.value.map((p) => p[1]);
  let lo = props.yMin ?? Math.min(...ys);
  let hi = props.yMax ?? Math.max(...ys);
  if (props.yMin === undefined && lo > 0 && !props.logTicks) lo = 0;
  if (props.yMax === undefined && hi < 0 && !props.logTicks) hi = 0;
  if (hi - lo < 1e-9) hi = lo + 1;
  // Snap outward to whole tick steps so the frame starts and ends on labelled values.
  const ticks = niceTicks(lo, hi, 5);
  const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
  return [Math.floor(lo / step + 1e-9) * step, Math.ceil(hi / step - 1e-9) * step] as const;
});
// Coordinates round to 0.1 px: Math functions can differ in the last bit between
// the build (Node) and the browser, and unrounded values would break hydration.
const round = (v: number) => Math.round(v * 10) / 10;
const x = (v: number) =>
  round(
    M.left +
      ((v - xDomain.value[0]) / (xDomain.value[1] - xDomain.value[0] || 1)) *
        (W - M.left - M.right),
  );
const y = (v: number) =>
  round(
    H -
      M.bottom -
      ((v - yDomain.value[0]) / (yDomain.value[1] - yDomain.value[0])) * (H - M.top - M.bottom),
  );
const xTicks = computed(() =>
  props.logTicks
    ? niceTicks(xDomain.value[0], xDomain.value[1], 4).filter(Number.isInteger)
    : niceTicks(xDomain.value[0], xDomain.value[1], 6),
);
const yTicks = computed(() =>
  props.logTicks
    ? niceTicks(yDomain.value[0], yDomain.value[1], 5).filter(Number.isInteger)
    : niceTicks(yDomain.value[0], yDomain.value[1], 5),
);
const tickText = (v: number, log: boolean, digits: number) =>
  log ? `10${superscript(v)}` : format(v, digits);
// Values shown as text. On log axes the data is log₁₀ already, so show the real
// quantity in scientific notation (3.2 × 10⁻⁵), never the bare exponent.
const valueText = (v: number) => {
  if (!props.logTicks) return format(v, props.digits);
  let exponent = Math.floor(v);
  let mantissa = Math.round(10 ** (v - exponent) * 10) / 10;
  if (mantissa >= 10) {
    mantissa /= 10; // 9.96 rounds to 10.0: show 1.0 × 10ⁿ⁺¹ instead.
    exponent += 1;
  }
  return `${format(mantissa, 1)} × 10${superscript(exponent)}`;
};
// Decimals needed to tell ticks apart: 0.025 steps need three, 0.5 steps one.
const tickDigits = (ticks: readonly number[]) => {
  for (let digits = 0; digits < 3; digits++) {
    const scale = 10 ** digits;
    if (ticks.every((t) => Math.abs(t * scale - Math.round(t * scale)) < 1e-9)) return digits;
  }
  return 3;
};

// Dots stay countable: draw at most ~50 per series (tooltip and table keep every sample).
const sparse = (points: readonly Point[]) => {
  const every = Math.max(1, Math.ceil(points.length / 50));
  return points.filter((_, i) => i % every === 0 || i === points.length - 1);
};
const path = (points: readonly Point[]) =>
  points.map(([px, py], i) => `${i ? 'L' : 'M'}${x(px).toFixed(1)},${y(py).toFixed(1)}`).join('');

/** Linear interpolation of a series at x (clamped to its range). */
function valueAt(unsorted: readonly Point[], at: number): number | undefined {
  // Lookups need ascending x; series may be sampled in either direction.
  const points = [...unsorted].sort((a, b) => a[0] - b[0]);
  if (points.length === 0) return undefined;
  if (at <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    if (at <= x1) {
      const [x0, y0] = points[i - 1]!;
      return x1 === x0 ? y1 : y0 + ((y1 - y0) * (at - x0)) / (x1 - x0);
    }
  }
  // At the end within rounding (log10 can differ in the last bit across engines).
  const [lastX, lastY] = points[points.length - 1]!;
  if (at - lastX <= 1e-9 * Math.max(1, Math.abs(lastX))) return lastY;
  return undefined; // Beyond the series' end (e.g. after impact).
}

const hover = ref<number | undefined>(undefined);
// Lines stay inside the frame when a fixed range is narrower than the data. useId
// is identical in the page build and the browser, so hydration matches.
const clipId = `lp-clip-${useId()}`;
const svg = ref<SVGSVGElement>();
function pointer(event: PointerEvent) {
  const box = svg.value!.getBoundingClientRect();
  const px = ((event.clientX - box.left) / box.width) * W;
  const t = (px - M.left) / (W - M.left - M.right);
  hover.value = xDomain.value[0] + clamp(t, 0, 1) * (xDomain.value[1] - xDomain.value[0]);
}
function key(event: KeyboardEvent) {
  const span = xDomain.value[1] - xDomain.value[0];
  const current = hover.value ?? xDomain.value[0];
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    const next = current + (event.key === 'ArrowRight' ? 1 : -1) * (span / 40);
    hover.value = clamp(next, xDomain.value[0], xDomain.value[1]);
    event.preventDefault();
  } else if (event.key === 'Escape') hover.value = undefined;
}
const readout = computed(() =>
  hover.value === undefined
    ? []
    : props.series.map((s) => ({ s, value: valueAt(s.points, hover.value!) })),
);

const color = (slot: 1 | 2 | 3) => `var(--lp-${slot})`;
const summary = computed(() => {
  const parts = props.series.map((s) => {
    const end = s.points[s.points.length - 1];
    return end
      ? `${s.label}: ${valueText(end[1])} ${props.yUnit} ${english.value ? 'at' : 'en'} ${valueText(end[0])} ${props.xUnit}`
      : s.label;
  });
  return `${props.title}. ${parts.join('; ')}.`;
});

// End labels: one per series, nudged apart only by a small minimum gap; when the
// series end too close together the legend and tooltip carry identity instead.
const endLabels = computed(() => {
  const labels = props.series
    .map((s) => {
      // The rightmost point, whichever order the series was sampled in.
      const end = s.points.reduce<Point | undefined>(
        (best, p) => (!best || p[0] > best[0] ? p : best),
        undefined,
      );
      return end ? { id: s.id, text: s.label, x: x(end[0]) + 6, y: y(end[1]) } : undefined;
    })
    .filter((l): l is { id: string; text: string; x: number; y: number } => !!l)
    .sort((a, b) => a.y - b.y);
  const collide = labels.some(
    (l, i) =>
      i > 0 && Math.abs(l.y - labels[i - 1]!.y) < 14 && Math.abs(l.x - labels[i - 1]!.x) < 60,
  );
  return collide ? [] : labels;
});

// Table view: about a dozen rows sampled across x, every series per row.
const table = computed(() => {
  const [lo, hi] = xDomain.value;
  return Array.from({ length: 11 }, (_, i) => {
    const at = lo + ((hi - lo) * i) / 10;
    return { at, values: props.series.map((s) => valueAt(s.points, at)) };
  });
});
const t = computed(() =>
  english.value ? { table: 'Show data as a table' } : { table: 'Ver los datos en una tabla' },
);
</script>

<template>
  <figure class="lp">
    <figcaption class="lp-title">{{ title }}</figcaption>
    <div v-if="series.length > 1" class="lp-legend" aria-hidden="true">
      <span v-for="s in series" :key="s.id">
        <span class="lp-key" :class="s.style" :style="{ background: color(s.slot) }" />{{ s.label }}
      </span>
    </div>
    <svg
      ref="svg"
      :viewBox="`0 0 ${W} ${H}`"
      role="img"
      :aria-label="summary"
      tabindex="0"
      @pointermove="pointer"
      @pointerleave="hover = undefined"
      @keydown="key"
      @blur="hover = undefined"
    >
      <g>
        <line
          v-for="v in yTicks"
          :key="`gy${v}`"
          class="grid"
          :x1="M.left"
          :x2="W - M.right"
          :y1="y(v)"
          :y2="y(v)"
        />
        <line class="axis" :x1="M.left" :x2="W - M.right" :y1="H - M.bottom" :y2="H - M.bottom" />
        <text
          v-for="v in yTicks"
          :key="`ty${v}`"
          class="tick"
          :x="M.left - 8"
          :y="y(v) + 4"
          text-anchor="end"
        >
          {{ tickText(v, logTicks, tickDigits(yTicks)) }}
        </text>
        <text
          v-for="v in xTicks"
          :key="`tx${v}`"
          class="tick"
          :x="x(v)"
          :y="H - M.bottom + 16"
          text-anchor="middle"
        >
          {{ tickText(v, logTicks, tickDigits(xTicks)) }}
        </text>
        <text class="axis-label" :x="(M.left + W - M.right) / 2" :y="H - 6" text-anchor="middle">
          {{ xLabel }}
        </text>
        <text
          class="axis-label"
          :x="14"
          :y="(M.top + H - M.bottom) / 2"
          text-anchor="middle"
          :transform="`rotate(-90 14 ${(M.top + H - M.bottom) / 2})`"
        >
          {{ yLabel }}
        </text>
      </g>
      <g v-for="m in markers" :key="`m${m.x}`">
        <line class="marker" :x1="x(m.x)" :x2="x(m.x)" :y1="M.top" :y2="H - M.bottom" />
        <text class="marker-label" :x="x(m.x) + 4" :y="M.top + 10">{{ m.label }}</text>
      </g>
      <defs>
        <clipPath :id="clipId">
          <rect
            :x="M.left"
            :y="M.top"
            :width="W - M.left - M.right"
            :height="H - M.top - M.bottom"
          />
        </clipPath>
      </defs>
      <g v-for="s in series" :key="s.id" :clip-path="`url(#${clipId})`">
        <path
          v-if="s.style !== 'dots'"
          class="series"
          :d="path(s.points)"
          :style="{ stroke: color(s.slot) }"
        />
        <template v-else>
          <circle
            v-for="(p, i) in sparse(s.points)"
            :key="i"
            class="dot"
            :cx="x(p[0])"
            :cy="y(p[1])"
            r="4"
            :style="{ fill: color(s.slot) }"
          />
        </template>
      </g>
      <text v-for="l in endLabels" :key="`e${l.id}`" class="end-label" :x="l.x" :y="l.y + 4">
        {{ l.text }}
      </text>
      <g v-if="hover !== undefined">
        <line class="crosshair" :x1="x(hover)" :x2="x(hover)" :y1="M.top" :y2="H - M.bottom" />
        <template v-for="r in readout" :key="`h${r.s.id}`">
          <circle
            v-if="r.value !== undefined"
            class="dot"
            :cx="x(hover)"
            :cy="y(r.value)"
            r="5"
            :style="{ fill: color(r.s.slot) }"
          />
        </template>
      </g>
    </svg>
    <div
      v-if="hover !== undefined"
      class="lp-tooltip"
      :style="{ left: `${(x(hover) / W) * 100}%` }"
    >
      <div>
        {{ xLabel }}: <strong>{{ valueText(hover) }} {{ xUnit }}</strong>
      </div>
      <div v-for="r in readout" :key="`r${r.s.id}`" class="row">
        <span class="lp-key" :style="{ background: color(r.s.slot) }" />
        <strong>{{ r.value === undefined ? '—' : `${valueText(r.value)} ${yUnit}` }}</strong>
        <span>{{ r.s.label }}</span>
      </div>
    </div>
    <details class="lp-table">
      <summary>{{ t.table }}</summary>
      <table>
        <thead>
          <tr>
            <th>{{ xLabel }}</th>
            <th v-for="s in series" :key="`th${s.id}`">{{ s.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table" :key="row.at">
            <td>{{ valueText(row.at) }} {{ xUnit }}</td>
            <td v-for="(v, i) in row.values" :key="i">
              {{ v === undefined ? '—' : `${valueText(v)} ${yUnit}` }}
            </td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
