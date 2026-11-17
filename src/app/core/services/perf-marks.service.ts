import { Injectable } from '@angular/core';

interface PerfMeasureResult {
  name: string;
  duration: number;
  start: number;
  end: number;
}

@Injectable({ providedIn: 'root' })
export class PerfMarksService {
  private measures: PerfMeasureResult[] = [];
  private seq = 0;

  markStart(label: string): string {
    const id = `${label}-start-${Date.now()}-${this.seq++}`;
    performance.mark(id);
    return id;
  }

  markEnd(label: string, startId: string): PerfMeasureResult | null {
    const endId = `${label}-end-${Date.now()}-${this.seq++}`;
    performance.mark(endId);
    try {
      performance.measure(label, startId, endId);
      const entry = performance.getEntriesByName(label).pop();
      if (entry) {
        const result: PerfMeasureResult = {
          name: label,
          duration: entry.duration,
          start: entry.startTime,
          end: entry.startTime + entry.duration
        };
        this.measures.push(result);
        return result;
      }
    } catch {
      // Silently ignore measure errors
    }
    return null;
  }

  getMeasures(): PerfMeasureResult[] { return [...this.measures]; }
  clear() { this.measures = []; }

  // Convenience wrapper
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<{ value: T; measure: PerfMeasureResult | null }> {
    const start = this.markStart(label);
    const value = await fn();
    const measure = this.markEnd(label, start);
    return { value, measure };
  }

  timeSync<T>(label: string, fn: () => T): { value: T; measure: PerfMeasureResult | null } {
    const start = this.markStart(label);
    const value = fn();
    const measure = this.markEnd(label, start);
    return { value, measure };
  }
}
