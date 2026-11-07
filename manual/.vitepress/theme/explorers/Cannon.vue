<script setup lang="ts">
// Newton's cannon on the Moon: a horizontal shot from 100 km up. Too slow falls
// back, about 1.6 km/s circles, faster stretches the ellipse, past ~2.3 km/s leaves.
import { computed, ref } from 'vue';
import { cannon, MOON } from '../../learn/models';
import { useLocale } from '../locale';

const { english, format } = useLocale();
const speed = ref(1700);
const shot = computed(() => cannon(speed.value));
const R = MOON.radius / 1000;
const view = 2.6 * R;
const path = computed(() =>
  shot.value.path.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${(-y).toFixed(1)}`).join(''),
);
const t = computed(() =>
  english.value
    ? {
        title: "Explore: Newton's cannon on the Moon",
        speed: 'Launch speed (horizontal, from 100 km up)',
        circular: 'Circular speed here',
        escape: 'Escape speed here',
        result: 'Result',
        outcomes: { crash: 'falls back and hits', orbit: 'orbits', escape: 'escapes the Moon' },
        period: 'Orbital period',
        figure: 'Path of the shot around the Moon',
        min: 'min',
      }
    : {
        title: 'Explorá: el cañón de Newton en la Luna',
        speed: 'Velocidad de disparo (horizontal, desde 100 km)',
        circular: 'Velocidad circular acá',
        escape: 'Velocidad de escape acá',
        result: 'Resultado',
        outcomes: { crash: 'cae y choca', orbit: 'orbita', escape: 'escapa de la Luna' },
        period: 'Período orbital',
        figure: 'Trayectoria del disparo alrededor de la Luna',
        min: 'min',
      },
);
</script>

<template>
  <section class="explorer" :aria-label="t.title">
    <h4>{{ t.title }}</h4>
    <div class="explorer-controls">
      <label>
        <span
          >{{ t.speed }}: <output>{{ format(speed / 1000, 2) }} km/s</output></span
        >
        <input v-model.number="speed" type="range" min="200" max="2500" step="25" />
      </label>
    </div>
    <dl class="explorer-stats">
      <div>
        <dt>{{ t.circular }}</dt>
        <dd>{{ format(shot.circular / 1000, 2) }} km/s</dd>
      </div>
      <div>
        <dt>{{ t.escape }}</dt>
        <dd>{{ format(shot.escape / 1000, 2) }} km/s</dd>
      </div>
      <div>
        <dt>{{ t.result }}</dt>
        <dd data-testid="cannon-outcome">{{ t.outcomes[shot.outcome] }}</dd>
      </div>
      <div v-if="shot.period">
        <dt>{{ t.period }}</dt>
        <dd>{{ format(shot.period, 0) }} {{ t.min }}</dd>
      </div>
    </dl>
    <svg
      class="diagram"
      :viewBox="`${-view} ${-view} ${2 * view} ${2 * view}`"
      style="max-width: 420px; margin-inline: auto"
      role="img"
      :aria-label="`${t.figure}: ${t.outcomes[shot.outcome]}`"
    >
      <circle cx="0" cy="0" :r="R" fill="var(--lp-moon)" />
      <path
        :d="path"
        fill="none"
        stroke="var(--lp-1)"
        stroke-width="28"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        cx="0"
        :cy="-(R + 100)"
        r="70"
        fill="var(--lp-2)"
        stroke="var(--lp-surface)"
        stroke-width="24"
      />
    </svg>
  </section>
</template>
