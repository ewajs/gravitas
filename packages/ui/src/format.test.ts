import { expect, it } from 'vitest';
import { formatDuration, numberFormats } from './format';

it("writes each locale's notation and reuses one set of formats per locale", () => {
  const es = numberFormats('es-AR');
  const en = numberFormats('en');
  expect(es.decimal.format(1234.56)).toBe('1.234,6');
  expect(en.decimal.format(1234.56)).toBe('1,234.6');
  expect([en.signed.format(-3.25), en.signed.format(0), en.signed.format(2)]).toEqual([
    '-3.3',
    '0.0',
    '+2.0',
  ]);
  expect(en.percent.format(0.54)).toBe('54%');
  expect(en.fixed(2).format(2.04)).toBe('2.04');
  expect(numberFormats('es-AR')).toBe(es);
  expect(en.fixed(2)).toBe(en.fixed(2));
});

it('writes countdowns as m:ss, or h:mm:ss from an hour', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(59.9)).toBe('0:59');
  expect(formatDuration(3_432)).toBe('57:12');
  expect(formatDuration(6_823.7)).toBe('1:53:43');
  expect(formatDuration(-5)).toBe('0:00');
});
