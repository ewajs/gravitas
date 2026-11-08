/**
 * Downloads NASA's LOLA LDEM_4 elevation grid of the Moon, checks it against the
 * pinned checksum and its PDS label, and writes the game's copy unchanged:
 * apps/game/public/moon/ldem-4.bin, 1440 × 720 little-endian 16-bit integers in
 * half metres above 1,737.4 km, row 0 at the north pole, column 0 at longitude 0°.
 *
 *   npm run moon-data
 *
 * The output is committed; run this only to reproduce or audit it. Provenance and
 * terms are in docs/assets.md.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const SOURCE =
  'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/';
const IMAGE = 'ldem_4.img';
const LABEL = 'ldem_4.lbl';
const IMAGE_SHA256 = 'c04632eba6449af49e3108ed7c25b3b1c450600abd3690df4fc815853a1af476';
const OUTPUT = new URL('../apps/game/public/moon/ldem-4.bin', import.meta.url);

/** Label fields the game's reader assumes (apps/game/src/terrain.ts). */
const EXPECTED: Record<string, string> = {
  PRODUCT_ID: '"LDEM_4"',
  LINES: '720',
  LINE_SAMPLES: '1440',
  SAMPLE_TYPE: 'LSB_INTEGER',
  SAMPLE_BITS: '16',
  SCALING_FACTOR: '0.5',
  OFFSET: '1737400.',
  MAP_PROJECTION_TYPE: '"SIMPLE CYLINDRICAL"',
  MAP_RESOLUTION: '4 <pix/deg>',
  WESTERNMOST_LONGITUDE: '0 <deg>',
  MAXIMUM_LATITUDE: '90 <deg>',
  POSITIVE_LONGITUDE_DIRECTION: '"EAST"',
};

async function download(name: string): Promise<Buffer> {
  const response = await fetch(SOURCE + name);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

const label = (await download(LABEL)).toString('latin1');
for (const [key, value] of Object.entries(EXPECTED)) {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm').exec(label);
  if (match?.[1] !== value) {
    throw new Error(`${LABEL}: expected ${key} = ${value}, found ${match?.[1] ?? 'nothing'}`);
  }
}

const image = await download(IMAGE);
const digest = createHash('sha256').update(image).digest('hex');
if (digest !== IMAGE_SHA256) {
  throw new Error(`${IMAGE}: SHA-256 ${digest} does not match the pinned ${IMAGE_SHA256}`);
}
if (image.length !== 1440 * 720 * 2) throw new Error(`${IMAGE}: unexpected size ${image.length}`);

mkdirSync(new URL('./', OUTPUT), { recursive: true });
writeFileSync(OUTPUT, image);
console.log(`Wrote ${OUTPUT.pathname} (${image.length} bytes, SHA-256 ${digest}).`);
