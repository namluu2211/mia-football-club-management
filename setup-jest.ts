const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');
setupZoneTestEnv();

// jsdom's `performance` lacks the User Timing API; borrow it from Node.
{
  const { performance: nodePerf } = require('perf_hooks');
  const target = performance as unknown as Record<string, unknown>;
  for (const fn of ['mark', 'measure', 'clearMarks', 'clearMeasures', 'getEntriesByName', 'getEntriesByType', 'getEntries']) {
    if (typeof target[fn] !== 'function') {
      Object.defineProperty(performance, fn, { value: nodePerf[fn].bind(nodePerf), configurable: true });
    }
  }
}

// Optional: silence noisy console output in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Angular is running in development mode')) return;
  originalWarn(...args);
};
 