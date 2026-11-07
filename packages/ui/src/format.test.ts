import { expect, it } from 'vitest';
import { numberFormats } from './format';

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
