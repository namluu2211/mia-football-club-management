// Jest stand-in: tests install a mock global Worker, so the URL is irrelevant.
export function createAiWorker(): Worker {
  return new Worker('ai-analysis.worker.js', { type: 'module' });
}