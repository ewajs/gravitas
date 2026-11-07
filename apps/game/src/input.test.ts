import { describe, expect, it } from 'vitest';
import { PilotInputs, strongest, type InputSource } from './input';
import type { PilotInput } from './session';

const IDLE: PilotInput = { rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 };

// A source whose next samples are scripted; it repeats the last one.
function scripted(...frames: Partial<PilotInput>[]): InputSource & { cleared: number } {
  let frame = 0;
  return {
    cleared: 0,
    sample() {
      const input = { ...IDLE, ...frames[Math.min(frame, frames.length - 1)] };
      frame++;
      return input;
    },
    clear() {
      this.cleared++;
    },
    dispose() {},
  };
}

describe('strongest request per axis', () => {
  it('keeps the largest magnitude, never adding sources or weakening with idle ones', () => {
    expect(strongest([])).toBe(0);
    expect(strongest([0, 0.4, 0])).toBe(0.4);
    expect(strongest([1, 0.6])).toBe(1);
    expect(strongest([-0.3, 0.2])).toBe(-0.3);
    expect(strongest([0.5, -1])).toBe(-1);
  });

  it('cancels equal and opposite requests, as opposite keys do', () => {
    expect(strongest([1, -1])).toBe(0);
    expect(strongest([0.5, -0.5, 0.2])).toBe(0);
  });
});

describe('merging input sources', () => {
  it('passes a single source through unchanged', () => {
    const input: PilotInput = { rates: { x: -1, y: 0, z: 1 }, throttleChange: 1, throttleSet: 0 };
    expect(new PilotInputs([scripted(input)]).sample()).toEqual(input);
    expect(new PilotInputs([scripted(IDLE)]).sample()).toEqual(IDLE);
    expect(new PilotInputs([scripted(IDLE)]).sample()).not.toHaveProperty('throttleSet');
  });

  it('takes the strongest rotation request per axis from any source', () => {
    const keyboard = scripted({ rates: { x: -1, y: 0, z: 0 } });
    const stick = scripted({ rates: { x: 0.3, y: 0, z: -0.6 } });
    expect(new PilotInputs([keyboard, stick]).sample().rates).toEqual({ x: -1, y: 0, z: -0.6 });
  });

  it('gives the throttle to the source that last began moving it', () => {
    const keyboard = scripted(
      { throttleChange: 1 },
      { throttleChange: 1 },
      { throttleChange: 1 },
      { throttleChange: 1 },
      { throttleChange: 0 },
    );
    const trigger = scripted(
      {},
      { throttleChange: -0.5 },
      { throttleChange: -0.5 },
      { throttleChange: 0 },
      { throttleChange: -0.25 },
    );
    const inputs = new PilotInputs([keyboard, trigger]);
    expect(inputs.sample().throttleChange).toBe(1); // Only the key moves it.
    expect(inputs.sample().throttleChange).toBe(-0.5); // The trigger began later: it wins.
    expect(inputs.sample().throttleChange).toBe(-0.5); // Still moving: it keeps the lever.
    expect(inputs.sample().throttleChange).toBe(1); // Released: the held key takes it back.
    expect(inputs.sample().throttleChange).toBe(-0.25); // A new movement wins again.
  });

  it('treats a one-shot setting as moving the lever', () => {
    const keyboard = scripted({ throttleChange: 1 }, { throttleChange: 1, throttleSet: 0 });
    const lever = scripted({ throttleSet: 0.4 }, {});
    const inputs = new PilotInputs([keyboard, lever]);
    expect(inputs.sample()).toMatchObject({ throttleChange: 0, throttleSet: 0.4 });
    // X while R is held: the keyboard's own setting and ramp, together.
    expect(inputs.sample()).toMatchObject({ throttleChange: 1, throttleSet: 0 });
  });

  it('clears every source and forgets who held the lever', () => {
    const a = scripted({ throttleChange: 1 });
    const b = scripted({}, { throttleChange: -1 });
    const inputs = new PilotInputs([a, b]);
    inputs.sample();
    inputs.clear();
    expect([a.cleared, b.cleared]).toEqual([1, 1]);
    // Both are now "new" movers; the later source in the list wins the tie.
    expect(inputs.sample().throttleChange).toBe(-1);
  });
});
