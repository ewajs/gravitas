# Cómo funciona Gravitas

Gravitas no anima un módulo: lo **simula**. Cada movimiento que ves sale de las
leyes de Newton aplicadas sesenta veces por segundo. En esta sección vas a ver
qué cuentas hace el juego, con las ecuaciones y con exploradores interactivos
que usan **el mismo motor de física que el juego**.

## Un cuadro de simulación

<svg class="diagram" viewBox="0 0 720 150" role="img" aria-label="Flujo de un paso: teclado, sesión, fuerzas, integración, contacto, juez, y la vista y los instrumentos dibujan el resultado.">
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="var(--vp-c-text-2)"/></marker></defs>
  <g font-size="13" fill="var(--vp-c-text-1)" text-anchor="middle">
    <rect x="8" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="56" y="47">Teclado</text>
    <rect x="128" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="176" y="40">Sesión</text><text x="176" y="56" font-size="11" fill="var(--vp-c-text-2)">60 pasos/s</text>
    <rect x="248" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="296" y="47">Fuerzas</text>
    <rect x="368" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="416" y="40">Integración</text><text x="416" y="56" font-size="11" fill="var(--vp-c-text-2)">RK4</text>
    <rect x="488" y="20" width="96" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="536" y="47">Contacto</text>
    <rect x="608" y="20" width="104" height="44" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="660" y="47">Juez</text>
    <rect x="248" y="96" width="216" height="40" rx="8" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)"/><text x="356" y="121">Vista 3D e instrumentos</text>
  </g>
  <g stroke="var(--vp-c-text-2)" stroke-width="1.5" fill="none" marker-end="url(#a)">
    <path d="M104 42 H126"/><path d="M224 42 H246"/><path d="M344 42 H366"/><path d="M464 42 H486"/><path d="M584 42 H606"/>
    <path d="M536 64 V116 H466"/>
  </g>
</svg>

1. **Teclado:** tus teclas se leen una vez por cuadro de pantalla.
2. **Sesión:** el tiempo real se reparte en pasos fijos de 1/60 s, sin importar
   cuántos cuadros por segundo dibuje tu pantalla.
3. **Fuerzas:** gravedad, empuje del motor, torque de los propulsores y empuje
   del suelo.
4. **Integración:** con las fuerzas, el método RK4 calcula dónde estará el módulo
   1/60 s después.
5. **Contacto:** las patas funcionan como resortes con amortiguador contra el suelo.
6. **Juez:** mira el primer toque y decide si aterrizaste, si fue duro o si te
   estrellaste.

La vista 3D y los instrumentos **solo muestran** el resultado: nunca deciden nada.
Entre dos pasos, la vista interpola para que el movimiento se vea suave.

## Capítulos

- [Movimiento y gravedad](./motion): posición, velocidad, aceleración, y por qué
  dejarte caer es una mala idea.
- [Cohetes e inclinación](./rockets): empuje, masa que se consume, la ecuación del
  cohete y cómo inclinarte te mueve de costado.
- [Rotación y asistencia](./rotation): torque, momento de inercia, cuaterniones y
  el controlador que frena tus giros.
- [Avanzar en el tiempo](./integration): por qué el juego usa RK4 y no la cuenta
  más simple.
- [Patas y suelo](./contact): resortes, amortiguación y por qué el módulo no rebota.
- [Lo que viene: órbitas](./orbits): de un suelo plano a un mundo redondo.

::: tip Todo en unidades del SI
Metros, segundos, kilogramos, newtons y radianes. Los instrumentos convierten a
grados o porcentajes solo para mostrarlos.
:::
