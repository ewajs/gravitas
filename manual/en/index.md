# Welcome to Gravitas

Gravitas is a game about understanding and controlling motion in space. Your first
mission: set a lunar lander down on a pad, gently and upright.

## In one minute

1. Open the game and read the **How to fly** card.
2. Press **P** (or **Start**). The lander begins 80 m up, falling and drifting
   toward the pad, which is ahead and below.
3. Hold **R** to raise the throttle and slow the fall; **F** lowers it.
4. Lean with **W/A/S/D** to correct drift: on the radar, lean **against the arrow**.
5. Touch down slowly, nearly upright, and stay still for a second.

At the end you get a result that explains what happened: speeds at touchdown,
tilt, distance from the pad, and fuel left. **Enter** or **Try again** starts over.

## On a phone

Gravitas flies with the phone **sideways** (landscape). Menus, Help, and results
work either way, but if you start flying with the phone upright, the game asks
you to turn it and keeps the flight paused until you tap **Resume**. Sideways, your
left thumb works the throttle and your right thumb the tilt (see
[Flying](./flying#on-a-touch-screen)). The instruments keep to the corners so the
middle of the screen, from the lander down to the pad, stays clear: altitude and
speeds in a small card at the top left, pause and the **⋯** menu at the top right
(language, sound, restart, and Help live there), and the radar under them with the
distance to the pad. The layout stays the same before you start and behind the
results. Upright, before a flight, you see only "How to fly", a reminder to turn
the phone, and **Start**. Pinching or double-tapping never zooms the page: a pinch
zooms the camera.

### Install it to your home screen

You can add Gravitas to your home screen and open it like an app, full screen and
sideways:

- **iPhone (Safari):** tap **Share** and choose **Add to Home Screen**.
- **Android (Chrome):** open the **⋮** menu and choose **Install app** (or **Add to
  Home screen**).

It still needs a connection: it does not work offline yet.

### If it feels slow

The translucent panels blur the scene behind them, which costs graphics work. If
your phone does not move smoothly, open **Help → Display → Reduce transparency**:
the panels turn solid. To see the frame rate, add `debug` to the address (for
example `https://ewajs.github.io/gravitas/?lang=en&debug`).

## In this manual

- [Flying](./flying): every control and how the lander responds.
- [Instruments](./instruments): what each readout and the radar show.
- [Landing](./landing): the rules, the results, and tips.
- [The lander](./lander): the vehicle's numbers, for the curious.

Curious how it works inside? The [Learn](./learn/) section explains the physics and
math of the simulation, with equations and interactive explorers that run the same
engine as the game.

The game runs in English and Spanish (Argentina); you can switch language
mid-flight without losing anything.

## Credits

The Moon's colour map is from NASA's Scientific Visualization Studio (CGI Moon
Kit), built from the Lunar Reconnaissance Orbiter Camera's images. The Moon's
heights come from the same orbiter's LOLA laser altimeter (the LOLA team at
NASA's Goddard Space Flight Center, via the Planetary Data System). Gravitas's
code and this manual are MIT-licensed.
