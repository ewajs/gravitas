import type { Actuation } from './session';

/** Target levels for the continuous sounds; pure, so it can be tested without audio. */
export interface AudioLevels {
  /** Engine rumble gain (0 silent). */
  readonly engine: number;
  /** Engine noise low-pass cutoff in hertz: brighter as throttle rises. */
  readonly engineCutoff: number;
  /** Attitude-thruster hiss gain. */
  readonly thrusters: number;
}

/** Maps applied actuation to sound levels. Quiet at idle; never louder than ~0.4. */
export function audioLevels(actuation: Actuation): AudioLevels {
  const throttle = Math.min(1, Math.max(0, actuation.throttle));
  const { x, y, z } = actuation.attitude;
  const attitude = Math.min(1, Math.max(Math.abs(x), Math.abs(y), Math.abs(z)));
  return {
    // Perceived loudness grows slower than throttle; a square root keeps low throttle audible.
    engine: 0.4 * Math.sqrt(throttle),
    engineCutoff: 180 + 900 * throttle,
    thrusters: attitude > 0.05 ? 0.12 + 0.12 * attitude : 0,
  };
}

/** One-shot cues at meaningful moments. */
export type Cue = 'landed' | 'rough' | 'crashed';

/** Smoothing time constant for level changes, in seconds: no clicks. */
const RAMP = 0.06;

/**
 * Synthesized flight sound: filtered noise for the engine and thrusters, a low tone
 * under the engine, a thud on touchdown, and short verdict cues. No audio assets.
 * The context is created on the first player gesture (browser autoplay rules) and
 * suspended while paused, hidden, or muted.
 */
export class FlightAudio {
  #context: AudioContext | undefined;
  #master: GainNode | undefined;
  #engine: GainNode | undefined;
  #engineTone: GainNode | undefined;
  #engineFilter: BiquadFilterNode | undefined;
  #thrusters: GainNode | undefined;
  #noise: AudioBuffer | undefined;
  #muted: boolean;
  #active = false;
  readonly #onState: (state: FlightAudio['state']) => void;

  /** `onState` hears every state change, including asynchronous resume/suspend. */
  constructor(muted: boolean, onState: (state: FlightAudio['state']) => void = () => {}) {
    this.#muted = muted;
    this.#onState = onState;
  }

  /** `running`, `suspended`, `muted`, or `off` before the first gesture. */
  get state(): 'off' | 'muted' | 'running' | 'suspended' {
    if (!this.#context) return 'off';
    if (this.#muted) return 'muted';
    return this.#context.state === 'running' ? 'running' : 'suspended';
  }

  /** Creates the audio graph; call from a user gesture such as a key press. */
  unlock(): void {
    if (this.#context || typeof AudioContext === 'undefined') return;
    const context = new AudioContext();
    this.#context = context;
    context.addEventListener('statechange', () => this.#onState(this.state));
    const master = context.createGain();
    master.gain.value = this.#muted ? 0 : 0.8;
    master.connect(context.destination);
    this.#master = master;

    // Two seconds of white noise, looped, feeds both engine and thrusters.
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.#noise = noise;
    const loop = () => {
      const source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      source.start();
      return source;
    };

    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 180;
    const engine = context.createGain();
    engine.gain.value = 0;
    loop().connect(engineFilter).connect(engine).connect(master);
    const tone = context.createOscillator();
    tone.type = 'sine';
    tone.frequency.value = 46;
    const engineTone = context.createGain();
    engineTone.gain.value = 0;
    tone.connect(engineTone).connect(master);
    tone.start();

    const hiss = context.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 2500;
    const thrusters = context.createGain();
    thrusters.gain.value = 0;
    loop().connect(hiss).connect(thrusters).connect(master);

    this.#engine = engine;
    this.#engineTone = engineTone;
    this.#engineFilter = engineFilter;
    this.#thrusters = thrusters;
    this.#apply();
  }

  /** Follows the actuators; call once per drawn frame. */
  update(actuation: Actuation): void {
    const context = this.#context;
    if (!context || !this.#engine || !this.#engineTone || !this.#engineFilter || !this.#thrusters) {
      return;
    }
    const levels = audioLevels(actuation);
    const now = context.currentTime;
    this.#engine.gain.setTargetAtTime(levels.engine, now, RAMP);
    this.#engineTone.gain.setTargetAtTime(levels.engine * 0.5, now, RAMP);
    this.#engineFilter.frequency.setTargetAtTime(levels.engineCutoff, now, RAMP);
    this.#thrusters.gain.setTargetAtTime(levels.thrusters, now, RAMP);
  }

  /** A low thud when the legs first touch, louder for faster impacts (m/s). */
  touchdown(speed: number): void {
    const context = this.#context;
    if (!context || !this.#master || this.state !== 'running') return;
    const level = Math.min(0.9, 0.15 + speed * 0.08);
    this.#blip(context, 'sine', 70, 38, level, 0.35);
  }

  /** A short cue for the verdict. */
  cue(cue: Cue): void {
    const context = this.#context;
    if (!context || !this.#master || this.state !== 'running') return;
    if (cue === 'landed') {
      this.#blip(context, 'triangle', 523, 523, 0.18, 0.25);
      this.#blip(context, 'triangle', 784, 784, 0.18, 0.4, 0.18);
    } else if (cue === 'rough') {
      this.#blip(context, 'triangle', 392, 370, 0.16, 0.45);
    } else {
      this.#burst(context, 0.6, 0.8);
    }
  }

  /** Pause or resume sound with the flight (paused, hidden tab). */
  setActive(active: boolean): void {
    this.#active = active;
    this.#apply();
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    this.#onState(this.state);
    if (this.#master && this.#context) {
      this.#master.gain.setTargetAtTime(muted ? 0 : 0.8, this.#context.currentTime, RAMP);
    }
    this.#apply();
  }

  dispose(): void {
    void this.#context?.close();
    this.#context = undefined;
  }

  // Suspending the context stops all processing, which also saves battery.
  #apply(): void {
    const context = this.#context;
    if (!context) return;
    if (this.#active && !this.#muted) void context.resume();
    else void context.suspend();
  }

  #blip(
    context: AudioContext,
    type: OscillatorType,
    from: number,
    to: number,
    level: number,
    duration: number,
    delay = 0,
  ): void {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.#master!);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  #burst(context: AudioContext, level: number, duration: number): void {
    if (!this.#noise) return;
    const start = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = this.#noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, start);
    filter.frequency.exponentialRampToValueAtTime(120, start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.#master!);
    source.start(start);
    source.stop(start + duration + 0.05);
  }
}
