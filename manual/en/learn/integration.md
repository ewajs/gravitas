# Stepping time

## There isn't a formula for everything

Falling with no engine has an exact formula. With changing thrust, dropping mass,
coupled rotation, and legs touching the ground, it doesn't. The game does what any
simulation does: it moves forward in small **steps**. Knowing the state (position,
velocity, orientation, fuel) and its derivatives, it estimates the state a moment
$h$ later.

## Euler: the simplest idea

**Euler's method** assumes the derivative doesn't change during the step:

$$
x_{n+1} = x_n + h\, \dot x_n
$$

It's easy, but error builds quickly: total error is proportional to $h$. On a
spring, Euler also adds energy every step, so the oscillation keeps growing.

## RK4: looking several times within the step

The **fourth-order Runge–Kutta** method evaluates the derivative four times (at the
start, twice in the middle, and at the end) and averages them:

$$
x_{n+1} = x_n + \frac{h}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)
$$

Its total error is proportional to $h^4$: halve the step and the error drops sixteen
times. Gravitas integrates with RK4 at 60 steps per second, and splits each step in
four while touching the ground, because the leg springs are stiff.

<Integrators />

::: tip How to measure error
The explorer measures distance from the exact state, combining position and
velocity. Looking only at position at certain moments, a phase error or an
amplitude error could hide.
:::

## Fixed steps and screen frames

Your screen might draw 30, 60, or 144 frames a second, but physics always advances
in 1/60 s steps. Real time accumulates and is spent in whole steps; the view
interpolates between the last two so motion looks smooth. The result is
**identical** on any screen.
