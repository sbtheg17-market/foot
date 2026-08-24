import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';

// jsdom does not provide crypto.randomUUID (used by the reschedule modal's
// idempotency key); Node's webcrypto is a drop-in replacement in tests.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

afterEach(() => cleanup());
