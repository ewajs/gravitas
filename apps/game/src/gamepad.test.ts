import { describe, expect, it } from 'vitest';
import {
  GAMEPAD_STICK_DEAD_ZONE,
  GamepadControls,
  gamepadInput,
  type GamepadReading,
} from './gamepad';
import type { InputCommand } from './input';

// A standard-mapping pad at rest: 4 axes, 17 buttons.
function pad(
  overrides: { axes?: Record<number, number>; buttons?: Record<number, number> } = {},
  base: Partial<GamepadReading> = {},
): GamepadReading {
  const axes = [0, 0, 0, 0].map((value, index) => overrides.axes?.[index] ?? value);
  const buttons = Array.from({ length: 17 }, (_, index) => {
    const value = overrides.buttons?.[index] ?? 0;
    return { pressed: value > 0.5, touched: value > 0, value };
  });
  return { index: 0, mapping: 'standard', connected: true, axes, buttons, ...base };
}

describe('gamepad mapping', () => {
  it('is idle at rest and inside the stick dead zone', () => {
    expect(gamepadInput(pad())).toEqual({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 });
    const resting = gamepadInput(pad({ axes: { 2: 0.1, 3: -0.1 } }));
    expect(Math.hypot(0.1, 0.1)).toBeLessThan(GAMEPAD_STICK_DEAD_ZONE);
    expect(resting.rates).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('maps the right stick to proportional pitch and roll with keyboard signs', () => {
    // Up (negative Y) pitches forward like W: −X. Right rolls right like D: −Z.
    expect(gamepadInput(pad({ axes: { 3: -1 } })).rates).toEqual({ x: -1, y: 0, z: 0 });
    expect(gamepadInput(pad({ axes: { 2: 1 } })).rates.z).toBe(-1);
    const half = gamepadInput(pad({ axes: { 3: -0.5 } })).rates.x;
    const more = gamepadInput(pad({ axes: { 3: -0.8 } })).rates.x;
    expect(half).toBeLessThan(0);
    expect(half).toBeGreaterThan(-0.5); // Gentle near centre.
    expect(more).toBeLessThan(half); // Still proportional: more deflection, more rate.
    // The left stick does nothing.
    expect(gamepadInput(pad({ axes: { 0: 1, 1: 1 } })).rates).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('yaws with the bumpers and moves the lever in proportion to trigger pressure', () => {
    expect(gamepadInput(pad({ buttons: { 4: 1 } })).rates.y).toBe(1); // LB: left, like Q.
    expect(gamepadInput(pad({ buttons: { 5: 1 } })).rates.y).toBe(-1); // RB: right, like E.
    expect(gamepadInput(pad({ buttons: { 4: 1, 5: 1 } })).rates.y).toBe(0);
    expect(gamepadInput(pad({ buttons: { 7: 1 } })).throttleChange).toBe(1); // RT raises.
    expect(gamepadInput(pad({ buttons: { 6: 1 } })).throttleChange).toBe(-1); // LT lowers.
    const light = gamepadInput(pad({ buttons: { 7: 0.3 } })).throttleChange;
    expect(light).toBeGreaterThan(0.2);
    expect(light).toBeLessThan(0.3);
    expect(gamepadInput(pad({ buttons: { 7: 0.03 } })).throttleChange).toBe(0); // Resting trigger.
    expect(gamepadInput(pad({ buttons: { 6: 0.5, 7: 0.5 } })).throttleChange).toBe(0);
  });
});

describe('gamepad source', () => {
  function setup(pads: (GamepadReading | null)[]) {
    const commands: InputCommand[] = [];
    const connections: boolean[] = [];
    const listeners = new Map<string, (event: Event) => void>();
    const target = {
      addEventListener: (type: string, listener: (event: Event) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    } as unknown as Window;
    const provider = { getGamepads: () => pads };
    const source = new GamepadControls(
      provider,
      target,
      (command) => commands.push(command),
      (connected) => connections.push(connected),
    );
    return { source, commands, connections, listeners, pads };
  }

  it('fires A and Start once per press, as confirm and toggle-pause', () => {
    const { source, commands, pads } = setup([pad()]);
    source.poll();
    pads[0] = pad({ buttons: { 0: 1 } });
    source.poll();
    source.poll(); // Still held: no repeat.
    pads[0] = pad({ buttons: { 9: 1 } });
    source.poll();
    pads[0] = pad();
    source.poll();
    pads[0] = pad({ buttons: { 9: 1 } });
    source.poll();
    expect(commands).toEqual(['confirm', 'toggle-pause', 'toggle-pause']);
  });

  it('samples the polled pad and reports deliberate input as active', () => {
    const { source, pads } = setup([pad({ buttons: { 7: 1 } })]);
    expect(source.sample().throttleChange).toBe(0); // Nothing until polled.
    source.poll();
    expect(source.sample().throttleChange).toBe(1);
    expect(source.active).toBe(true);
    source.poll(); // Held steady: still applied, but not fresh use.
    expect(source.sample().throttleChange).toBe(1);
    expect(source.active).toBe(false);
    // A drifting left stick (unused in flight) or a resting button is never use.
    pads[0] = pad({ axes: { 0: 0.6, 1: -0.4 } });
    source.poll();
    expect(source.active).toBe(false);
    pads[0] = pad({ buttons: { 3: 1 } });
    source.poll();
    expect(source.active).toBe(true); // A fresh press of any button is.
    source.poll();
    expect(source.active).toBe(false);
    pads[0] = pad({ axes: { 3: -0.7 } });
    source.poll();
    expect(source.active).toBe(true); // Moving the right stick is.
    source.clear();
    expect(source.sample()).toEqual({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 });
  });

  it('ignores pads without the standard mapping', () => {
    const { source, connections } = setup([pad({ buttons: { 7: 1 } }, { mapping: '' })]);
    source.poll();
    expect(source.sample().throttleChange).toBe(0);
    expect(connections).toEqual([]);
  });

  it('reports a pad appearing and disappearing, by polling or by event', () => {
    const { source, connections, listeners, pads } = setup([null]);
    source.poll();
    pads[0] = pad({ buttons: { 7: 1 } });
    source.poll();
    pads[0] = null;
    source.poll();
    expect(connections).toEqual([true, false]);
    expect(source.sample().throttleChange).toBe(0);
    pads[0] = pad({ buttons: { 7: 1 } });
    source.poll();
    listeners.get('gamepaddisconnected')!({ gamepad: { index: 0 } } as unknown as Event);
    expect(connections).toEqual([true, false, true, false]);
    expect(source.sample().throttleChange).toBe(0);
  });

  it('survives a provider that throws', () => {
    const commands: InputCommand[] = [];
    const target = { addEventListener() {}, removeEventListener() {} } as unknown as Window;
    const source = new GamepadControls(
      {
        getGamepads: () => {
          throw new Error('blocked by permissions policy');
        },
      },
      target,
      (command) => commands.push(command),
      () => {},
    );
    expect(() => source.poll()).not.toThrow();
    expect(source.sample().throttleChange).toBe(0);
  });
});
