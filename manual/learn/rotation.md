# Rotación y asistencia

## Torque y momento de inercia

Para girar hace falta un **torque** $\tau$: una fuerza aplicada lejos del centro.
Los propulsores de actitud del módulo están a 0,9 m del eje y empujan en pareja,
en sentidos opuestos, para girar sin desplazarlo.

La resistencia a girar es el **momento de inercia** $I$, que depende de cómo está
repartida la masa. Es la versión rotacional de $F = m a$:

$$
\tau = I\, \dot\omega
$$

donde $\omega$ es la velocidad de giro en radianes por segundo. El módulo tiene
$I = 1800\ \text{kg·m}^2$ en cabeceo y un torque máximo de 900 N·m: como mucho
acelera su giro $0{,}5\ \text{rad/s}^2$, unos $29^\circ/\text{s}^2$.

## Girar en tres dimensiones

En 3D, un cuerpo que gira sobre un eje puede empezar a girar sobre otro por sí
solo. Las **ecuaciones de Euler** lo describen; para el eje $x$:

$$
I_x\, \dot\omega_x = \tau_x + (I_y - I_z)\, \omega_y\, \omega_z
$$

El último término es el efecto giroscópico. El motor de Gravitas lo incluye
siempre, aunque en el vuelo normal es pequeño.

## Orientación con cuaterniones

Guardar la orientación como tres ángulos (cabeceo, alabeo, guiñada) parece
natural, pero falla en ciertas posiciones: dos ejes se alinean y se pierde un
grado de libertad (el _bloqueo de cardán_). Gravitas usa **cuaterniones**:
cuatro números que representan una rotación de ángulo $\varphi$ alrededor de un
eje unitario $\hat n$:

$$
q = \left(\hat n \sin\tfrac{\varphi}{2},\ \cos\tfrac{\varphi}{2}\right)
$$

No tienen ese problema y se combinan multiplicándolos. Los ángulos solo aparecen
al mostrar la inclinación en pantalla.

## El asistente de giro

Tus teclas no aplican torque directamente: piden una **velocidad de giro**. Un
controlador proporcional calcula el torque necesario para llegar a ella en un
**tiempo de respuesta** $T$, limitado por lo que pueden dar los propulsores:

$$
\tau = \operatorname{limitar}\!\left(I\, \frac{\omega_\text{pedida} - \omega}{T},\ \pm\tau_\text{máx}\right)
$$

Si soltás las teclas, $\omega_\text{pedida} = 0$: el controlador **frena** el giro,
pero no endereza el módulo. Ese es tu trabajo.

Girar cuesta combustible. Cada cambio de velocidad de giro $\Delta\omega$ gasta
$I\,\Delta\omega / (r\, v_e)$, con $r = 0{,}9$ m y $v_e = 2800$ m/s: unos 0,37 kg por
arrancar o frenar un giro de $30^\circ/\text{s}$.

<RateAssist />
