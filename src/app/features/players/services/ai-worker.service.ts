import { Injectable, inject } from '@angular/core';
import { PerfMarksService } from '../../../core/services/perf-marks.service';
import { createAiWorker } from './ai-worker.factory';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { AIAnalysisService, Player as AIPlayer } from './ai-analysis.service';
import type { HeadToHeadStats } from './history-stats.service';

interface PlayerLite { id: number|string; firstName: string; lastName?: string; position?: string }
interface AIWorkerResult { prediction:{ predictedScore:{ xanh:number; cam:number }; winProbability:{ xanh:number; cam:number } }; keyFactors:{ name:string; impact:number }[]; historicalContext:{ recentPerformance:{ xanhWins:number; camWins:number; draws:number }; matchesAnalyzed:number }; headToHead?: HeadToHeadStats }

@Injectable({ providedIn:'root' })
export class AIWorkerService {
  private worker: Worker | null = null;
  private readonly supportsWorker = typeof Worker !== 'undefined';
  // Fallback direct service (lazy loaded on demand) if Worker unsupported
  private fallbackService: AIAnalysisService | null = null;
  private perf: { markStart(label:string): string; markEnd(label:string, startId:string): unknown } = inject(PerfMarksService);
  // Track current AI mode for UI badge (idle | worker | fallback)
  private modeSubject = new BehaviorSubject<'idle'|'worker'|'fallback'>('idle');
  readonly mode$ = this.modeSubject.asObservable();
  private lastDurationSubject = new BehaviorSubject<number|undefined>(undefined);
  readonly lastDuration$ = this.lastDurationSubject.asObservable();
  // Removed custom constructor to fix Angular DI runtime error
  private ensureWorker(){
  if(!this.supportsWorker) return;
    if(!this.worker){
      try { this.worker = createAiWorker(); } catch { this.worker = null; /* falls back to main-thread analysis */ }
    }
  }

  analyze(teamA: PlayerLite[], teamB: PlayerLite[], headToHead?: HeadToHeadStats): Observable<AIWorkerResult & { duration?: number; mode:'worker'|'fallback' }> {
    if(this.supportsWorker){
      this.ensureWorker();
      return new Observable<AIWorkerResult & { duration?: number; mode:'worker'|'fallback' }>(subscriber => {
        if(!this.worker){
          const fb = this.runFallback(teamA, teamB, headToHead);
          this.modeSubject.next('fallback');
          subscriber.next({ ...fb, mode:'fallback' });
          subscriber.complete();
          return;
        }
        const startId = this.perf.markStart('ai-worker-analysis');
        const handler = (ev: MessageEvent) => {
          if(ev.data?.type === 'ANALYSIS_RESULT'){
            // Perf measure end
            this.perf.markEnd('ai-worker-analysis', startId);
            this.modeSubject.next('worker');
            this.lastDurationSubject.next(ev.data.duration);
            subscriber.next({ ...(ev.data.result as AIWorkerResult), duration: ev.data.duration, mode:'worker' });
            subscriber.complete();
            this.worker?.removeEventListener('message', handler);
          }
        };
        this.worker.addEventListener('message', handler);
  this.worker.postMessage({ type:'ANALYZE_TEAMS', teamA, teamB, headToHead });
        // Safety timeout emission (prevents silent 10s stall)
        const timeout = setTimeout(()=>{
          if(!subscriber.closed){
            this.perf.markEnd('ai-worker-analysis', startId);
            // Fallback: perform direct analysis instead of pure error
            const fb = this.runFallback(teamA, teamB, headToHead);
            this.modeSubject.next('fallback');
            this.lastDurationSubject.next(fb.duration);
            subscriber.next({ ...fb, mode:'fallback' });
            subscriber.complete();
            this.worker?.removeEventListener('message', handler);
          }
        }, 6000);
        return () => { clearTimeout(timeout); this.worker?.removeEventListener('message', handler); };
      });
    }
    // Fallback path (no worker support): use direct AIAnalysisService logic
    if(!this.fallbackService){
      this.fallbackService = new AIAnalysisService();
    }
    const fb = this.runFallback(teamA, teamB, headToHead);
  this.modeSubject.next('fallback');
  this.lastDurationSubject.next(fb.duration);
    return of({ ...fb, mode:'fallback' });
  }

  private runFallback(teamA: PlayerLite[], teamB: PlayerLite[], headToHead?: HeadToHeadStats){
    if(!this.fallbackService){ this.fallbackService = new AIAnalysisService(); }
    const toAIPlayer = (p: PlayerLite): AIPlayer => ({ id: typeof p.id==='number'? p.id: parseInt(String(p.id),10)||0, firstName: p.firstName, lastName: p.lastName, position: p.position||'Chưa xác định' });
    const startId = this.perf.markStart('ai-fallback-analysis');
    const t0 = performance.now();
    const result = this.fallbackService.analyzeTeams(teamA.map(toAIPlayer), teamB.map(toAIPlayer), [], headToHead);
    const duration = performance.now() - t0;
    this.perf.markEnd('ai-fallback-analysis', startId);
    return {
      prediction: result.prediction,
      keyFactors: result.keyFactors,
      historicalContext: { recentPerformance: result.historicalContext.recentPerformance, matchesAnalyzed: result.historicalContext.matchesAnalyzed },
      duration,
      headToHead: result.headToHead
    } as AIWorkerResult & { duration?: number };
  }
}
