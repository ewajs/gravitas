<script setup lang="ts">
// The real lander dropped on its legs: touchdown speed and leg tuning decide
// compression, bounce, and whether the engine bell reaches the ground.
import { computed, ref } from 'vue';
import LinePlot from '../LinePlot.vue';
import { legDrop } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const speed = ref(2);
const stiffness = ref(20000);
const damping = ref(4000);
const rebound = ref(25000);
const drop = computed(() => legDrop(speed.value, stiffness.value, damping.value, rebound.value));
const t = computed(() =>
  english.value
    ? {
        title: 'Explore: landing legs',
        speed: 'Touchdown speed',
        stiffness: 'Leg stiffness k',
        damping: 'Compression damping c',
        rebound: 'Rebound damping',
        compression: 'Deepest compression',
        bounce: 'Bounce height',
        bell: 'Engine bell',
        hit: 'hits the ground',
        clear: 'stays clear',
        omega: 'Natural frequency',
        zeta: 'Damping ratio ζ',
        legPlot: 'Leg compression after touchdown',
        velocityPlot: 'Vertical velocity',
        time: 'Time',
        leg: 'Compression',
        v: 'Velocity',
        bellLine: 'bell lip',
      }
    : {
        title: 'Explorá: las patas de aterrizaje',
        speed: 'Velocidad al tocar',
        stiffness: 'Rigidez de la pata k',
        damping: 'Amortiguación al comprimir c',
        rebound: 'Amortiguación al rebotar',
        compression: 'Compresión máxima',
        bounce: 'Altura del rebote',
        bell: 'Tobera',
        hit: 'toca el suelo',
        clear: 'no llega',
        omega: 'Frecuencia natural',
        zeta: 'Razón de amortiguación ζ',
        legPlot: 'Compresión de la pata después de tocar',
        velocityPlot: 'Velocidad vertical',
        time: 'Tiempo',
        leg: 'Compresión',
        v: 'Velocidad',
        bellLine: 'borde de la tobera',
      },
);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.speed }}: <output>{{ format(speed, 1) }} m/s</output></span
        >
        <input v-model.number="speed" type="range" min="0.5" max="10" step="0.5" />
      </label>
      <label>
        <span
          >{{ t.stiffness }}: <output>{{ format(stiffness / 1000, 0) }} kN/m</output></span
        >
        <input v-model.number="stiffness" type="range" min="5000" max="60000" step="1000" />
      </label>
      <label>
        <span
          >{{ t.damping }}: <output>{{ format(damping / 1000, 1) }} kN·s/m</output></span
        >
        <input v-model.number="damping" type="range" min="0" max="10000" step="250" />
      </label>
      <label>
        <span
          >{{ t.rebound }}: <output>{{ format(rebound / 1000, 1) }} kN·s/m</output></span
        >
        <input v-model.number="rebound" type="range" min="0" max="40000" step="1000" />
      </label>
    </div>
    <dl class="explorer-stats">
      <div>
        <dt>{{ t.compression }}</dt>
        <dd data-testid="max-compression">{{ format(drop.maxCompression * 100, 0) }} cm</dd>
      </div>
      <div>
        <dt>{{ t.bounce }}</dt>
        <dd>{{ format(drop.bounce * 100, 0) }} cm</dd>
      </div>
      <div>
        <dt>{{ t.bell }}</dt>
        <dd data-testid="bell">{{ drop.bellStrike ? t.hit : t.clear }}</dd>
      </div>
      <div>
        <dt>{{ t.omega }}</dt>
        <dd>{{ format(drop.omega, 1) }} rad/s</dd>
      </div>
      <div>
        <dt>{{ t.zeta }}</dt>
        <dd>{{ format(drop.zeta, 2) }}</dd>
      </div>
    </dl>
    <LinePlot
      :title="t.legPlot"
      :series="[{ id: 'leg', label: t.leg, slot: 1, points: drop.compression }]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.leg} (m)`"
      x-unit="s"
      y-unit="m"
      :digits="2"
    />
    <LinePlot
      :title="t.velocityPlot"
      :series="[{ id: 'v', label: t.v, slot: 1, points: drop.velocity }]"
      :x-label="`${t.time} (s)`"
      :y-label="`${t.v} (m/s)`"
      x-unit="s"
      y-unit="m/s"
      :digits="2"
    />
  </section>
</template>
