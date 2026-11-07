# Legs and the ground

## Springs with dampers

Each leg works as a spring with a damper. Compressed by a distance $d$ at a rate
$\dot d$, the ground pushes back with:

$$
N = \max\!\left(0,\ k\, d + c\, \dot d\right)
$$

$k$ is the **stiffness** (20 kN/m) and $c$ the **damping**. The $\max$ makes the
ground push but never pull. At rest, each of the four legs carries a quarter of
the weight and compresses about 3 cm:

$$
d_\text{rest} = \frac{m\, g}{4k}
$$

## Frequency and damping

Four legs in parallel and a mass $m$ form an oscillator with a **natural
frequency** and a **damping ratio**:

$$
\omega = \sqrt{\frac{4k}{m}}, \qquad \zeta = \frac{4c}{2\sqrt{4k\, m}}
$$

With $\zeta < 1$ the lander bounces; around $\zeta \approx 0.7$ it settles quickly
with almost no oscillation. Gravitas legs use $\zeta \approx 0.7$ when compressing
and six times more damping when extending, like a car's shock absorbers: a hard
hit doesn't throw the lander back into the air.

<Legs />

## The structure

If the legs compress more than 0.42 m, the engine bell's lip touches the ground.
For the game, that's a crash. The structure is modelled as much stiffer springs,
so the lander stops rather than passing through the ground.

## Friction and tipping over

Sliding, the ground brakes with Coulomb friction, $\mu N$, with $\mu = 0.6$. Resting
on two legs, the lander tips over once its centre of mass passes the line of
support:

$$
\theta_\text{tip} = \arctan\frac{1.5\ \text{m}}{1.5\ \text{m}} = 45^\circ
$$
