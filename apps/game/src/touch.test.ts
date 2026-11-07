import { describe, expect, it } from 'vitest';
import { TOUCH_STICK_DEAD_ZONE, TouchControlsSource, touchRates } from './touch';

describe('touch mapping', () => {
  it('is idle at centre and inside the dead zone', () => {
    expect(touchRates({ x: 0, y: 0 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
    const small = TOUCH_STICK_DEAD_ZONE * 0.9;
    expect(touchRates({ x: small, y: 0 }, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('uses the keyboard signs: up tilts forward, right rolls right, yaw buttons turn', () => {
    expect(touchRates({ x: 0, y: 1 }, 0)).toEqual({ x: -1, y: 0, z: 0 }); // Like W.
    expect(touchRates({ x: 1, y: 0 }, 0)).toEqual({ x: 0, y: 0, z: -1 }); // Like D.
    expect(touchRates({ x: 0, y: 0 }, -1)).toEqual({ x: 0, y: 1, z: 0 }); // Left, like Q.
    expect(touchRates({ x: 0, y: 0 }, 1)).toEqual({ x: 0, y: -1, z: 0 }); // Right, like E.
  });

  it('is gentle near centre and proportional beyond it', () => {
    const pitch = (y: number) => -touchRates({ x: 0, y }, 0).x;
    expect(pitch(0.3)).toBeGreaterThan(0);
    expect(pitch(0.3)).toBeLessThan(0.2);
    expect(pitch(0.6)).toBeGreaterThan(pitch(0.3));
    expect(pitch(1)).toBe(1);
  });
});

describe('touch source', () => {
  const setup = () => {
    const element = new EventTarget() as HTMLElement;
    const source = new TouchControlsSource(element);
    const send = (type: string, detail: unknown) =>
      element.dispatchEvent(new CustomEvent(type, { detail }));
    return { element, source, send };
  };

  it('turns a lever move into one one-shot setting', () => {
    const { source, send } = setup();
    send('lever-input', { value: 0.42 });
    expect(source.sample()).toEqual({
      rates: { x: 0, y: 0, z: 0 },
      throttleChange: 0,
      throttleSet: 0.42,
    });
    expect(source.active).toBe(true);
    expect(source.sample()).not.toHaveProperty('throttleSet');
    expect(source.active).toBe(false);
  });

  it('holds stick and yaw until released, and reports them as active', () => {
    const { source, send } = setup();
    send('stick-input', { x: 0, y: 1 });
    send('yaw-input', { direction: 1 });
    expect(source.sample().rates).toEqual({ x: -1, y: -1, z: 0 });
    expect(source.sample().rates).toEqual({ x: -1, y: -1, z: 0 });
    expect(source.active).toBe(true);
    send('stick-input', { x: 0, y: 0 });
    send('yaw-input', { direction: 0 });
    source.sample();
    expect(source.sample().rates).toEqual({ x: 0, y: 0, z: 0 });
    expect(source.active).toBe(false);
  });

  it('ignores malformed details and clears on request', () => {
    const { source, send } = setup();
    send('lever-input', { value: Number.NaN });
    send('stick-input', { x: 'up', y: 1 });
    send('yaw-input', { direction: 2 });
    send('lever-input', null);
    expect(source.sample()).toEqual({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 });
    send('lever-input', { value: 3 });
    send('stick-input', { x: 1, y: 0 });
    expect(source.sample().throttleSet).toBe(1); // Clamped.
    source.clear();
    expect(source.sample()).toEqual({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 });
  });

  it('stops listening once disposed', () => {
    const { source, send } = setup();
    source.dispose();
    send('stick-input', { x: 1, y: 1 });
    expect(source.sample().rates).toEqual({ x: 0, y: 0, z: 0 });
  });
});
