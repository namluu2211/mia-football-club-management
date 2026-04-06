const { setupZoneTestEnv } = require('jest-preset-angular/setup-env/zone');
setupZoneTestEnv();

// Optional: silence noisy console output in tests
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Angular is running in development mode')) return;
  originalWarn(...args);
};
 