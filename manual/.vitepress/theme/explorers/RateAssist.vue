<script setup lang="ts">
// The rate assist on one axis: request a turn rate, hold it, release. Shows the
// torque limit (straight ramp), the exponential settle, and the angle left behind.
import { computed, ref } from 'vue';
import LinePlot from '../LinePlot.vue';
import { rateResponse } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const request = ref(1);
const response = ref(0.3);
const r = computed(() => rateResponse(request.value, response.value));
const t = computed(() =>
  english.value
    ? {
        title: 'Explore: the rate assist',
        request: 'Requested rate (fraction of 30°/s)',
        response: 'Response time',
        limit: 'Torque limit as acceleration',
        fuel: 'Attitude fuel used',
        final: 'Angle left behind',
        rates: 'Pitch rate: requested for 1.5 s, then released',
        angle: 'Pitch angle',
        requested: 'Requested',
        actual: 'Actual',
        time: 'Time',
        rate: 'Rate',
        deg: 'Angle',
        note: 'While the request is far away the torque is at its limit: the rate climbs in a straight line. Close to it, the torque shrinks with the gap and the rate settles exponentially. Releasing brakes the turn, but the lander stays tilted.',
      }
    : {
        title: 'Explorá: el asistente de giro',
        request: 'Velocidad pedida (fracción de 30°/s)',
        response: 'Tiempo de respuesta',
        limit: 'Límite de torque como aceleración',
        fuel: 'Combustible de actitud usado',
        final: 'Ángulo que queda',
        rates: 'Velocidad de cabeceo: pedida 1,5 s y después soltada',
        angle: 'Ángulo de cabeceo',
        requested: 'Pedida',
        actual: 'Real',
        time: 'Tiempo',
        rate: 'Velocidad',
        deg: 'Ángulo',
        note: 'Mientras falta mucho, el torque está al límite: la velocidad sube en línea recta. Cerca del objetivo el torque achica con la diferencia y la velocidad se acomoda exponencialmente. Al soltar, el giro frena pero el módulo queda inclinado.',
      },
);
const lastAngle = computed(() => r.value.angle[r.value.angle.length - 1]![1]);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.request }}: <output>{{ format(request, 2) }}</output></span
        >
        <input v-model.number="request" type="range" min="0.1" max="1" step="0.05" />
      </label>
      <label>
        <span
          >{{ t.response }}: <output>{{ format(response, 2) }} s</output></span
        >
        <input v-model.number="response" type="range" min="0.05" max="1" step="0.05" />
      </label>
    </div>
    <dl class="explorer-stats">
      <div>
        <dt>{{ t.limit }}</dt>
        <dd>{{ format(r.limit, 1) }}°/s²</dd>
      </div>
      <div>
        <dt>{{ t.final }}</dt>
        <dd data-testid="final-angle">{{ format(lastAngle, 1) }}°</dd>
      </div>
      <div>
        <dt>{{ t.fuel }}</dt>
        <dd>{{ format(r.fuel * 1000, 0) }} g</dd>
      </div>
    </dl>
    <LinePlot
      :title="t.rates"
      :series="[
        { id: 'request', label: t.requested, slot: 2, points: r.request },
        { id: 'rate', label: t.actual, slot: 1, points: r.rate },
      ]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.rate} (°/s)`"
      x-unit="s"
      y-unit="°/s"
    />
    <LinePlot
      :title="t.angle"
      :series="[{ id: 'angle', label: t.deg, slot: 1, points: r.angle }]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.deg} (°)`"
      x-unit="s"
      y-unit="°"
    />
    <p class="explorer-note">{{ t.note }}</p>
  </section>
</template>
