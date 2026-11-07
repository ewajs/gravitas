# Patas y suelo

## Resortes con amortiguador

Cada pata funciona como un resorte con amortiguador. Si se comprime una distancia
$d$ a una velocidad $\dot d$, el suelo empuja con:

$$
N = \max\!\left(0,\ k\, d + c\, \dot d\right)
$$

$k$ es la **rigidez** (20 kN/m) y $c$ la **amortiguación**. El $\max$ hace que el
suelo empuje pero nunca tire. En reposo, cada una de las cuatro patas sostiene un
cuarto del peso y se comprime unos 3 cm:

$$
d_\text{reposo} = \frac{m\, g}{4k}
$$

## Frecuencia y amortiguación

Cuatro patas en paralelo y una masa $m$ forman un oscilador con **frecuencia
natural** y **razón de amortiguación**:

$$
\omega = \sqrt{\frac{4k}{m}}, \qquad \zeta = \frac{4c}{2\sqrt{4k\, m}}
$$

Con $\zeta < 1$ el módulo rebota; con $\zeta \approx 0{,}7$ se asienta rápido casi
sin oscilar. Las patas de Gravitas usan $\zeta \approx 0{,}7$ al comprimirse y una
amortiguación seis veces mayor al extenderse, como los amortiguadores de un auto:
un golpe fuerte no lanza el módulo de vuelta al aire.

<Legs />

## La estructura

Si las patas se comprimen más de 0,42 m, el borde de la tobera toca el suelo.
Para el juego eso es un accidente. La estructura también se modela como resortes
mucho más rígidos, para que el módulo se detenga en vez de atravesar el suelo.

## Fricción y vuelcos

Al deslizar, el suelo frena con fricción de Coulomb, $\mu N$, con $\mu = 0{,}6$. Si
el módulo queda apoyado en dos patas, vuelca cuando su centro de masa pasa por
encima de la línea de apoyo:

$$
\theta_\text{vuelco} = \arctan\frac{1{,}5\ \text{m}}{1{,}5\ \text{m}} = 45^\circ
$$
