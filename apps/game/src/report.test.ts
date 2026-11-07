import { expect, it } from 'vitest';
import { fly, padPilot, verticalPilot } from './pilots';
import { landingReport } from './report';
import { PAD_RADIUS } from './rules';
import { FIRST_DESCENT } from './scenario';
import { FlightSession } from './session';

const session = () => new FlightSession(FIRST_DESCENT);

it('has no report before a verdict', () => {
  expect(landingReport(session())).toBeUndefined();
});

it('explains a clean pad landing with every check passing', () => {
  const report = landingReport(fly(session(), padPilot))!;
  expect(report.verdict).toBe('landed');
  expect(report.checks.map((check) => [check.id, check.pass])).toEqual([
    ['vertical-speed', true],
    ['horizontal-speed', true],
    ['tilt', true],
    ['pad-distance', true],
  ]);
  expect(report.checks.find((check) => check.id === 'pad-distance')!.limit).toBe(PAD_RADIUS);
  expect(report.flightTime).toBeGreaterThan(20);
});

it('names the failed limit of a rough landing', () => {
  const report = landingReport(fly(session(), verticalPilot))!;
  expect(report.verdict).toBe('rough');
  const failed = report.checks.filter((check) => !check.pass).map((check) => check.id);
  expect(failed).toContain('horizontal-speed');
  expect(failed).not.toContain('vertical-speed');
});

it('gives the cause of a crash', () => {
  const report = landingReport(
    fly(session(), () => ({ rates: { x: 0, y: 0, z: 0 }, throttleChange: 0 })),
  )!;
  expect(report).toMatchObject({ verdict: 'crashed', cause: 'impact' });
  expect(report.checks.find((check) => check.id === 'vertical-speed')!.value).toBeCloseTo(16.6, 0);
});
