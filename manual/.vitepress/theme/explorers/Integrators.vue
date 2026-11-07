<script setup lang="ts">
// Euler against RK4 on a 1 Hz spring: step size controls how far each drifts.
import { computed, ref } from 'vue';
import LinePlot from '../LinePlot.vue';
import { convergence, integrators } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const step = ref(0.02);
const run = computed(() => integrators(step.value));
const slopes = convergence();
// Scientific notation with a superscript exponent: 1.5 × 10⁻³ (locale decimal mark).
const superscript = (n: number) =>
  String(n)
    .replace('-', '⁻')
    .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
const sci = (v: number) => {
  if (v === 0) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(v)));
  return `${format(v / 10 ** exponent, 1)} × 10${superscript(exponent)}`;
};
const t = computed(() =>
  english.value
    ? {
        title: 'Explore: Euler against RK4',
        step: 'Time step',
        euler: 'Euler',
        rk4: 'RK4',
        exact: 'Exact',
        eulerError: 'Euler error after 3 s',
        rk4Error: 'RK4 error after 3 s',
        plot: 'A spring bouncing once per second',
        convergence: 'Error after 1 s against step size (log scales)',
        time: 'Time',
        position: 'Position',
        stepAxis: 'Step size (s)',
        error: 'Error',
        game: 'The game steps at 1/60 s ≈ 0.017 s.',
      }
    : {
        title: 'Explorá: Euler contra RK4',
        step: 'Paso de tiempo',
        euler: 'Euler',
        rk4: 'RK4',
        exact: 'Exacta',
        eulerError: 'Error de Euler a los 3 s',
        rk4Error: 'Error de RK4 a los 3 s',
        plot: 'Un resorte que oscila una vez por segundo',
        convergence: 'Error a 1 s según el tamaño del paso (escalas logarítmicas)',
        time: 'Tiempo',
        position: 'Posición',
        stepAxis: 'Paso (s)',
        error: 'Error',
        game: 'El juego avanza en pasos de 1/60 s ≈ 0,017 s.',
      },
);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.step }}: <output>{{ format(step, 3) }} s</output></span
        >
        <input v-model.number="step" type="range" min="0.005" max="0.1" step="0.005" />
      </label>
    </div>
    <dl class="explorer-stats">
      <div>
        <dt>{{ t.eulerError }}</dt>
        <dd data-testid="euler-error">{{ sci(run.eulerError) }}</dd>
      </div>
      <div>
        <dt>{{ t.rk4Error }}</dt>
        <dd data-testid="rk4-error">{{ sci(run.rk4Error) }}</dd>
      </div>
    </dl>
    <LinePlot
      :title="t.plot"
      :series="[
        { id: 'exact', label: t.exact, slot: 3, points: run.exact },
        { id: 'euler', label: t.euler, slot: 2, points: run.euler },
        { id: 'rk4', label: t.rk4, slot: 1, points: run.rk4, style: 'dots' },
      ]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.position} (m)`"
      x-unit="s"
      y-unit="m"
      :digits="2"
      :y-min="-3"
      :y-max="3"
    />
    <LinePlot
      :title="t.convergence"
      :series="[
        { id: 'euler', label: t.euler, slot: 2, points: slopes.euler },
        { id: 'rk4', label: t.rk4, slot: 1, points: slopes.rk4 },
      ]"
      :x-label="t.stepAxis"
      :y-label="t.error"
      :log-ticks="true"
      :digits="1"
    />
    <p class="explorer-note">{{ t.game }}</p>
  </section>
</template>
