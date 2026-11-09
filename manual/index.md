# Bienvenido a Gravitas

Gravitas es un juego sobre entender y controlar el movimiento en el espacio. Tu
primera misión: posar un módulo lunar sobre una plataforma, suave y en pie.

## En un minuto

1. Abrí el juego y elegí **Aterrizaje rápido**. La otra misión, **Aterrizaje
   desde órbita**, es una vista previa: un módulo de descenso en órbita lunar, para
   posarlo donde elijas.
2. Leé la tarjeta **Cómo volar** y pulsá **P** (o **Comenzar**). El módulo arranca a 80 m de altura, cayendo y
   derivando hacia la plataforma, que está adelante y abajo.
3. Mantené **R** para subir el empuje y frenar la caída; **F** lo baja.
4. Inclinate con **W/A/S/D** para corregir la deriva: en el radar, inclinate
   **en contra de la flecha**.
5. Tocá el suelo despacio, casi vertical, y quedate quieto un segundo.

Al final vas a ver un resultado que explica qué pasó: velocidades al tocar,
inclinación, distancia a la plataforma y combustible restante. **Enter** o
**Reintentar** empieza de nuevo; **Misiones** vuelve a la lista de misiones.

## En el teléfono

Gravitas se vuela con el teléfono **en horizontal**. Los menús, la Ayuda y los
resultados funcionan en cualquier posición, pero si empezás a volar con el
teléfono vertical, el juego te pide que lo gires y deja el vuelo en pausa hasta
que toques **Reanudar**. En horizontal, el pulgar izquierdo maneja el empuje y el
derecho la inclinación (ver [Volar](./flying#en-una-pantalla-tactil)). Los
instrumentos van en las esquinas para que el centro de la pantalla, desde el
módulo hasta la plataforma, quede libre: altitud y velocidades en una tarjeta
chica arriba a la izquierda, la pausa y el menú **⋯** arriba a la derecha (ahí
están el idioma, el sonido, reiniciar y la Ayuda) y, debajo, el radar con la
distancia a la plataforma. Se ve igual antes de empezar y detrás de los
resultados. En vertical, antes de volar, solo aparecen "Cómo volar", un aviso
para girar el teléfono y **Comenzar**. El juego no hace zoom al pellizcar ni al
tocar dos veces: pellizcar acerca la cámara.

### Instalarlo en la pantalla de inicio

Podés agregar Gravitas a la pantalla de inicio y abrirlo como una app, a pantalla
completa y en horizontal:

- **iPhone (Safari):** tocá el botón **Compartir** y elegí **Agregar a inicio**.
- **Android (Chrome):** abrí el menú **⋮** y elegí **Instalar app** (o **Agregar a
  la pantalla principal**).

Igual necesita conexión: todavía no funciona sin internet.

### Si va lento

Los paneles translúcidos desenfocan la escena de fondo, y eso cuesta trabajo
gráfico. Si el teléfono no llega a moverse con fluidez, abrí **Ayuda → Pantalla →
Reducir transparencia**: los paneles pasan a ser sólidos. Para ver los cuadros
por segundo, agregá `?debug` a la dirección (por ejemplo
`https://ewajs.github.io/gravitas/?debug`).

## Qué vas a encontrar acá

- [Volar](./flying): todos los controles y cómo responde el módulo.
- [Instrumentos](./instruments): qué muestra cada indicador y el radar.
- [Aterrizar](./landing): las reglas, los resultados y consejos.
- [El módulo](./lander): los números del vehículo, para quien quiera más.

¿Querés entender cómo funciona por dentro? La sección [Aprender](./learn/) explica
la física y la matemática de la simulación, con ecuaciones y exploradores
interactivos que usan el mismo motor que el juego.

El juego funciona en español (Argentina) e inglés; podés cambiar el idioma en
pleno vuelo sin perder nada.

## Créditos

El mapa de color de la Luna es del Scientific Visualization Studio de la NASA (CGI
Moon Kit), hecho con imágenes de la cámara del Lunar Reconnaissance Orbiter. Las
alturas de la Luna son del altímetro láser LOLA del mismo orbitador (equipo LOLA
del Goddard Space Flight Center de la NASA, vía el Planetary Data System). El
código de Gravitas y este manual tienen licencia MIT.
