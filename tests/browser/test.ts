import { test as base, expect } from '@playwright/test';

// Traces, screenshots, and image assertions deliberately synchronize the GPU.
const READBACK_WARNING =
  /^\[\.WebGL-0x[0-9a-f]+\]GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels(?: \(this message will no longer repeat\))?$/;

/** Every browser check fails on unexpected warnings, console errors, or uncaught exceptions. */
export const test = base.extend<{ allowedMessages: { patterns: RegExp[] } }>({
  allowedMessages: [{ patterns: [] }, { option: true }],
  page: async ({ page, allowedMessages }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (
        ['error', 'warning'].includes(message.type()) &&
        ![READBACK_WARNING, ...allowedMessages.patterns].some((p) => p.test(message.text()))
      ) {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, 'Unexpected browser errors/warnings').toEqual([]);
  },
});

export { expect };
