/** An integer in Unicode superscript digits, for exponents such as the −3 in 10⁻³. */
export function superscript(n: number): string {
  return String(n)
    .replace('-', '⁻')
    .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!);
}
