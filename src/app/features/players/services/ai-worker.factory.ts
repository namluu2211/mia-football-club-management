/**
 * Creates the AI analysis web worker.
 * The `new URL(..., import.meta.url)` form is required for the Angular builder to bundle the worker.
 * Kept in its own module so Jest (CommonJS) can substitute it via moduleNameMapper.
 */
export function createAiWorker(): Worker {
  return new Worker(new URL('./ai-analysis.worker.ts', import.meta.url), { type: 'module' });
}