# Next: orbits

So far gravity has been a fixed arrow pointing down. That holds near the ground,
but a world is a sphere: gravity points to the centre and weakens with distance.

## Gravity of a sphere

The acceleration at a distance $r$ from the centre is:

$$
g(r) = \frac{\mu}{r^2}
$$

where $\mu = G M$ is the gravitational parameter. For the Moon,
$\mu = 4.9 \times 10^{12}\ \text{m}^3/\text{s}^2$ and the radius is 1,737 km: at the
surface it gives exactly the game's $1.62\ \text{m/s}^2$.

## Falling without hitting the ground

Newton imagined a cannon on a mountain: the faster it fires, the farther the ball
lands. Fast enough, and the ground curves away as fast as the ball falls, so it
never arrives. That's an **orbit**. The speed for a circular orbit and the
**escape** speed are:

$$
v_\text{circular} = \sqrt{\frac{\mu}{r}}, \qquad v_\text{escape} = \sqrt{\frac{2\mu}{r}}
$$

At 100 km above the Moon, about 1.63 km/s is enough to orbit and about 2.31 km/s to
escape. In between, the orbit is an ellipse.

<Cannon />

::: tip Coming up
Orbits, rendezvous, and manoeuvres will need larger reference frames and new
design decisions. This section will grow with the game.
:::
