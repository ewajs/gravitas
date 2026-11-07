import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import LinePlot from './LinePlot.vue';
import FreeFall from './explorers/FreeFall.vue';
import Rocket from './explorers/Rocket.vue';
import RateAssist from './explorers/RateAssist.vue';
import Integrators from './explorers/Integrators.vue';
import Legs from './explorers/Legs.vue';
import Cannon from './explorers/Cannon.vue';
import './learn.css';

// The default theme plus the Learn section's interactive explorers, available in
// any manual page as <FreeFall />, <Rocket />, and so on.
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LinePlot', LinePlot);
    app.component('FreeFall', FreeFall);
    app.component('Rocket', Rocket);
    app.component('RateAssist', RateAssist);
    app.component('Integrators', Integrators);
    app.component('Legs', Legs);
    app.component('Cannon', Cannon);
  },
};
export default theme;
