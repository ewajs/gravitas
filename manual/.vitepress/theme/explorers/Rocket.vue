<script setup lang="ts">
// The lander's engine: throttle, fuel loaded, and tilt set the forces; the rocket
// equation and the engine agree on the climb. A small figure splits the thrust.
import { computed, ref } from 'vue';
import { toRadians } from '@gravitas/engine';
import LinePlot from '../LinePlot.vue';
import { rocket } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const throttle = ref(0.8);
const fuel = ref(60);
const tilt = ref(0);
const r = computed(() => rocket(throttle.value, fuel.value, tilt.value));
const percent = (v: number) => `${format(v * 100, 0)} %`;
// Thrust-vector figure: arrow along the tilted axis, split into components.
const figure = computed(() => {
  const a = toRadians(tilt.value);
  const length = 70 * throttle.value;
  return {
    tip: { x: 90 + length * Math.sin(a), y: 100 - length * Math.cos(a) },
    up: { x: 90, y: 100 - length * Math.cos(a) },
    side: { x: 90 + length * Math.sin(a), y: 100 },
    body: `rotate(${tilt.value} 90 100)`,
  };
});
const t = computed(() =>
  english.value
    ? {
        title: 'Explore: thrust, mass, and leaning',
        throttle: 'Throttle',
        fuel: 'Fuel loaded',
        tilt: 'Tilt from vertical',
        mass: 'Mass',
        hover: 'Throttle to hover',
        vertical: 'Vertical acceleration',
        horizontal: 'Sideways acceleration',
        burn: 'Burn time',
        dv: 'Δv in the tank',
        plot: 'Vertical speed from rest, burning steadily',
        formula: 'Rocket equation',
        engine: 'Gravitas engine',
        time: 'Time',
        speed: 'Vertical speed',
        figure:
          'Thrust splits into a vertical part that fights gravity and a sideways part that pushes you along.',
        none: 'never',
      }
    : {
        title: 'Explorá: empuje, masa e inclinación',
        throttle: 'Empuje',
        fuel: 'Combustible cargado',
        tilt: 'Inclinación desde la vertical',
        mass: 'Masa',
        hover: 'Empuje para flotar',
        vertical: 'Aceleración vertical',
        horizontal: 'Aceleración de costado',
        burn: 'Tiempo de motor',
        dv: 'Δv en el tanque',
        plot: 'Velocidad vertical desde el reposo, con empuje constante',
        formula: 'Ecuación del cohete',
        engine: 'Motor de Gravitas',
        time: 'Tiempo',
        speed: 'Velocidad vertical',
        figure:
          'El empuje se divide en una parte vertical que pelea contra la gravedad y una parte de costado que te desplaza.',
        none: 'nunca',
      },
);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.throttle }}: <output>{{ percent(throttle) }}</output></span
        >
        <input v-model.number="throttle" type="range" min="0" max="1" step="0.01" />
      </label>
      <label>
        <span
          >{{ t.fuel }}: <output>{{ format(fuel, 0) }} kg</output></span
        >
        <input v-model.number="fuel" type="range" min="5" max="300" step="5" />
      </label>
      <label>
        <span
          >{{ t.tilt }}: <output>{{ format(tilt, 0) }}°</output></span
        >
        <input v-model.number="tilt" type="range" min="0" max="60" step="1" />
      </label>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center">
      <svg viewBox="0 0 180 120" width="180" height="120" role="img" :aria-label="t.figure">
        <line x1="10" y1="110" x2="170" y2="110" class="lp-axis" stroke="var(--lp-axis)" />
        <g :transform="figure.body">
          <rect x="78" y="88" width="24" height="16" rx="3" fill="var(--vp-c-text-3)" />
        </g>
        <line
          x1="90"
          y1="100"
          :x2="figure.up.x"
          :y2="figure.up.y"
          stroke="var(--lp-1)"
          stroke-width="2"
        />
        <line
          x1="90"
          y1="100"
          :x2="figure.side.x"
          :y2="figure.side.y"
          stroke="var(--lp-2)"
          stroke-width="2"
        />
        <line
          x1="90"
          y1="100"
          :x2="figure.tip.x"
          :y2="figure.tip.y"
          stroke="var(--vp-c-text-1)"
          stroke-width="2"
        />
        <circle :cx="figure.tip.x" :cy="figure.tip.y" r="4" fill="var(--vp-c-text-1)" />
      </svg>
      <dl class="explorer-stats" style="flex: 1">
        <div>
          <dt>{{ t.mass }}</dt>
          <dd>{{ format(r.mass, 0) }} kg</dd>
        </div>
        <div>
          <dt>{{ t.hover }}</dt>
          <dd data-testid="hover-throttle">
            {{ r.hoverThrottle > 1 ? '> 100 %' : percent(r.hoverThrottle) }}
          </dd>
        </div>
        <div>
          <dt>{{ t.vertical }}</dt>
          <dd>{{ format(r.vertical, 2) }} m/s²</dd>
        </div>
        <div>
          <dt>{{ t.horizontal }}</dt>
          <dd>{{ format(r.horizontal, 2) }} m/s²</dd>
        </div>
        <div>
          <dt>{{ t.burn }}</dt>
          <dd>{{ Number.isFinite(r.burnTime) ? `${format(r.burnTime, 0)} s` : t.none }}</dd>
        </div>
        <div>
          <dt>{{ t.dv }}</dt>
          <dd>{{ format(r.deltaV, 0) }} m/s</dd>
        </div>
      </dl>
    </div>
    <LinePlot
      :title="t.plot"
      :series="[
        { id: 'formula', label: t.formula, slot: 1, points: r.formula },
        { id: 'engine', label: t.engine, slot: 2, points: r.engine, style: 'dots' },
      ]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.speed} (m/s)`"
      x-unit="s"
      y-unit="m/s"
    />
  </section>
</template>
