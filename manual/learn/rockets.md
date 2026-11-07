# Cohetes e inclinación

## El empuje sale de tirar masa

Un motor cohete empuja expulsando gases muy rápido hacia atrás. Si expulsa una
masa $\dot m$ por segundo a una velocidad $v_e$ (la **velocidad de escape** de los
gases), el empuje es:

$$
F = \dot m\, v_e
$$

El módulo de Gravitas tiene un empuje máximo de 4500 N con $v_e = 3000$ m/s, así
que a fondo quema $\dot m = 1{,}5$ kg de combustible por segundo.

## Más liviano a medida que vuela

Como el combustible se consume, la masa baja y el mismo empuje acelera cada vez
más. Sumando esos pequeños cambios (la conservación del momento) sale la
**ecuación del cohete** de Tsiolkovski:

$$
\Delta v = v_e \ln\frac{m_0}{m_1}
$$

donde $m_0$ es la masa inicial y $m_1$ la final. Es el cambio de velocidad total
que te da el combustible, sin contar la gravedad. Con el tanque lleno (1500 kg →
1200 kg) son unos 669 m/s; con los 60 kg del primer descenso, unos 146 m/s.

Con gravedad y empuje constante durante un tiempo $t$, la velocidad vertical
desde el reposo es:

$$
v(t) = \frac{F}{\dot m} \ln\frac{m_0}{m_0 - \dot m\, t} - g\, t
$$

## Flotar

Para quedarte quieto en el aire el empuje tiene que igualar el peso, $F = m g$. Con
la palanca de empuje $u$ (de 0 a 1) y un empuje máximo $F_\text{máx}$:

$$
u_\text{flotar} = \frac{m\, g}{F_\text{máx}}
$$

Esa es la **marca blanca** de la barra de empuje. Con 60 kg cargados son 0,45; a
medida que quemás combustible baja, porque pesás menos.

## Inclinarte te mueve de costado

El empuje apunta a lo largo del eje del módulo. Inclinado un ángulo $\theta$, se
divide en dos partes:

$$
F_\text{vertical} = F \cos\theta, \qquad F_\text{costado} = F \sin\theta
$$

La parte de costado te acelera horizontalmente; la vertical tiene que seguir
peleando contra la gravedad. Por eso, inclinado, hace falta **más** empuje para
flotar: $u_\text{flotar} = m g / (F_\text{máx} \cos\theta)$. Así se frena la deriva:
te inclinás **en contra** del movimiento, como muestra el radar.

<Rocket />
