# Motion and gravity

## Position, velocity, and acceleration

**Position** says where the lander is. **Velocity** is how much position changes
per second, and **acceleration** is how much velocity changes per second:

$$
v = \frac{dx}{dt}, \qquad a = \frac{dv}{dt}
$$

In Gravitas, position is the **centre of mass**, in metres, with $y$ up and the
ground at $y = 0$.

## Newton's second law

A net force $F$ on a mass $m$ produces an acceleration:

$$
F = m\,a
$$

Near the lunar surface, gravity pulls everything with the same acceleration,
$g = 1.62\ \text{m/s}^2$, whatever its mass. That's a sixth of Earth's gravity:
on the Moon everything falls more slowly, but it still falls.

## Falling with no engine

With constant acceleration $-g$ (downward), a starting height $h_0$, and a starting
vertical speed $v_0$ (positive up):

$$
v(t) = v_0 - g\,t, \qquad h(t) = h_0 + v_0\,t - \tfrac{1}{2} g\,t^2
$$

Setting $h(t) = 0$ gives the time to reach the ground and, from it, the speed on
arrival:

$$
t_\text{ground} = \frac{v_0 + \sqrt{v_0^2 + 2 g h_0}}{g}, \qquad
v_\text{ground} = \sqrt{v_0^2 + 2 g h_0}
$$

The second formula shows something important: arrival speed grows with the
**square root** of height. Falling from four times higher doubles the speed.

<FreeFall />

::: tip In the game
The Gravitas engine doesn't use these formulas: it adds up small accelerations
step by step. In the plot, the engine's dots land on the formula's curve. That
checks that the simulation is right.
:::

## Why is altitude measured from the feet?

The lander's centre of mass is 1.5 m above its feet. What matters for landing is
when **the feet** touch, so the altitude instrument subtracts that distance and
accounts for tilt: leaning, one foot sits lower than the others.
