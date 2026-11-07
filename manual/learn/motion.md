# Movimiento y gravedad

## Posición, velocidad y aceleración

La **posición** dice dónde está el módulo. La **velocidad** es cuánto cambia la
posición por segundo, y la **aceleración** es cuánto cambia la velocidad por
segundo:

$$
v = \frac{dx}{dt}, \qquad a = \frac{dv}{dt}
$$

En Gravitas, la posición es la del **centro de masa**, en metros, con el eje
$y$ hacia arriba y el suelo en $y = 0$.

## La segunda ley de Newton

Una fuerza neta $F$ sobre una masa $m$ produce una aceleración:

$$
F = m\,a
$$

Cerca de la superficie lunar, la gravedad tira de todo con la misma aceleración,
$g = 1{,}62\ \text{m/s}^2$, sin importar la masa. Eso es una sexta parte de la
gravedad de la Tierra: en la Luna todo cae más despacio, pero cae igual.

## Caer sin motor

Con aceleración constante $-g$ (hacia abajo), una altura inicial $h_0$ y una
velocidad vertical inicial $v_0$ (positiva hacia arriba):

$$
v(t) = v_0 - g\,t, \qquad h(t) = h_0 + v_0\,t - \tfrac{1}{2} g\,t^2
$$

Igualando $h(t) = 0$ sale el tiempo hasta el suelo y, con él, la velocidad al
llegar:

$$
t_\text{suelo} = \frac{v_0 + \sqrt{v_0^2 + 2 g h_0}}{g}, \qquad
v_\text{suelo} = \sqrt{v_0^2 + 2 g h_0}
$$

La segunda fórmula muestra algo importante: la velocidad al llegar crece con la
**raíz** de la altura. Caer desde cuatro veces más alto duplica la velocidad.

<FreeFall />

::: tip En el juego
El motor de Gravitas no usa estas fórmulas: suma pequeñas aceleraciones paso a
paso. En el gráfico, los puntos del motor caen sobre la curva de la fórmula. Así
se comprueba que la simulación es correcta.
:::

## ¿Por qué la altitud se mide desde las patas?

El centro de masa del módulo está a 1,5 m sobre las patas. Lo que importa para
aterrizar es cuándo **las patas** tocan el suelo, así que el instrumento de
altitud resta esa distancia, y tiene en cuenta la inclinación: inclinado, una
pata baja más que las otras.
