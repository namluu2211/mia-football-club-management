/**
 * Silences verbose console output (log/debug/info) in production builds.
 * warn and error stay active so real problems remain visible.
 * Call once, as early as possible in main.ts.
 */
export function silenceConsoleInProduction(isProduction: boolean, target: Pick<Console, 'log' | 'debug' | 'info'> = console): void {
  if (!isProduction) return;
  const noop = (): void => undefined;
  target.log = noop;
  target.debug = noop;
  target.info = noop;
}