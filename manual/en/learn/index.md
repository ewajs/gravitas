# How Gravitas works

Gravitas doesn't animate a lander: it **simulates** one. Every motion you see comes
from Newton's laws applied sixty times a second. This section shows the math the
game does, with equations and interactive explorers that run **the same physics
engine as the game**.

## One simulation step

<svg class="diagram" viewBox="0 0 720 150" role="img" aria-label="Flow of one step: keyboard, session, forces, integration, contact, judge; the 3D view and instruments draw the result.">
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--vp-c-text-2)"/></marker></defs>
  <g font-size="13" fill="var(--vp-c-text-1)" text-anchor="middle">
    <rect x="8" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="56" y="47">Keyboard</text>
    <rect x="128" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="176" y="40">Session</text><text x="176" y="56" font-size="11" fill="var(--vp-c-text-2)">60 steps/s</text>
    <rect x="248" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="296" y="47">Forces</text>
    <rect x="368" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="416" y="40">Integration</text><text x="416" y="56" font-size="11" fill="var(--vp-c-text-2)">RK4</text>
    <rect x="488" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="536" y="47">Contact</text>
    <rect x="608" y="20" width="104" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="660" y="47">Judge</text>
    <rect x="248" y="96" width="216" height="40" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="356" y="121">3D view and instruments</text>
  </g>
  <g stroke="var(--vp-c-text-2)" stroke-width="1.5" fill="none" marker-end="url(#a)">
    <path d="M104 42 H126"/><path d="M224 42 H246"/><path d="M344 42 H366"/><path d="M464 42 H486"/><path d="M584 42 H606"/>
    <path d="M536 64 V116 H466"/>
  </g>
</svg>

1. **Keyboard:** your keys are read once per screen frame.
2. **Session:** real time is divided into fixed steps of 1/60 s, however many
   frames your screen draws per second.
3. **Forces:** gravity, engine thrust, thruster torque, and the ground pushing back.
4. **Integration:** from the forces, the RK4 method works out where the lander will
   be 1/60 s later.
5. **Contact:** the legs act as springs with dampers against the ground.
6. **Judge:** watches the first touch and decides whether you landed, landed
   rough, or crashed.

The 3D view and the instruments **only show** the result; they never decide
anything. Between two steps, the view interpolates so motion looks smooth.

## Chapters

- [Motion and gravity](./motion): position, velocity, acceleration, and why
  letting yourself fall is a bad idea.
- [Rockets and leaning](./rockets): thrust, burning mass, the rocket equation, and
  how leaning moves you sideways.
- [Rotation and the assist](./rotation): torque, moment of inertia, quaternions,
  and the controller that stops your turns.
- [Stepping time](./integration): why the game uses RK4 rather than the simplest
  method.
- [Legs and the ground](./contact): springs, damping, and why the lander doesn't
  bounce.
- [Next: orbits](./orbits): from flat ground to a round world.

::: tip Everything in SI units
Metres, seconds, kilograms, newtons, and radians. The instruments convert to
degrees or percentages only for display.
:::
