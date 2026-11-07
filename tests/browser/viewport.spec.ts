import { test, expect } from './test';
import type {} from './fixture/main';

test('production scene renders in both languages with the requested backend', async ({
  page,
}, info) => {
  const backend = info.project.name;
  const assets: { url: string; status: number; type: string }[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === 'http://127.0.0.1:4173' && /\.(js|css)$/.test(url.pathname)) {
      assets.push({
        url: url.pathname,
        status: response.status(),
        type: response.headers()['content-type'] ?? '',
      });
    }
  });
  for (const lang of ['es-AR', 'en']) {
    await page.goto(
      `http://127.0.0.1:4173/gravitas/?backend=${backend === 'webgl2' ? 'webgl2' : 'auto'}&lang=${lang}`,
    );
    await expect(page.locator('#viewport')).toHaveAttribute('data-backend', backend);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('canvas')).toHaveAttribute(
      'aria-label',
      lang === 'en'
        ? 'A lunar lander on a landing pad.'
        : 'Un módulo lunar sobre una plataforma de aterrizaje.',
    );
    await expect(page.locator('#controls')).toContainText(
      lang === 'en' ? 'Drag to orbit' : 'Arrastrá para girar',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('#subtitle')).toHaveText(
      lang === 'en' ? 'Inspection view' : 'Vista de inspección',
    );
    await expect(page.locator('#status')).toBeHidden();
  }
  // Bootstrap, deferred renderer, and English locale must load from the project prefix.
  expect(
    new Set(assets.filter((asset) => asset.url.endsWith('.js')).map((asset) => asset.url)).size,
  ).toBeGreaterThanOrEqual(3);
  expect(assets.some((asset) => asset.url.endsWith('.css'))).toBe(true);
  for (const asset of assets) {
    expect(asset.url).toMatch(/^\/gravitas\/assets\//);
    expect([200, 304]).toContain(asset.status);
    if (asset.status === 200) {
      expect(asset.type).toMatch(asset.url.endsWith('.css') ? /text\/css/ : /javascript/);
    } else {
      // A 304 has no MIME header; its original response must have been checked above.
      expect(assets.some((original) => original.url === asset.url && original.status === 200)).toBe(
        true,
      );
    }
  }
  await page.screenshot({ path: info.outputPath('scene.png') });
  await page.setViewportSize({ width: 375, height: 667 });
  await expect
    .poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.beforeEach(async ({ page }, info) => {
  if (info.title.startsWith('production')) return;
  await page.goto('http://127.0.0.1:4174/fixture/');
  await page.waitForFunction(() => !!window.fixture);
});

test('scene has a lit vehicle, pose changes are visible, and input is not mutated', async ({
  page,
}, info) => {
  const backend = info.project.name === 'webgl2' ? 'webgl2' : 'auto';
  expect(
    await page.evaluate((b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'), backend),
  ).toBe(info.project.name);
  await expect.poll(() => page.evaluate(() => window.fixture.sample().gold)).toBeGreaterThan(50);
  const before = await page.evaluate(() => window.fixture.sample());
  expect(before.white).toBeGreaterThan(50);
  expect(
    await page.evaluate(() =>
      window.fixture.setPose({
        position: { x: 2, y: 1, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      }),
    ),
  ).toBe(true);
  const after = await page.evaluate(() => window.fixture.sample());
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(15);
  await page.locator('canvas').screenshot({ path: info.outputPath('fixture.png') });
});

test('camera responds to dragging; resize and zero-size/remount keep one canvas', async ({
  page,
}, info) => {
  await page.evaluate(
    (b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'),
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  const before = await page.locator('canvas').screenshot();
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(520, 340, { steps: 8 });
  await page.mouse.up();
  expect((await page.locator('canvas').screenshot()).equals(before)).toBe(false);
  await page.locator('#host').evaluate((host) => {
    host.style.width = '400px';
    host.style.height = '300px';
  });
  await expect
    .poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height]))
    .toEqual([400, 300]);
  await page.locator('#host').evaluate((host) => {
    host.style.height = '0';
  });
  await expect.poll(() => page.evaluate(() => window.fixture.render())).toBe(false);
  await page.evaluate(() => window.fixture.unmount());
  expect(await page.locator('canvas').count()).toBe(0);
  expect(await page.evaluate(() => window.fixture.render())).toBe(false);
  await page.evaluate(() => window.fixture.unmount());
  await page.locator('#host').evaluate((host) => {
    host.style.height = '300px';
  });
  await page.evaluate(
    (b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'),
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  expect(await page.locator('canvas').count()).toBe(1);
});

test('disposal while init is pending aborts without attaching a late canvas', async ({
  page,
}, info) => {
  await page.evaluate(
    (b) => window.fixture.holdInitialization(b === 'webgl2' ? 'webgl2' : 'auto'),
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  await page.evaluate(() => window.fixture.startDisposal());
  expect(await page.locator('canvas').count()).toBe(0);
  expect(await page.evaluate(() => window.fixture.releaseInitialization())).toBe('AbortError');
  expect(await page.locator('canvas').count()).toBe(0);
  expect(await page.evaluate(() => window.fixture.render())).toBe(false);
  await page.evaluate(
    (b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'),
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  expect(await page.locator('canvas').count()).toBe(1);
});

test('failed initialization cleans up and permits a fresh instance', async ({ page }, info) => {
  expect(await page.evaluate(() => window.fixture.failInitialization())).toContain(
    'Controlled initialization failure',
  );
  expect(await page.locator('canvas').count()).toBe(0);
  await page.evaluate(
    (b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'),
    info.project.name === 'webgl2' ? 'webgl2' : 'auto',
  );
  expect(await page.locator('canvas').count()).toBe(1);
});

test.describe('automatic fallback', () => {
  test.use({
    allowedMessages: {
      patterns: [
        /^THREE\.WebGPURenderer: WebGPU is not available, running under WebGL2 backend\.$/,
      ],
    },
  });
  test('auto uses WebGL 2 when WebGPU is unavailable', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.reload();
    await page.waitForFunction(() => !!window.fixture);
    expect(await page.evaluate(() => window.fixture.mount('auto'))).toBe('webgl2');
    expect((await page.evaluate(() => window.fixture.sample())).gold).toBeGreaterThan(50);
  });
});

test.describe('unavailable graphics', () => {
  test.use({
    allowedMessages: {
      patterns: [
        /^\[viewport\] Initialization or rendering failed TypeError: Cannot read properties of null/,
      ],
    },
  });
  test('production failures are localized and leave no canvas', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof original>
      ) {
        if (args[0] === 'webgl2') return null;
        return original.apply(this, args);
      } as typeof original;
    });
    for (const lang of ['es-AR', 'en']) {
      await page.goto(`http://127.0.0.1:4173/gravitas/?backend=webgl2&lang=${lang}`);
      await expect(page.getByRole('alert')).toContainText(
        lang === 'en' ? 'We couldn’t display' : 'No pudimos mostrar',
      );
      expect(await page.locator('canvas').count()).toBe(0);
    }
  });
});

test.describe('high pixel density', () => {
  test.use({ deviceScaleFactor: 3 });
  test('drawing buffers respect the DPR cap and subsequent resizing', async ({ page }, info) => {
    await page.evaluate(
      (b) => window.fixture.mount(b === 'webgl2' ? 'webgl2' : 'auto'),
      info.project.name,
    );
    await expect
      .poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height]))
      .toEqual([1600, 1200]);
    await page.locator('#host').evaluate((host) => {
      host.style.width = '200px';
      host.style.height = '150px';
    });
    await expect
      .poll(() => page.locator('canvas').evaluate((c: HTMLCanvasElement) => [c.width, c.height]))
      .toEqual([400, 300]);
  });
});

test.describe('lost graphics context', () => {
  test.use({
    allowedMessages: {
      patterns: [
        /^WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost$/,
        /^\[viewport\] Initialization or rendering failed Error: GPU device lost:/,
      ],
    },
  });
  test('production context loss stops drawing and shows an understandable failure', async ({
    page,
  }) => {
    await page.goto('http://127.0.0.1:4173/gravitas/?backend=webgl2&lang=en');
    await expect(page.locator('#viewport')).toHaveAttribute('data-backend', 'webgl2');
    await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();
    });
    await expect(page.getByRole('alert')).toContainText('We couldn’t display');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#viewport')).not.toHaveAttribute('data-backend');
    await page.getByRole('combobox', { name: 'Language' }).selectOption('es-AR');
    await expect(page.getByRole('alert')).toContainText('No pudimos mostrar');
    await expect(page.locator('canvas')).toHaveCount(0);
  });
});
