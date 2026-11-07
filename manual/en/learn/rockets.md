# Rockets and leaning

## Thrust comes from throwing mass away

A rocket engine pushes by expelling gas very fast backwards. If it expels a mass
$\dot m$ per second at speed $v_e$ (the **exhaust velocity**), the thrust is:

$$
F = \dot m\, v_e
$$

The Gravitas lander has 4,500 N of maximum thrust with $v_e = 3000$ m/s, so at full
throttle it burns $\dot m = 1.5$ kg of fuel per second.

## Lighter as it flies

As fuel burns, mass drops and the same thrust accelerates more and more. Adding up
those small changes (conservation of momentum) gives Tsiolkovsky's **rocket
equation**:

$$
\Delta v = v_e \ln\frac{m_0}{m_1}
$$

where $m_0$ is the starting mass and $m_1$ the final one. It's the total change in
velocity the fuel can give you, ignoring gravity. With a full tank (1,500 kg →
1,200 kg) that's about 669 m/s; with the first descent's 60 kg, about 146 m/s.

With gravity and constant thrust for a time $t$, vertical speed from rest is:

$$
v(t) = \frac{F}{\dot m} \ln\frac{m_0}{m_0 - \dot m\, t} - g\, t
$$

## Hovering

To stay still in the air, thrust must equal weight, $F = m g$. With the throttle
lever $u$ (0 to 1) and maximum thrust $F_\text{max}$:

$$
u_\text{hover} = \frac{m\, g}{F_\text{max}}
$$

That's the **white mark** on the throttle bar. With 60 kg aboard it's 0.45; it
moves down as you burn fuel, because you weigh less.

## Leaning moves you sideways

Thrust points along the lander's axis. Tilted by an angle $\theta$, it splits in two:

$$
F_\text{vertical} = F \cos\theta, \qquad F_\text{sideways} = F \sin\theta
$$

The sideways part accelerates you horizontally; the vertical part still has to
fight gravity. So leaning takes **more** throttle to hover:
$u_\text{hover} = m g / (F_\text{max} \cos\theta)$. That's how you stop drifting: lean
**against** the motion, as the radar shows.

<Rocket />
