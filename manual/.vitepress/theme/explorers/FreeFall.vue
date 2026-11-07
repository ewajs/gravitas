<script setup lang="ts">
// Free fall: drop from a height with an initial vertical speed under a chosen
// gravity. The formula and the Gravitas engine are plotted together.
import { computed, ref } from 'vue';
import LinePlot from '../LinePlot.vue';
import { freeFall, GRAVITY } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const height = ref(80);
const speed = ref(-4);
const world = ref<keyof typeof GRAVITY>('moon');
const result = computed(() => freeFall(height.value, speed.value, GRAVITY[world.value]));
const t = computed(() =>
  english.value
    ? {
        title: 'Explore: falling with no engine',
        height: 'Starting height',
        speed: 'Starting vertical speed (+ up)',
        world: 'Gravity',
        worlds: { moon: 'Moon 1.62 m/s²', mars: 'Mars 3.71 m/s²', earth: 'Earth 9.81 m/s²' },
        impact: 'Time to the ground',
        impactSpeed: 'Speed at the ground',
        heightPlot: 'Height above the ground over time',
        velocityPlot: 'Vertical velocity over time',
        formula: 'Formula',
        engine: 'Gravitas engine',
        velocity: 'Velocity',
        time: 'Time',
        h: 'Height',
        v: 'Velocity',
        ground: 'ground',
        note: 'The game opens at 80 m sinking at 4 m/s on the Moon: left alone, it hits at about 16.6 m/s, far above the 2 m/s limit.',
      }
    : {
        title: 'Explorá: caer sin motor',
        height: 'Altura inicial',
        speed: 'Velocidad vertical inicial (+ arriba)',
        world: 'Gravedad',
        worlds: { moon: 'Luna 1,62 m/s²', mars: 'Marte 3,71 m/s²', earth: 'Tierra 9,81 m/s²' },
        impact: 'Tiempo hasta el suelo',
        impactSpeed: 'Velocidad al llegar',
        heightPlot: 'Altura sobre el suelo en el tiempo',
        velocityPlot: 'Velocidad vertical en el tiempo',
        formula: 'Fórmula',
        engine: 'Motor de Gravitas',
        velocity: 'Velocidad',
        time: 'Tiempo',
        h: 'Altura',
        v: 'Velocidad',
        ground: 'suelo',
        note: 'El juego empieza a 80 m bajando a 4 m/s en la Luna: sin hacer nada, toca el suelo a unos 16,6 m/s, muy por encima del límite de 2 m/s.',
      },
);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.height }}: <output>{{ format(height, 0) }} m</output></span
        >
        <input v-model.number="height" type="range" min="10" max="200" step="5" />
      </label>
      <label>
        <span
          >{{ t.speed }}: <output>{{ format(speed, 1) }} m/s</output></span
        >
        <input v-model.number="speed" type="range" min="-20" max="10" step="0.5" />
      </label>
      <fieldset>
        <legend>{{ t.world }}</legend>
        <label v-for="(label, key) in t.worlds" :key="key" style="display: inline-flex; gap: 4px">
          <input v-model="world" type="radio" name="world" :value="key" />{{ label }}
        </label>
      </fieldset>
    </div>
    <dl class="explorer-stats">
      <div>
        <dt>{{ t.impact }}</dt>
        <dd data-testid="impact-time">{{ format(result.impactTime, 2) }} s</dd>
      </div>
      <div>
        <dt>{{ t.impactSpeed }}</dt>
        <dd data-testid="impact-speed">{{ format(result.impactSpeed, 1) }} m/s</dd>
      </div>
    </dl>
    <LinePlot
      :title="t.heightPlot"
      :series="[
        { id: 'formula', label: t.formula, slot: 1, points: result.formula },
        { id: 'engine', label: t.engine, slot: 2, points: result.engine, style: 'dots' },
      ]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.h} (m)`"
      x-unit="s"
      y-unit="m"
    />
    <LinePlot
      :title="t.velocityPlot"
      :series="[{ id: 'v', label: t.velocity, slot: 1, points: result.velocity }]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.v} (m/s)`"
      x-unit="s"
      y-unit="m/s"
    />
    <p class="explorer-note">{{ t.note }}</p>
  </section>
</template>
