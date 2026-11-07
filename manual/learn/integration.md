# Avanzar en el tiempo

## No hay fórmula para todo

Caer sin motor tiene fórmula exacta. Pero con empuje que cambia, masa que baja,
giros acoplados y patas que tocan el suelo, ya no. El juego hace lo que hace
cualquier simulación: avanza en **pasos** pequeños. Conociendo el estado
(posición, velocidad, orientación, combustible) y sus derivadas, estima el estado
un instante $h$ después.

## Euler: la idea más simple

El **método de Euler** supone que la derivada no cambia durante el paso:

$$
x_{n+1} = x_n + h\, \dot x_n
$$

Es fácil, pero acumula error rápido: el error total es proporcional a $h$. En un
resorte, además, Euler agrega energía en cada paso y la oscilación crece sin
parar.

## RK4: mirar varias veces dentro del paso

El método de **Runge–Kutta de cuarto orden** evalúa la derivada cuatro veces
(al principio, dos veces en el medio y al final) y las promedia:

$$
x_{n+1} = x_n + \frac{h}{6}\left(k_1 + 2k_2 + 2k_3 + k_4\right)
$$

Su error total es proporcional a $h^4$: con la mitad del paso, el error baja 16
veces. Gravitas integra con RK4 a 60 pasos por segundo. Como el suelo siempre está
presente, cada paso se divide en cuatro: los resortes de las patas son rígidos.

<Integrators />

::: tip Cómo medir el error
El explorador mide la distancia al estado exacto, combinando posición y
velocidad. Si miraras solo la posición en ciertos instantes, un error de fase o
uno de amplitud podrían esconderse.
:::

## Pasos fijos y cuadros de pantalla

Tu pantalla puede dibujar 30, 60 o 144 cuadros por segundo, pero la física
avanza siempre en pasos de 1/60 s. El tiempo real se acumula y se consume en
pasos enteros; la vista interpola entre los dos últimos pasos para que el
movimiento se vea suave. Así el resultado es **idéntico** en cualquier pantalla.
