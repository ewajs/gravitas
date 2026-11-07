# Rotation and the assist

## Torque and moment of inertia

Turning takes a **torque** $\tau$: a force applied away from the centre. The
lander's attitude thrusters sit 0.9 m from its axis and fire in pairs, in opposite
directions, to turn it without pushing it sideways.

Resistance to turning is the **moment of inertia** $I$, which depends on how mass is
spread out. It's the rotational version of $F = m a$:

$$
\tau = I\, \dot\omega
$$

where $\omega$ is the turn rate in radians per second. The lander has
$I = 1800\ \text{kg·m}^2$ in pitch and 900 N·m of maximum torque: at most it speeds
its turn up by $0.5\ \text{rad/s}^2$, about $29^\circ/\text{s}^2$.

## Turning in three dimensions

In 3D, a body spinning about one axis can start turning about another by itself.
**Euler's equations** describe it; for the $x$ axis:

$$
I_x\, \dot\omega_x = \tau_x + (I_y - I_z)\, \omega_y\, \omega_z
$$

The last term is the gyroscopic effect. The Gravitas engine always includes it,
though in normal flight it's small.

## Orientation with quaternions

Storing orientation as three angles (pitch, roll, yaw) seems natural, but it breaks
in some positions: two axes line up and a degree of freedom is lost (_gimbal
lock_). Gravitas uses **quaternions**: four numbers representing a rotation of angle
$\varphi$ about a unit axis $\hat n$:

$$
q = \left(\hat n \sin\tfrac{\varphi}{2},\ \cos\tfrac{\varphi}{2}\right)
$$

They don't have that problem and combine by multiplying. Angles only appear when
showing tilt on screen.

## The rate assist

Your keys don't apply torque directly: they request a **turn rate**. A proportional
controller works out the torque needed to reach it within a **response time** $T$,
limited by what the thrusters can deliver:

$$
\tau = \operatorname{clamp}\!\left(I\, \frac{\omega_\text{requested} - \omega}{T},\ \pm\tau_\text{max}\right)
$$

When you let go, $\omega_\text{requested} = 0$: the controller **stops** the turn, but
doesn't level the lander. That's your job.

Turning costs fuel. Each change of turn rate $\Delta\omega$ burns
$I\,\Delta\omega / (r\, v_e)$, with $r = 0.9$ m and $v_e = 2800$ m/s: about 0.37 kg to
start or stop a $30^\circ/\text{s}$ turn.

<RateAssist />
